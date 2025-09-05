import { ReportGenerator } from '@/lib/report-generator'
import { llmService } from '@/lib/llm'
import { mockReport, mockAnalyticsData, mockOpenAIResponse } from '../__mocks__/setup'

jest.mock('@/lib/db', () => ({
  db: {
    report: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/llm', () => ({
  llmService: {
    generateInsight: jest.fn(),
    generateFallbackSummary: jest.fn(),
  },
}))

const mockLLMService = llmService as jest.Mocked<typeof llmService>

describe('ReportGenerator', () => {
  let generator: ReportGenerator
  const mockDb = require('@/lib/db').db

  beforeEach(() => {
    generator = new ReportGenerator()
    jest.clearAllMocks()
  })

  describe('generateReport', () => {
    const mockRunId = 'run-123'
    const mockConfigId = 'config-123'
    const mockAllowedSites = ['https://example.com']

    beforeEach(() => {
      mockDb.report.create.mockResolvedValue(mockReport)
    })

    it('generates report with LLM insights', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'AI generated insight',
        duration: 1000,
      })

      const report = await generator.generateReport(
        mockRunId,
        mockConfigId,
        mockAllowedSites
      )

      expect(mockLLMService.generateInsight).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Generate a concise executive summary'),
        expect.objectContaining({
          useCache: undefined,
          simulateFailure: undefined,
        })
      )

      expect(mockDb.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: mockRunId,
          configId: mockConfigId,
          summary: 'AI generated insight',
          kpis: expect.any(Array),
        }),
      })

      expect(report).toBeDefined()
      expect(report.kpis).toHaveLength(3) // Mock report has 3 KPIs
    })

    it('uses fallback when LLM fails', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: false,
        error: 'LLM timeout',
        duration: 5000,
      })

      mockLLMService.generateFallbackSummary.mockReturnValue('Fallback summary')

      const report = await generator.generateReport(
        mockRunId,
        mockConfigId,
        mockAllowedSites
      )

      expect(mockLLMService.generateFallbackSummary).toHaveBeenCalled()
      expect(mockDb.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          summary: 'Fallback summary',
        }),
      })
    })

    it('generates consistent KPI structure', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'Test insight',
        duration: 1000,
      })

      const report = await generator.generateReport(
        mockRunId,
        mockConfigId,
        mockAllowedSites
      )

      expect(report.kpis).toHaveLength(3) // Mock report has 3 KPIs
      
      const expectedMetrics = [
        'Page Views',
        'Unique Visitors', 
        'Bounce Rate'
      ]

      report.kpis.forEach((kpi, index) => {
        expect(kpi.metric).toBe(expectedMetrics[index])
        expect(typeof kpi.current).toBe('number')
        expect(typeof kpi.previous).toBe('number')
        expect(typeof kpi.delta).toBe('number')
        expect(typeof kpi.deltaPercent).toBe('number')
        expect(['up', 'down', 'stable']).toContain(kpi.trend)
      })
    })

    it('respects cache options', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'Test',
        duration: 1000,
      })

      await generator.generateReport(
        mockRunId,
        mockConfigId,
        mockAllowedSites,
        {
          useCache: false,
          simulateFailure: true,
        }
      )

      expect(mockLLMService.generateInsight).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({
          useCache: false,
          simulateFailure: true,
        })
      )
    })
  })
})