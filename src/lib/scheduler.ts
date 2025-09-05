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

  static getInstance(): ReportScheduler {
    if (!ReportScheduler.instance) {
      ReportScheduler.instance = new ReportScheduler();
    }
    return ReportScheduler.instance;
  }

  async scheduleReport(config: ReportConfig): Promise<void> {
    this.config = { ...config, id: config.id || uuidv4() };
    
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
    if (!this.config) {
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