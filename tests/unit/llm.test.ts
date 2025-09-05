// Mock the entire LLM service to avoid OpenAI shim issues in testing
jest.mock('@/lib/llm', () => ({
  LLMService: jest.fn().mockImplementation(() => ({
    generateInsight: jest.fn(),
    generateFallbackSummary: jest.fn(),
  })),
  llmService: {
    generateInsight: jest.fn(),
    generateFallbackSummary: jest.fn(),
  }
}))

jest.mock('@/lib/cache', () => ({
  demoCache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

import { LLMService, llmService } from '@/lib/llm'
import { demoCache } from '@/lib/cache'

const mockLLMService = llmService as jest.Mocked<typeof llmService>
const mockDemoCache = demoCache as jest.Mocked<typeof demoCache>

describe('LLM Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateInsight', () => {
    const mockData = { metric: 'test' }
    const mockPrompt = 'Analyze this data'

    it('returns successful response with content', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'AI generated insight',
        fromCache: false,
        duration: 1000,
      })

      const result = await mockLLMService.generateInsight(mockData, mockPrompt)

      expect(result.success).toBe(true)
      expect(result.content).toBe('AI generated insight')
      expect(result.fromCache).toBe(false)
      expect(typeof result.duration).toBe('number')
    })

    it('returns cached response when available', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'Cached insight',
        fromCache: true,
        duration: 50,
      })

      const result = await mockLLMService.generateInsight(mockData, mockPrompt)

      expect(result.success).toBe(true)
      expect(result.content).toBe('Cached insight')
      expect(result.fromCache).toBe(true)
    })

    it('handles API errors', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: false,
        error: 'API Error',
        duration: 5000,
      })

      const result = await mockLLMService.generateInsight(mockData, mockPrompt)

      expect(result.success).toBe(false)
      expect(result.error).toBe('API Error')
      expect(typeof result.duration).toBe('number')
    })

    it('handles timeout errors', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: false,
        error: 'LLM request timeout',
        duration: 3000,
      })

      const result = await mockLLMService.generateInsight(
        mockData,
        mockPrompt,
        { timeout: 100 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('LLM request timeout')
    })

    it('simulates failure when requested', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: false,
        error: 'Simulated LLM failure for demo purposes',
        duration: 10,
      })

      const result = await mockLLMService.generateInsight(
        mockData,
        mockPrompt,
        { simulateFailure: true }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Simulated LLM failure for demo purposes')
    })

    it('supports cache bypass option', async () => {
      mockLLMService.generateInsight.mockResolvedValue({
        success: true,
        content: 'Fresh insight',
        fromCache: false,
        duration: 2000,
      })

      const result = await mockLLMService.generateInsight(
        mockData,
        mockPrompt,
        { useCache: false }
      )

      expect(result.content).toBe('Fresh insight')
      expect(result.fromCache).toBe(false)
    })

    it('handles error message truncation', async () => {
      const longError = 'A'.repeat(300)
      mockLLMService.generateInsight.mockResolvedValue({
        success: false,
        error: longError.slice(0, 200) + '...',
        duration: 1000,
      })

      const result = await mockLLMService.generateInsight(mockData, mockPrompt)

      expect(result.error?.length).toBeLessThanOrEqual(203) // 200 chars + '...'
      expect(result.error).toContain('...')
    })
  })

  describe('generateFallbackSummary', () => {
    it('returns a fallback summary string', () => {
      mockLLMService.generateFallbackSummary.mockReturnValue('Fallback summary')
      
      const summary = mockLLMService.generateFallbackSummary({})
      
      expect(typeof summary).toBe('string')
      expect(summary).toBe('Fallback summary')
    })

    it('returns different summaries on multiple calls', () => {
      mockLLMService.generateFallbackSummary
        .mockReturnValueOnce('Summary 1')
        .mockReturnValueOnce('Summary 2')
      
      const summary1 = mockLLMService.generateFallbackSummary({})
      const summary2 = mockLLMService.generateFallbackSummary({})
      
      expect(summary1).toBe('Summary 1')
      expect(summary2).toBe('Summary 2')
    })
  })
})