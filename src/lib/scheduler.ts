import * as cron from 'node-cron'
import { db } from './db'
import { ReportRunner } from './runner'

interface SchedulerOptions {
  demoMode?: boolean
  acceleratedSchedule?: boolean
}

export class ReportScheduler {
  private runner: ReportRunner
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map()
  private demoMode: boolean
  private acceleratedSchedule: boolean

  constructor(options: SchedulerOptions = {}) {
    this.runner = new ReportRunner()
    this.demoMode = options.demoMode || process.env.DEMO_MODE_ENABLED === 'true'
    this.acceleratedSchedule = options.acceleratedSchedule || process.env.DEMO_ACCELERATED_SCHEDULE === 'true'
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Report Scheduler...')
    
    const configs = await db.reportConfig.findMany({
      where: { enabled: true },
    })

    for (const config of configs) {
      await this.scheduleReport(config.id, config.schedule)
    }

    console.log(`✅ Scheduled ${configs.length} report configurations`)
  }

  async stop(): Promise<void> {
    console.log('⏹️ Stopping Report Scheduler...')
    
    for (const [configId, task] of this.scheduledTasks.entries()) {
      task.stop()
      this.scheduledTasks.delete(configId)
    }

    console.log('✅ All scheduled tasks stopped')
  }

  async scheduleReport(configId: string, schedule: string): Promise<void> {
    const existingTask = this.scheduledTasks.get(configId)
    if (existingTask) {
      existingTask.stop()
    }

    const effectiveSchedule = this.getEffectiveSchedule(schedule)
    
    const task = cron.schedule(effectiveSchedule, async () => {
      console.log(`⚡ Triggered scheduled run for config: ${configId}`)
      await this.runner.executeRun(configId)
    }, {
      scheduled: false,
    })

    task.start()
    this.scheduledTasks.set(configId, task)
    
    console.log(`📅 Scheduled report ${configId} with pattern: ${effectiveSchedule}`)
  }

  async unscheduleReport(configId: string): Promise<void> {
    const task = this.scheduledTasks.get(configId)
    if (task) {
      task.stop()
      this.scheduledTasks.delete(configId)
      console.log(`🗑️ Unscheduled report ${configId}`)
    }
  }

  async executeNow(configId: string): Promise<string> {
    console.log(`🏃 Manual execution requested for config: ${configId}`)
    return await this.runner.executeRun(configId)
  }

  getActiveSchedules(): { configId: string; schedule: string }[] {
    return Array.from(this.scheduledTasks.keys()).map(configId => ({
      configId,
      schedule: 'active',
    }))
  }

  private getEffectiveSchedule(originalSchedule: string): string {
    if (!this.demoMode || !this.acceleratedSchedule) {
      return originalSchedule
    }

    return '*/30 * * * * *'
  }
}

let schedulerInstance: ReportScheduler | null = null

export function getScheduler(): ReportScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ReportScheduler()
  }
  return schedulerInstance
}