import * as cron from 'node-cron';
import { ReportConfig, ReportRun, SchedulerStatus } from '@/types';
import { fetchAdData, generateLLMSummary } from './api';
import { generateReport } from './report-generator';
import { sendEmail } from './email';
import { v4 as uuidv4 } from 'uuid';
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

  static getInstance(): ReportScheduler {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
    }
    return ReportScheduler.instance;
  }

  static async getInstanceAsync(): Promise<ReportScheduler> {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
      // Initialize async on first creation
      await ReportScheduler.instance.initializeScheduler();
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
        this.config = data.config;
        this.status = { ...this.status, ...data.status };
        this.reportRuns = data.reportRuns || [];
        console.log('📂 Scheduler: Loaded config and status from file');
        console.log('📂 Restored state:', {
          cadence: this.config?.cadence,
          isRunning: this.status?.isRunning,
          nextRun: this.status?.nextRun
        });
      } else {
        // Old format (just config)
        this.config = data;
        console.log('📂 Scheduler: Loaded config from file (old format)');
      }
    } catch (error) {
      console.log('📂 Scheduler: No config file found');
      this.config = null;
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
        console.log('💾 Scheduler: Config and status saved to file');
      } catch (error) {
        console.error('❌ Scheduler: Failed to save config:', error);
      }
    }
  }

  private async initializeScheduler(): Promise<void> {
    console.log('🏁 initializeScheduler called');
    // Try to load existing config first
    await this.loadConfig();
    
    console.log('🔍 After loadConfig, config is:', this.config?.cadence, this.config?.platform);
    
    // If we have a config, restore the scheduled task
    if (this.config && this.config.cadence !== 'manual') {
      console.log(`🔄 Scheduler: Restoring ${this.config.cadence} schedule for ${this.config.platform}`);
      await this.scheduleNextRunFromNow();
    } else {
      console.log('📋 Scheduler: No existing configuration to restore');
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
      const reportsDir = path.join(process.cwd(), 'public', 'reports');
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
    
    console.log('✅ Scheduler: Clean startup - all configuration and reports cleared');
  }

  async scheduleReport(config: ReportConfig): Promise<void> {
    console.log('📝 Scheduler: Received config:', JSON.stringify(config, null, 2));
    this.config = { ...config, id: config.id || uuidv4() };
    console.log('✅ Scheduler: Config stored with ID:', this.config.id);
    console.log('🔍 Config cadence after setting:', this.config.cadence);
    
    // Save config to file for persistence across API calls
    await this.saveConfig();
    
    // Stop existing task
    if (this.currentTask) {
      this.currentTask.destroy();
      this.currentTask = null;
    }

    console.log('🔍 About to check cadence, current config:', this.config?.cadence);
    
    // Only schedule if not manual
    if (config.cadence !== 'manual') {
      console.log('🔍 Calling scheduleNextRunFromNow, config before call:', this.config?.cadence);
      // Instead of fixed cron expressions, schedule first run based on current time
      // Pass config directly to avoid any race conditions
      await this.scheduleNextRunFromNow(config);
    } else {
      console.log('📋 Scheduler: Manual mode - generating immediate report');
      // For manual mode, generate a report immediately
      try {
        const report = await this.runReport();
        console.log('✅ Manual report generated successfully:', report.id);
      } catch (error) {
        console.error('❌ Failed to generate manual report:', error);
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

    const now = new Date();
    const nextRun = new Date(now);
    
    // Calculate next run time based on current time + interval
    switch (config.cadence) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case '12hours':
        nextRun.setHours(nextRun.getHours() + 12);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        // Keep the same time as when user configured it
        break;
    }
    
    this.status.nextRun = nextRun;
    
    // Schedule a one-time timeout for the next run
    const msUntilNext = nextRun.getTime() - now.getTime();
    
    console.log(`⏰ Scheduler: Next ${config.cadence} run scheduled for: ${nextRun.toLocaleString()}`);
    console.log(`🕐 Scheduler: Will run in ${Math.round(msUntilNext / 1000 / 60)} minutes (${msUntilNext}ms)`);
    
    // Clear any existing timeout
    if (this.scheduledTimeoutId) {
      clearTimeout(this.scheduledTimeoutId);
      console.log('🗑️ Cleared existing timeout');
    }
    
    this.scheduledTimeoutId = setTimeout(() => {
      console.log('⚡ Scheduled timeout triggered - running report');
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
    
    // Save the updated status to file
    await this.saveConfig();
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
    console.log('🚀 Scheduler: Running report...');
    
    // Try to load config from file if not in memory
    if (!this.config) {
      console.log('📂 Scheduler: No config in memory, attempting to load from file...');
      await this.loadConfig();
    }
    
    console.log('📋 Scheduler: Current config exists?', !!this.config);
    if (this.config) {
      console.log('📄 Scheduler: Config details:', { platform: this.config.platform, cadence: this.config.cadence });
    }
    
    if (!this.config) {
      console.error('❌ Scheduler: No configuration found!');
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

    try {
      // Fetch data from API
      const data = await fetchAdData(this.config);
      console.log(`📊 Scheduler: Retrieved ${data.length} records from NewForm API`);
      
      // Generate LLM summary
      const summary = await generateLLMSummary(data, this.config);
      
      // Generate HTML report
      const reportHtml = await generateReport(data, summary, this.config);
      
      // Save report to file system
      const reportsDir = path.join(process.cwd(), 'public', 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const reportPath = path.join(reportsDir, `report-${runId}.html`);
      await fs.writeFile(reportPath, reportHtml);

      run.status = 'success';
      run.reportPath = reportPath;
      run.reportUrl = `/reports/report-${runId}.html`;

      // Check if we have insufficient data and set appropriate error
      if (data.length === 0) {
        const errorMessage = `No data available for ${this.config.platform} ${this.config.level} level with ${this.config.dateRangeEnum} date range. Try 'campaign' level or 'last30' date range for better data availability.`;
        console.log(`⚠️ Scheduler: ${errorMessage}`);
        this.status.lastError = errorMessage;
        console.log('📄 Scheduler: Generated report with "No data available" message');
      } else {
        // Clear any previous error since we have data now
        this.status.lastError = undefined;
        console.log('✅ Scheduler: Generated report with real data');
      }

      // Handle delivery
      if (this.config.delivery === 'email' && this.config.email) {
        await sendEmail(this.config.email, reportHtml, `${this.config.platform.toUpperCase()} Report`);
      }

      this.status.lastRun = new Date();
      this.status.reportPath = run.reportUrl;

      // For scheduled cadences, calculate next run from this manual run time
      if (this.config.cadence !== 'manual') {
        this.calculateNextRunFromLastRun();
        await this.rescheduleFromManualRun();
      }

    } catch (error) {
      run.status = 'error';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = run.error;
      console.error('Report generation failed:', error);
    }

    this.updateStatus();
    return run;
  }

  private calculateNextRunFromLastRun(): void {
    if (!this.config || this.config.cadence === 'manual' || !this.status.lastRun) {
      return;
    }

    const lastRun = new Date(this.status.lastRun);
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
        // For daily, keep the same time as the manual run instead of fixed 9 AM
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