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

  static getInstance(): ReportScheduler {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
    }
    return ReportScheduler.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configFilePath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('📂 Scheduler: Loaded config from file');
    } catch (error) {
      console.log('📂 Scheduler: No config file found');
      this.config = null;
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.config) {
      try {
        await fs.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2));
        console.log('💾 Scheduler: Config saved to file');
      } catch (error) {
        console.error('❌ Scheduler: Failed to save config:', error);
      }
    }
  }

  async scheduleReport(config: ReportConfig): Promise<void> {
    console.log('📝 Scheduler: Received config:', JSON.stringify(config, null, 2));
    this.config = { ...config, id: config.id || uuidv4() };
    console.log('✅ Scheduler: Config stored with ID:', this.config.id);
    
    // Save config to file for persistence across API calls
    await this.saveConfig();
    
    // Stop existing task
    if (this.currentTask) {
      this.currentTask.destroy();
      this.currentTask = null;
    }

    // Only schedule if not manual
    if (config.cadence !== 'manual') {
      const cronExpression = this.getCronExpression(config.cadence);
      this.currentTask = cron.schedule(cronExpression, () => {
        this.runReport();
      });
      console.log('⏰ Scheduler: Scheduled with cron:', cronExpression);
    } else {
      console.log('📋 Scheduler: Manual mode - no cron scheduled');
    }

    this.updateStatus();
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

    } catch (error) {
      run.status = 'error';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = run.error;
      console.error('Report generation failed:', error);
    }

    this.updateStatus();
    return run;
  }

  private updateStatus(): void {
    this.status.isRunning = this.currentTask !== null;
    
    if (this.currentTask && this.config?.cadence !== 'manual') {
      // Calculate next run time based on cron expression
      const now = new Date();
      
      // Simple next run calculation (would use a proper cron parser in production)
      const nextRun = new Date(now);
      switch (this.config!.cadence) {
        case 'hourly':
          nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
          break;
        case '12hours':
          nextRun.setHours(nextRun.getHours() + 12, 0, 0, 0);
          break;
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(9, 0, 0, 0);
          break;
      }
      this.status.nextRun = nextRun;
    } else {
      this.status.nextRun = undefined;
    }
  }

  getStatus(): SchedulerStatus {
    return { ...this.status };
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