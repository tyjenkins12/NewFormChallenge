import { ReportRunner } from '@/lib/runner'
import { reportGenerator } from '@/lib/report-generator'
import { emailService } from '@/lib/email'

jest.mock('@/lib/db', () => ({
  db: {
    reportConfig: {
      findUnique: jest.fn(),
    },
    reportRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    report: {
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/report-generator', () => ({
  reportGenerator: {
    generateReport: jest.fn(),
  },
}))

jest.mock('@/lib/email', () => ({
  emailService: {
    generateEmailHtml: jest.fn(),
    sendReportEmail: jest.fn(),
  },
}))

const mockDb = require('@/lib/db').db
const mockReportGenerator = reportGenerator as jest.Mocked<typeof reportGenerator>
const mockEmailService = emailService as jest.Mocked<typeof emailService>

describe('ReportRunner', () => {
  let runner: ReportRunner
  const mockConfigId = 'config-123'
  const mockRunId = 'run-123'

  beforeEach(() => {
    runner = new ReportRunner()
    jest.clearAllMocks()
  })

  describe('executeRun', () => {
    const mockConfig = {
      id: mockConfigId,
      name: 'Test Config',
      enabled: true,
      allowedSites: ['https://example.com'],
    }

    const mockRun = {
      id: mockRunId,
      configId: mockConfigId,
      status: 'PENDING',
      startedAt: new Date(),
    }

    const mockReport = {
      id: 'report-123',
      runId: mockRunId,
      configId: mockConfigId,
      slug: 'test-slug',
      title: 'Test Report',
      deliveryMethod: 'link' as const,
      isPublic: true,
    }

    beforeEach(() => {
      mockDb.reportConfig.findUnique.mockResolvedValue(mockConfig)
      mockDb.reportRun.create.mockResolvedValue(mockRun)
      mockDb.reportRun.update.mockResolvedValue({})
      mockReportGenerator.generateReport.mockResolvedValue(mockReport as any)
    })

    it('successfully executes run', async () => {
      const runId = await runner.executeRun(mockConfigId)

      expect(runId).toBe(mockRunId)
      expect(mockDb.reportConfig.findUnique).toHaveBeenCalledWith({
        where: { id: mockConfigId },
      })
      expect(mockDb.reportRun.create).toHaveBeenCalled()
      expect(mockReportGenerator.generateReport).toHaveBeenCalledWith(
        mockRunId,
        mockConfigId,
        mockConfig.allowedSites,
        expect.any(Object)
      )
      expect(mockDb.reportRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    })

    it('prevents concurrent runs for same config', async () => {
      // Mock a slow report generation to ensure concurrency check works
      mockReportGenerator.generateReport.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockReport as any), 100))
      )

      const promise1 = runner.executeRun(mockConfigId)
      
      // Give promise1 a moment to start and set the activeRuns
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const promise2 = runner.executeRun(mockConfigId)

      await expect(promise2).rejects.toThrow(
        `Run already in progress for config: ${mockConfigId}`
      )

      await promise1
    })

    it('throws error for non-existent config', async () => {
      mockDb.reportConfig.findUnique.mockResolvedValue(null)

      await expect(runner.executeRun(mockConfigId)).rejects.toThrow(
        `Config not found: ${mockConfigId}`
      )
    })

    it('throws error for disabled config', async () => {
      mockDb.reportConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        enabled: false,
      })

      await expect(runner.executeRun(mockConfigId)).rejects.toThrow(
        `Config is disabled: ${mockConfigId}`
      )
    })

    it('handles email delivery', async () => {
      const emailReport = {
        ...mockReport,
        deliveryMethod: 'email' as const,
        deliveryTarget: 'test@example.com',
      }

      mockReportGenerator.generateReport.mockResolvedValue(emailReport as any)
      mockEmailService.generateEmailHtml.mockResolvedValue('<html>Test</html>')
      mockEmailService.sendReportEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      })

      await runner.executeRun(mockConfigId)

      expect(mockEmailService.generateEmailHtml).toHaveBeenCalled()
      expect(mockEmailService.sendReportEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        report: emailReport,
        publicUrl: expect.stringContaining('/r/test-slug'),
      })
      expect(mockDb.report.update).toHaveBeenCalledWith({
        where: { id: emailReport.id },
        data: { emailHtml: '<html>Test</html>' },
      })
    })

    it('handles generation errors', async () => {
      mockReportGenerator.generateReport.mockRejectedValue(
        new Error('Generation failed')
      )
      mockDb.reportRun.findUnique.mockResolvedValue({
        ...mockRun,
        startedAt: new Date(),
      })

      await expect(runner.executeRun(mockConfigId)).rejects.toThrow(
        'Generation failed'
      )

      expect(mockDb.reportRun.update).toHaveBeenCalledWith({
        where: { id: mockRunId },
        data: expect.objectContaining({
          status: 'FAILED',
          lastErrorCode: '500',
          lastErrorSnippet: 'Generation failed',
        }),
      })
    })

    it('respects run options', async () => {
      const options = {
        useCache: false,
        simulateFailure: true,
        bypassCache: true,
      }

      await runner.executeRun(mockConfigId, options)

      expect(mockReportGenerator.generateReport).toHaveBeenCalledWith(
        mockRunId,
        mockConfigId,
        mockConfig.allowedSites,
        {
          useCache: false, // bypassCache overrides useCache
          simulateFailure: true,
        }
      )
    })
  })

  describe('isRunning', () => {
    it('returns false when no run is active', () => {
      expect(runner.isRunning(mockConfigId)).toBe(false)
    })

    it('returns true when run is active', async () => {
      const mockConfig = {
        id: mockConfigId,
        enabled: true,
        allowedSites: [],
      }

      mockDb.reportConfig.findUnique.mockResolvedValue(mockConfig)
      mockDb.reportRun.create.mockResolvedValue({ id: mockRunId })
      mockReportGenerator.generateReport.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const runPromise = runner.executeRun(mockConfigId).catch(() => {}) // Start run but don't wait
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(runner.isRunning(mockConfigId)).toBe(true)
    })
  })

  describe('getActiveRunsCount', () => {
    it('returns 0 when no runs are active', () => {
      expect(runner.getActiveRunsCount()).toBe(0)
    })
  })

  describe('getRunStatus', () => {
    it('fetches run with related data', async () => {
      const mockRunWithRelations = {
        id: mockRunId,
        status: 'COMPLETED',
        config: { name: 'Test Config' },
        report: { slug: 'test-slug' },
      }

      mockDb.reportRun.findUnique.mockResolvedValue(mockRunWithRelations)

      const result = await runner.getRunStatus(mockRunId)

      expect(mockDb.reportRun.findUnique).toHaveBeenCalledWith({
        where: { id: mockRunId },
        include: {
          config: true,
          report: true,
        },
      })
      expect(result).toBe(mockRunWithRelations)
    })
  })

  describe('getRecentRuns', () => {
    it('fetches recent runs with default limit', async () => {
      const mockRuns = [{ id: 'run1' }, { id: 'run2' }]
      mockDb.reportRun.findMany.mockResolvedValue(mockRuns)

      const result = await runner.getRecentRuns()

      expect(mockDb.reportRun.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          config: true,
          report: true,
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 10,
      })
      expect(result).toBe(mockRuns)
    })

    it('filters by config ID when provided', async () => {
      await runner.getRecentRuns(mockConfigId, 5)

      expect(mockDb.reportRun.findMany).toHaveBeenCalledWith({
        where: { configId: mockConfigId },
        include: {
          config: true,
          report: true,
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 5,
      })
    })
  })
})