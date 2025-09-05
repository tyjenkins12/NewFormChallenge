import { db } from './db'
import { reportGenerator } from './report-generator'
import { emailService } from './email'
import type { ReportRunStatus } from '@/types/reports'

interface RunOptions {
  useCache?: boolean
  simulateFailure?: boolean
  bypassCache?: boolean
}

export class ReportRunner {
  private activeRuns: Set<string> = new Set()

  async executeRun(configId: string, options: RunOptions = {}): Promise<string> {
    if (this.activeRuns.has(configId)) {
      throw new Error(`Run already in progress for config: ${configId}`)
    }

    const config = await db.reportConfig.findUnique({
      where: { id: configId },
    })

    if (!config) {
      throw new Error(`Config not found: ${configId}`)
    }

    if (!config.enabled) {
      throw new Error(`Config is disabled: ${configId}`)
    }

    const runId = await this.createRun(configId)
    this.activeRuns.add(configId)

    try {
      await this.updateRunStatus(runId, 'RUNNING')

      const report = await reportGenerator.generateReport(
        runId,
        configId,
        config.allowedSites,
        {
          useCache: options.bypassCache ? false : options.useCache,
          simulateFailure: options.simulateFailure,
        }
      )

      const publicUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/r/${report.slug}`

      if (report.deliveryMethod === 'email' && report.deliveryTarget) {
        const emailHtml = await emailService.generateEmailHtml(report, publicUrl)
        
        await db.report.update({
          where: { id: report.id },
          data: { emailHtml },
        })

        const emailResult = await emailService.sendReportEmail({
          to: report.deliveryTarget,
          report,
          publicUrl,
        })

        if (!emailResult.success) {
          console.error('Email delivery failed:', emailResult.error)
        }
      }

      await this.updateRunStatus(runId, 'COMPLETED')
      
      console.log(`✅ Run completed successfully: ${runId}`)
      return runId

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorSnippet = errorMessage.slice(0, 200)

      await this.updateRunStatus(runId, 'FAILED', {
        lastErrorCode: '500',
        lastErrorSnippet: errorSnippet,
      })

      console.error(`❌ Run failed: ${runId}`, error)
      throw error

    } finally {
      this.activeRuns.delete(configId)
    }
  }

  async getRunStatus(runId: string) {
    return await db.reportRun.findUnique({
      where: { id: runId },
      include: {
        config: true,
        report: true,
      },
    })
  }

  async getRecentRuns(configId?: string, limit: number = 10) {
    return await db.reportRun.findMany({
      where: configId ? { configId } : undefined,
      include: {
        config: true,
        report: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    })
  }

  isRunning(configId: string): boolean {
    return this.activeRuns.has(configId)
  }

  getActiveRunsCount(): number {
    return this.activeRuns.size
  }

  private async createRun(configId: string): Promise<string> {
    const run = await db.reportRun.create({
      data: {
        configId,
        status: 'PENDING',
        startedAt: new Date(),
      },
    })
    return run.id
  }

  private async updateRunStatus(
    runId: string,
    status: ReportRunStatus,
    additionalData?: {
      lastErrorCode?: string
      lastErrorSnippet?: string
    }
  ): Promise<void> {
    const updateData: any = {
      status,
    }

    if (status === 'COMPLETED' || status === 'FAILED') {
      const run = await db.reportRun.findUnique({
        where: { id: runId },
      })
      
      if (run) {
        updateData.completedAt = new Date()
        updateData.duration = Date.now() - run.startedAt.getTime()
      }
    }

    if (additionalData) {
      Object.assign(updateData, additionalData)
    }

    await db.reportRun.update({
      where: { id: runId },
      data: updateData,
    })
  }
}

export const reportRunner = new ReportRunner()