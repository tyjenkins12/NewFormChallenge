import * as cron from 'node-cron';
import * as cronParser from 'cron-parser';
import { ReportConfig, ReportRun, SchedulerStatus } from '@/types';
import { fetchAdData, generateLLMSummary } from './api';
import { generateReport, generateEmailReport } from './report-generator';
import { sendEmail } from './email';
import { savePdfReport, createEmailAttachment } from './pdf-generator';
import { reportAuthTokens } from './auth-tokens';
import { getBaseUrl } from './utils/base-url';
import { getCronExpressionForCadence, getNextCronExecution, getTimeUntilNextCron } from './utils/cron-utils';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import fs from 'fs/promises';
import path from 'path';

class ReportScheduler {
  private static instance: ReportScheduler;
  private currentTask: cron.ScheduledTask | null = null;
  private config: ReportConfig | null = null;
  private status: SchedulerStatus = { isRunning: false };
  private reportRuns: ReportRun[] = [];
  private configFilePath = path.join(process.cwd(), '.scheduler-config.json');
  private scheduledTimeoutId: NodeJS.Timeout | null = null;
  private isGeneratingReport: boolean = false;
  private lockFilePath = path.join(process.cwd(), '.report-generation.lock');
  private configTimestamp: number = 0;
  private instanceId: string = uuidv4();
  private instanceFilePath = path.join(process.cwd(), '.scheduler-instance.json');

  static getInstance(): ReportScheduler {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
    }
    return ReportScheduler.instance;
  }

  private async registerAsActiveInstance(): Promise<void> {
    const instanceData = {
      instanceId: this.instanceId,
      timestamp: Date.now(),
      pid: process.pid
    };
    
    try {
      await fs.writeFile(this.instanceFilePath, JSON.stringify(instanceData, null, 2));
      console.log(`🔗 Registered as active instance: ${this.instanceId}`);
    } catch (error) {
      console.error('Failed to register instance:', error);
    }
  }

  private async isActiveInstance(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.instanceFilePath, 'utf8');
      const instanceData = JSON.parse(data);
      const isActive = instanceData.instanceId === this.instanceId;
      
      if (!isActive) {
        console.log(`❌ Instance ${this.instanceId} is no longer active (active: ${instanceData.instanceId})`);
      }
      
      return isActive;
    } catch (error) {
      // If file doesn't exist, assume we're active
      console.log(`🔗 No instance file found, assuming ${this.instanceId} is active`);
      return true;
    }
  }

  static async getInstanceAsync(): Promise<ReportScheduler> {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
      // Initialize async on first creation
      await ReportScheduler.instance.initializeScheduler();
    } else {
      // For existing instances, just reload config to get latest state
      await ReportScheduler.instance.loadConfig();
    }
    return ReportScheduler.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      const fileData = await fs.readFile(this.configFilePath, 'utf8');
      const data = JSON.parse(fileData);
      
      // Handle both old format (just config) and new format (config + status)
      if (data.config) {
        // New format with config, status, and reportRuns
        // Only update config if we don't have one in memory, but always update status
        if (!this.config) {
          this.config = data.config;
          console.log('📂 Scheduler: Loaded config from file');
        } else {
          console.log('📂 Scheduler: Using existing config in memory:', this.config.platform);
        }
        
        // Always load status and reportRuns from file (this is the fix!)
        this.status = { ...this.status, ...data.status };
        this.reportRuns = data.reportRuns || [];
        
        console.log('📂 Scheduler: Updated status from file');
        console.log('📂 Current state:', {
          cadence: this.config?.cadence,
          platform: this.config?.platform,
          isRunning: this.status?.isRunning,
          nextRun: this.status?.nextRun,
          lastRun: this.status?.lastRun,
          reportPath: this.status?.reportPath
        });
      } else {
        // Old format (just config)
        if (!this.config) {
          this.config = data;
          console.log('📂 Scheduler: Loaded config from file (old format)');
        }
      }
    } catch (error) {
      console.log('📂 Scheduler: No config file found');
      if (!this.config) {
        this.config = null;
      }
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.config) {
      try {
        const dataToSave = {
          config: this.config,
          status: this.status,
          reportRuns: this.reportRuns
        };
        await fs.writeFile(this.configFilePath, JSON.stringify(dataToSave, null, 2));
        console.log('Scheduler: Config and status saved to file');
      } catch (error) {
        console.error('Scheduler: Failed to save config:', error);
      }
    }
  }

  private async initializeScheduler(): Promise<void> {
    console.log('initializeScheduler called');
    
    // Clear any existing timeout to prevent duplicates
    if (this.scheduledTimeoutId) {
      clearTimeout(this.scheduledTimeoutId);
      this.scheduledTimeoutId = null;
      console.log('🧹 Cleared existing timeout during initialization');
    }
    
    // Clean up any stale lock files on startup
    try {
      await fs.unlink(this.lockFilePath);
      console.log('🧹 Removed stale lock file on initialization');
    } catch (error) {
      // Lock file doesn't exist, which is fine
    }
    
    // Try to load existing config first
    await this.loadConfig();
    
    console.log('After loadConfig, config is:', this.config?.cadence, this.config?.platform);
    
    // If we have a config, restore the scheduled task
    if (this.config && this.config.cadence !== 'manual') {
      console.log(`Scheduler: Restoring ${this.config.cadence} schedule for ${this.config.platform}`);
      await this.scheduleNextRunFromNow();
    } else {
      console.log('Scheduler: No existing configuration to restore or manual cadence');
    }
  }

  // Method to manually clear everything - called only when explicitly requested
  async clearAll(): Promise<void> {
    return this.clearConfigOnStartup();
  }

  private async clearConfigOnStartup(): Promise<void> {
    try {
      // Clear file-based configuration
      await fs.unlink(this.configFilePath);
      console.log('🧹 Scheduler: Cleared config file on startup');
    } catch (error) {
      // File might not exist, which is fine
      console.log('📂 Scheduler: No config file to clear on startup');
    }
    
    // Clear any existing report files
    try {
      const reportsDir = path.join(process.cwd(), 'private', 'reports');
      const files = await fs.readdir(reportsDir);
      for (const file of files) {
        if (file.startsWith('report-') && file.endsWith('.html')) {
          await fs.unlink(path.join(reportsDir, file));
        }
      }
      console.log('🗂️ Scheduler: Cleared existing report files');
    } catch (error) {
      console.log('📁 Scheduler: No existing reports to clear');
    }
    
    // Reset in-memory state
    this.config = null;
    this.status = { isRunning: false };
    this.reportRuns = [];
    
    // Stop any existing cron tasks
    if (this.currentTask) {
      this.currentTask.destroy();
      this.currentTask = null;
    }
    
    console.log('Scheduler: Clean startup - all configuration and reports cleared');
  }

  async scheduleReport(config: ReportConfig): Promise<void> {
    console.log('Scheduler: Received config:', JSON.stringify(config, null, 2));
    
    // Register this instance as the active one (invalidates old instances)
    await this.registerAsActiveInstance();
    
    // Delete the old config file first to prevent reverting
    try {
      await fs.unlink(this.configFilePath);
      console.log('🗑️ Deleted old config file to prevent reverting');
    } catch (error) {
      // File might not exist, which is fine
      console.log('📂 No old config file to delete');
    }
    
    this.config = { ...config, id: config.id || uuidv4() };
    this.configTimestamp = Date.now(); // Mark when this config was set
    console.log('Scheduler: Config stored with ID:', this.config.id);
    console.log('Config cadence after setting:', this.config.cadence);
    console.log('🔧 New config platform:', this.config.platform);
    console.log('🔧 Config timestamp:', this.configTimestamp);
    
    // Save config to database if it has tokenSettings
    if (this.config.tokenSettings) {
      try {
        console.log('🔧 Saving tokenSettings to database:', this.config.tokenSettings);
        
        // First try to find existing config
        const existingConfig = await db.reportConfig.findFirst({
          where: { name: this.config.platform }
        });
        
        if (existingConfig) {
          // Update existing config with tokenSettings
          await db.reportConfig.update({
            where: { id: existingConfig.id },
            data: {
              tokenSettings: this.config.tokenSettings,
              updatedAt: new Date()
            }
          });
          console.log('🔧 Updated existing config with tokenSettings');
        } else {
          // Create new config with tokenSettings
          await db.reportConfig.create({
            data: {
              name: this.config.platform,
              description: `${this.config.platform} report configuration`,
              schedule: this.config.cadence || 'manual',
              enabled: true,
              allowedSites: [],
              tokenSettings: this.config.tokenSettings
            }
          });
          console.log('🔧 Created new config with tokenSettings');
        }
      } catch (dbError) {
        console.error('⚠️ Failed to save tokenSettings to database:', dbError);
        // Continue with in-memory operations even if DB save fails
      }
    }
    
    // Save config to file for persistence across API calls
    await this.saveConfig();
    
    // Stop existing scheduled tasks and timeouts
    if (this.currentTask) {
      this.currentTask.destroy();
      this.currentTask = null;
      console.log('🛑 Stopped existing cron task');
    }
    
    if (this.scheduledTimeoutId) {
      clearTimeout(this.scheduledTimeoutId);
      this.scheduledTimeoutId = null;
      console.log('🛑 Cleared existing scheduled timeout');
    }
    
    // Reset scheduling status
    this.status.isRunning = false;
    this.status.nextRun = undefined;
    console.log('🛑 Reset scheduler status for new config');

    console.log('About to check cadence, current config:', this.config?.cadence);
    
    // Only schedule if not manual
    if (config.cadence !== 'manual') {
      console.log('Calling scheduleNextRunFromNow, config before call:', this.config?.cadence);
      // Instead of fixed cron expressions, schedule first run based on current time
      // Pass config directly to avoid any race conditions
      await this.scheduleNextRunFromNow(config);
    } else {
      console.log('Scheduler: Manual mode - generating immediate report');
      // For manual mode, generate a report immediately
      try {
        const report = await this.runReport();
        console.log('Manual report generated successfully:', report.id);
      } catch (error) {
        console.error('Failed to generate manual report:', error);
      }
    }

    this.updateStatus();
  }

  private async scheduleNextRunFromNow(configOverride?: ReportConfig): Promise<void> {
    console.log('🔍 scheduleNextRunFromNow called');
    const config = configOverride || this.config;
    console.log('🔍 Config:', config?.cadence, config?.platform);
    console.log('🔍 Using override config:', !!configOverride);
    
    if (!config || config.cadence === 'manual') {
      console.log('❌ Not scheduling - manual cadence or no config');
      return;
    }

    let nextRun: Date;
    let cronExpression: string | null = null;

    // Check if demo mode accelerated scheduling is enabled
    const isAccelerated = config.demoMode?.enabled && config.demoMode?.accelerated;
    
    // Special handling for hourly cadence - run 1 hour from now instead of cron schedule
    if (config.cadence === 'hourly' && !isAccelerated) {
      nextRun = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      console.log('🕐 Hourly interval-based scheduling (1 hour from now):', nextRun.toLocaleString());
    } else if (config.cadence === 'custom' && config.cronExpression) {
      // Use custom cron expression
      cronExpression = config.cronExpression;
      console.log('🕐 Using custom cron expression:', cronExpression);
    } else {
      // Get cron expression for built-in cadence or use legacy logic for demo mode
      cronExpression = getCronExpressionForCadence(config.cadence);
      console.log('🕐 Using built-in cron expression for', config.cadence, ':', cronExpression);
    }

    if (cronExpression && !isAccelerated && config.cadence !== 'hourly') {
      // Use cron-parser for precise scheduling (except hourly which uses interval-based)
      const nextExecution = getNextCronExecution(cronExpression);
      if (nextExecution) {
        nextRun = nextExecution;
        console.log('📅 Cron-based scheduling:', nextRun.toLocaleString());
      } else {
        console.error('❌ Failed to parse cron expression, falling back to legacy logic');
        nextRun = this.calculateLegacyNextRun(config);
      }
    } else if (config.cadence !== 'hourly') {
      // Use legacy logic for demo mode or fallback (except hourly which is handled above)
      nextRun = this.calculateLegacyNextRun(config, isAccelerated);
      if (isAccelerated) {
        console.log('⚡ Demo mode accelerated schedule enabled');
      }
    }
    
    this.status.nextRun = nextRun;
    
    // Schedule a one-time timeout for the next run
    const now = new Date();
    const msUntilNext = nextRun.getTime() - now.getTime();
    
    const timeUnit = isAccelerated ? 'seconds' : 'minutes';
    const timeValue = isAccelerated ? Math.round(msUntilNext / 1000) : Math.round(msUntilNext / 1000 / 60);
    
    console.log(`⏰ Scheduler: Next ${config.cadence} run scheduled for: ${nextRun.toLocaleString()}`);
    console.log(`🕐 Scheduler: Will run in ${timeValue} ${timeUnit} (${msUntilNext}ms)${isAccelerated ? ' [DEMO MODE]' : ''}`);
    
    // Clear any existing timeout
    if (this.scheduledTimeoutId) {
      clearTimeout(this.scheduledTimeoutId);
      console.log(`🗑️ Cleared existing timeout ID: ${this.scheduledTimeoutId}`);
      this.scheduledTimeoutId = null;
    }
    
    this.scheduledTimeoutId = setTimeout(async () => {
      console.log(`⚡ Scheduled timeout triggered (ID: ${this.scheduledTimeoutId}) - checking if instance is active`);
      
      // Clear the timeout ID immediately to prevent duplicates
      this.scheduledTimeoutId = null;
      
      // Check if this instance is still the active one
      const isActive = await this.isActiveInstance();
      if (!isActive) {
        console.log('🚫 Timeout cancelled - instance is no longer active');
        return;
      }
      
      // Validate that this timeout is still for the current config
      if (!this.config || this.config.platform !== config.platform || this.config.cadence !== config.cadence) {
        console.log('🚫 Timeout callback cancelled - config has changed');
        console.log('🚫 Current config:', this.config?.platform, this.config?.cadence);
        console.log('🚫 Expected config:', config.platform, config.cadence);
        return;
      }
      
      console.log(`✅ Instance ${this.instanceId} is active, running report`);
      
      this.runReport().then(async () => {
        console.log('📅 Report completed, scheduling next run');
        // After running, schedule the next one using the same logic
        await this.scheduleNextRunFromNow();
      }).catch(async (error) => {
        console.error('❌ Error in scheduled report run:', error);
        // Even if there's an error, schedule the next run
        await this.scheduleNextRunFromNow();
      });
    }, msUntilNext);
    
    console.log(`✅ Timeout set with ID: ${this.scheduledTimeoutId}`);
    
    // Mark that we have a scheduled task (even though it's a timeout, not cron)
    this.status.isRunning = true;
    console.log('✅ Status.isRunning set to true');
    console.log('✅ New schedule active for platform:', config.platform, 'cadence:', config.cadence);
    console.log('✅ Next run scheduled for:', this.status.nextRun?.toLocaleString());
    
    // Save the updated status to file
    await this.saveConfig();
  }

  private calculateLegacyNextRun(config: ReportConfig, isAccelerated: boolean = false): Date {
    const now = new Date();
    const nextRun = new Date(now);
    
    if (isAccelerated) {
      // Accelerated demo mode: hourly = 1min, 12hours = 1.5min, daily = 2min, weekly = 3min, monthly = 4min
      switch (config.cadence) {
        case 'hourly':
          nextRun.setMinutes(nextRun.getMinutes() + 1);
          break;
        case '12hours':
          nextRun.setMinutes(nextRun.getMinutes() + 1);
          nextRun.setSeconds(nextRun.getSeconds() + 30);
          break;
        case 'daily':
          nextRun.setMinutes(nextRun.getMinutes() + 2);
          break;
        case 'weekly':
          nextRun.setMinutes(nextRun.getMinutes() + 3);
          break;
        case 'monthly':
          nextRun.setMinutes(nextRun.getMinutes() + 4);
          break;
      }
    } else {
      // Normal scheduling
      switch (config.cadence) {
        case 'hourly':
          nextRun.setHours(nextRun.getHours() + 1);
          break;
        case '12hours':
          nextRun.setHours(nextRun.getHours() + 12);
          break;
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    return nextRun;
  }

  private getCronExpression(cadence: string): string {
    switch (cadence) {
      case 'hourly':
        return '0 * * * *'; // Every hour
      case '12hours':
        return '0 */12 * * *'; // Every 12 hours
      case 'daily':
        return '0 9 * * *'; // Daily at 9 AM
      default:
        return '0 9 * * *'; // Default to daily
    }
  }

  async runReport(): Promise<ReportRun> {
    console.log(`Scheduler: Running report with instance ${this.instanceId}...`);
    
    // Check if this instance is still active
    const isActive = await this.isActiveInstance();
    if (!isActive) {
      console.log('🚫 Report cancelled - instance is no longer active');
      throw new Error('Report cancelled - instance is no longer active');
    }
    
    // Prevent multiple reports from running simultaneously using file-based lock
    try {
      // Check if lock file exists
      await fs.access(this.lockFilePath);
      console.log('⏸️ Report generation already in progress (lock file exists), skipping...');
      throw new Error('Report generation already in progress');
    } catch (error) {
      // Lock file doesn't exist, we can proceed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Create lock file
    await fs.writeFile(this.lockFilePath, `${Date.now()}-${process.pid}`);
    this.isGeneratingReport = true;
    console.log('Report generation lock acquired (file created)');
    
    // Preserve the previous report path during generation
    const previousReportPath = this.status.reportPath;
    
    // Try to load config from file if not in memory
    if (!this.config) {
      console.log('📂 Scheduler: No config in memory, attempting to load from file...');
      await this.loadConfig();
    }
    
    console.log('Scheduler: Current config exists?', !!this.config);
    if (this.config) {
      console.log('Scheduler: Config details:', { platform: this.config.platform, cadence: this.config.cadence });
    }
    
    if (!this.config) {
      console.error('Scheduler: No configuration found!');
      throw new Error('No report configuration found');
    }

    const runId = uuidv4();
    const run: ReportRun = {
      id: runId,
      configId: this.config.id!,
      timestamp: new Date(),
      status: 'running'
    };

    this.reportRuns.push(run);
    this.status.lastError = undefined;
    
    // Keep the previous report path until new one is ready
    if (previousReportPath) {
      this.status.reportPath = previousReportPath;
      console.log('📋 Preserving previous report path during generation:', previousReportPath);
    }

    try {
      // Fetch data from API
      const data = await fetchAdData(this.config);
      console.log(`Scheduler: Retrieved ${data.length} records from NewForm API`);
      
      // Check if we have insufficient data - skip report generation entirely
      if (data.length === 0) {
        const errorMessage = `No data available for ${this.config.platform} ${this.config.level} level with ${this.config.dateRangeEnum} date range. Try 'campaign' level or 'last30' date range for better data availability.`;
        console.log(`Scheduler: ${errorMessage}`);
        this.status.lastError = errorMessage;
        run.status = 'error';
        run.error = errorMessage;
        console.log('📄 Scheduler: Skipping report generation due to no data available');
        
        // Clear any previous successful report paths since this run failed
        this.status.lastRun = new Date();
        this.status.reportPath = undefined;
        this.status.pdfPath = undefined;
        
        // Update status to reflect error state and exit early
        this.updateStatus();
        await this.saveConfig();
        return run;
      }
      
      // Clear any previous error since we have data now
      this.status.lastError = undefined;
      console.log('Scheduler: Have data, proceeding with report generation');
      
      // Generate LLM summary
      const summary = await generateLLMSummary(data, this.config);
      
      // Generate HTML report (always generate the full version for file storage)
      const reportHtml = await generateReport(data, summary, this.config);
      
      // Save report to file system
      const reportsDir = path.join(process.cwd(), 'private', 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const reportPath = path.join(reportsDir, `report-${runId}.html`);
      await fs.writeFile(reportPath, reportHtml);

      run.status = 'success';
      run.reportPath = reportPath;
      run.reportUrl = `/reports/report-${runId}.html`;
      
      // Save report to database for persistent token validation
      try {
        // First, try to find or create the ReportConfig in database
        let configRecord = await db.reportConfig.findFirst({
          where: { name: this.config.platform }
        });
        
        if (!configRecord) {
          configRecord = await db.reportConfig.create({
            data: {
              name: this.config.platform,
              description: `${this.config.platform} report configuration`,
              schedule: this.config.cadence || 'manual',
              enabled: true,
              allowedSites: [],
              tokenSettings: this.config.tokenSettings
            }
          });
          console.log('🔧 Created new ReportConfig for database report');
        }
        
        // Create ReportRun record
        const reportRunRecord = await db.reportRun.create({
          data: {
            id: runId,
            configId: configRecord.id,
            status: 'COMPLETED',
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            retryCount: 0
          }
        });
        
        // Create Report record
        const reportRecord = await db.report.create({
          data: {
            id: runId,
            runId: reportRunRecord.id,
            configId: configRecord.id,
            slug: `report-${runId}`,
            title: `${this.config.platform.toUpperCase()} Insight Report`,
            summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
            kpis: {
              totalSpend: data.reduce((sum, d) => sum + (parseFloat(d.spend) || 0), 0),
              totalImpressions: data.reduce((sum, d) => sum + (parseInt(d.impressions) || 0), 0),
              recordCount: data.length
            },
            rawData: data,
            emailHtml: null,
            deliveryMethod: this.config.delivery || 'link',
            deliveryTarget: this.config.email || null,
            isPublic: false // Always false for security
          }
        });
        
        console.log('🔧 Saved report to database:', reportRecord.id);
      } catch (dbError) {
        console.error('⚠️ Failed to save report to database:', dbError);
        // Don't fail the entire report generation if DB save fails
      }
      
      // Check if tokens are enabled in config and update global settings accordingly
      if (this.config.tokenSettings) {
        // Always update global settings based on current config
        console.log(`🔧 Config tokenSettings:`, this.config.tokenSettings);
        console.log(`🔧 Before update - areTokensRequired()=${reportAuthTokens.areTokensRequired()}`);
        
        reportAuthTokens.updateConfig({
          defaultExpirationHours: this.config.tokenSettings.expirationHours || 168,
          allowTokenRefresh: this.config.tokenSettings.allowRefresh ?? true,
          requireTokens: this.config.tokenSettings.enabled
        });
        
        console.log(`🔧 After update - areTokensRequired()=${reportAuthTokens.areTokensRequired()}`);
        console.log(`🔧 Token config:`, reportAuthTokens.getConfig());
      } else {
        console.log(`🔧 No tokenSettings in config, global state: areTokensRequired()=${reportAuthTokens.areTokensRequired()}`);
      }
      
      // Generate signed URLs if tokens are enabled (either globally or in config)
      const tokensEnabled = this.config.tokenSettings?.enabled || reportAuthTokens.areTokensRequired();
      if (tokensEnabled) {
        // Get base URL using utility function
        const baseUrl = getBaseUrl();
        console.log('🔗 Using base URL for signed URLs:', baseUrl);
        console.log('🔗 Environment check:', {
          NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT
        });
        
        // Generate signed HTML URL
        const signedHtmlUrl = reportAuthTokens.generateSignedUrl({
          reportId: runId,
          reportType: 'html',
          baseUrl,
          permissions: ['read', 'download']
        });
        
        run.signedUrl = signedHtmlUrl;
        console.log('🔐 Generated signed HTML URL for secure access');
      }
      
      console.log('Scheduler: Generated report with real data');

      // Generate PDF if needed (for email attachment or link download)
      let pdfAttachment;
      try {
        if (this.config.delivery === 'email' && this.config.pdfAttachment) {
          console.log('📄 Generating PDF attachment for email...');
          console.log('📊 Email PDF HTML length:', reportHtml.length, 'chars');
          console.log('📊 Email PDF HTML preview (first 200 chars):', reportHtml.substring(0, 200));
          pdfAttachment = await createEmailAttachment(reportHtml, runId);
          // Also save PDF for download button
          const pdfUrl = await savePdfReport(reportHtml, runId);
          run.pdfUrl = pdfUrl;
          
          // Generate signed PDF URL if tokens are enabled
          if (tokensEnabled) {
            const baseUrl = getBaseUrl();
            const signedPdfUrl = reportAuthTokens.generateSignedUrl({
              reportId: runId,
              reportType: 'pdf',
              baseUrl,
              permissions: ['read', 'download']
            });
            run.signedPdfUrl = signedPdfUrl;
            console.log('🔐 Generated signed PDF URL for secure access');
          }
          
          console.log('PDF attachment created and saved for download:', pdfUrl);
        } else if (this.config.delivery === 'link') {
          console.log('📄 Generating PDF for download...');
          console.log('📊 Link PDF HTML length:', reportHtml.length, 'chars');
          console.log('📊 Link PDF HTML preview (first 200 chars):', reportHtml.substring(0, 200));
          const pdfUrl = await savePdfReport(reportHtml, runId);
          run.pdfUrl = pdfUrl;
          
          // Generate signed PDF URL if tokens are enabled
          if (tokensEnabled) {
            const baseUrl = getBaseUrl();
            const signedPdfUrl = reportAuthTokens.generateSignedUrl({
              reportId: runId,
              reportType: 'pdf',
              baseUrl,
              permissions: ['read', 'download']
            });
            run.signedPdfUrl = signedPdfUrl;
            console.log('🔐 Generated signed PDF URL for secure access');
          }
          
          console.log('✅ PDF saved for download:', pdfUrl);
        }
      } catch (pdfError) {
        console.error('❌ PDF generation failed:', pdfError);
        // Continue without PDF - don't fail the entire report
        if (this.config.delivery === 'email' && this.config.pdfAttachment) {
          console.log('📧 Will send email without PDF attachment due to PDF generation error');
        }
      }

      // Handle delivery
      if (this.config.delivery === 'email' && this.config.email) {
        // Prepare URLs for email - use signed URLs if available, otherwise regular URLs
        const baseUrl = getBaseUrl();
        const emailSignedUrls = {
          reportUrl: run.signedUrl || `${baseUrl}${run.reportUrl}`,
          pdfUrl: run.signedPdfUrl || (run.pdfUrl ? `${baseUrl}${run.pdfUrl}` : undefined)
        };
        
        // Generate email-optimized version for sending
        const emailHtml = await generateEmailReport(data, summary, this.config, emailSignedUrls);
        await sendEmail(this.config.email, emailHtml, `${this.config.platform.toUpperCase()} Report`, pdfAttachment);
        console.log('📧 Sent email-optimized report version' + (pdfAttachment ? ' with PDF attachment' : ''));
        
        if (run.signedUrl || run.signedPdfUrl) {
          console.log('🔐 Email includes secure action button with signed URL');
        } else {
          console.log('🔓 Email includes public action button');
        }
      }

      this.status.lastRun = new Date();
      
      // Use signed URLs if available, otherwise use regular URLs
      this.status.reportPath = run.signedUrl || run.reportUrl;
      
      // Set PDF path if available (prefer signed URL)
      if (run.signedPdfUrl) {
        this.status.pdfPath = run.signedPdfUrl;
      } else if (run.pdfUrl) {
        this.status.pdfPath = run.pdfUrl;
      }

      // For manual runs only, we don't reschedule automatically
      // Scheduled runs are handled by the timeout callback

    } catch (error) {
      run.status = 'error';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = run.error;
      console.error('Report generation failed:', error);
    } finally {
      // Always release the lock, even on errors
      try {
        await fs.unlink(this.lockFilePath);
        console.log('🔓 Report generation lock released (file deleted)');
      } catch (error) {
        console.log('⚠️ Could not delete lock file (might not exist)');
      }
      this.isGeneratingReport = false;
    }

    this.updateStatus();
    await this.saveConfig(); // Save the updated status to file
    
    return run;
  }

  private calculateNextRunFromLastRun(): void {
    if (!this.config || this.config.cadence === 'manual' || !this.status.lastRun) {
      return;
    }

    const lastRun = new Date(this.status.lastRun);
    
    // For custom cron expressions, use cron-parser
    if (this.config.cadence === 'custom' && this.config.cronExpression) {
      const nextExecution = getNextCronExecution(this.config.cronExpression);
      if (nextExecution) {
        this.status.nextRun = nextExecution;
        console.log(`⏰ Next custom cron run scheduled for: ${nextExecution.toLocaleString()}`);
        console.log(`📊 Based on cron expression: ${this.config.cronExpression}`);
        return;
      }
    }

    // Legacy calculation for built-in cadences
    const nextRun = new Date(lastRun);
    
    switch (this.config.cadence) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case '12hours':
        nextRun.setHours(nextRun.getHours() + 12);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
    
    this.status.nextRun = nextRun;
    console.log(`⏰ Next ${this.config.cadence} run scheduled for: ${nextRun.toLocaleString()}`);
    console.log(`📊 Based on manual run at: ${lastRun.toLocaleString()}`);
  }

  private async rescheduleFromManualRun(): Promise<void> {
    if (!this.config || this.config.cadence === 'manual' || !this.status.nextRun) {
      return;
    }

    // Calculate milliseconds until next run
    const now = new Date();
    const nextRun = new Date(this.status.nextRun);
    const msUntilNext = nextRun.getTime() - now.getTime();

    if (msUntilNext > 0) {
      // Schedule a one-time timeout for the next run
      console.log(`🔄 Rescheduling next run in ${Math.round(msUntilNext / 1000 / 60)} minutes`);
      
      setTimeout(() => {
        // Run the report
        this.runReport().then(async () => {
          // After the timeout run, schedule the next one using dynamic timing
          await this.scheduleNextRunFromNow();
        });
      }, msUntilNext);
    } else {
      // If next run time has already passed, schedule the next one immediately
      await this.scheduleNextRunFromNow();
    }
  }


  private updateStatus(): void {
    // isRunning is true if we have a scheduled cadence (managed by timeouts now, not cron)
    this.status.isRunning = this.config?.cadence !== 'manual' && !!this.config;
    
    // For manual cadence, clear next run
    if (this.config?.cadence === 'manual') {
      this.status.nextRun = undefined;
    }
    // For scheduled cadences, nextRun is set by scheduleNextRunFromNow() or calculateNextRunFromLastRun()
  }

  getStatus(): SchedulerStatus {
    console.log('🔍 Scheduler getStatus called, current status:', {
      isRunning: this.status.isRunning,
      reportPath: this.status.reportPath,
      lastRun: this.status.lastRun,
      nextRun: this.status.nextRun
    });
    return { ...this.status };
  }

  // Debug method to check scheduler state
  getDebugInfo(): any {
    return {
      hasConfig: !!this.config,
      configCadence: this.config?.cadence,
      configPlatform: this.config?.platform,
      isRunning: this.status.isRunning,
      nextRun: this.status.nextRun,
      hasTimeout: !!this.scheduledTimeoutId,
      timeoutId: this.scheduledTimeoutId
    };
  }

  getReportRuns(): ReportRun[] {
    return [...this.reportRuns];
  }

  getConfig(): ReportConfig | null {
    return this.config ? { ...this.config } : null;
  }

  stop(): void {
    if (this.currentTask) {
      this.currentTask.destroy();
      this.currentTask = null;
    }
    this.status.isRunning = false;
    this.status.nextRun = undefined;
  }
}

export default ReportScheduler;

export function getScheduler() {
  return ReportScheduler.getInstance();
}