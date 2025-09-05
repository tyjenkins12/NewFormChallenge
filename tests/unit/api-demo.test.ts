/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/demo/route'
import { demoCache } from '@/lib/cache'
import { NextRequest } from 'next/server'

jest.mock('@/lib/cache', () => ({
  demoCache: {
    clear: jest.fn(),
  },
}))

const mockDemoCache = demoCache as jest.Mocked<typeof demoCache>

describe('/api/demo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset environment variables
    delete process.env.SIMULATE_LLM_FAILURE
    delete process.env.BYPASS_CACHE
    
    // Set demo defaults
    process.env.DEMO_MODE_ENABLED = 'true'
    process.env.DEMO_ACCELERATED_SCHEDULE = 'true'
    process.env.DEMO_CACHE_DURATION_MS = '600000'
    process.env.DEMO_LLM_TIMEOUT_MS = '5000'
  })

  describe('GET', () => {
    it('returns demo state', async () => {
      process.env.SIMULATE_LLM_FAILURE = 'true'
      process.env.BYPASS_CACHE = 'false'

      const request = new NextRequest('http://localhost:3000/api/demo')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        demoMode: true,
        acceleratedSchedule: true,
        simulateFailure: true,
        bypassCache: false,
        cacheDuration: 600000,
        llmTimeout: 5000,
      })
    })

    it('handles missing environment variables', async () => {
      delete process.env.DEMO_MODE_ENABLED
      delete process.env.DEMO_CACHE_DURATION_MS
      delete process.env.DEMO_LLM_TIMEOUT_MS

      const response = await GET()
      const data = await response.json()

      expect(data).toEqual({
        demoMode: false,
        acceleratedSchedule: true,
        simulateFailure: false,
        bypassCache: false,
        cacheDuration: 600000, // default
        llmTimeout: 5000, // default
      })
    })
  })

  describe('POST', () => {
    it('updates demo controls', async () => {
      mockDemoCache.clear.mockResolvedValue()

      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({
          simulateFailure: true,
          bypassCache: false,
          clearCache: true,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.applied).toEqual({
        simulateFailure: true,
        bypassCache: false,
        cacheCleared: true,
      })

      expect(process.env.SIMULATE_LLM_FAILURE).toBe('true')
      expect(process.env.BYPASS_CACHE).toBe('false')
      expect(mockDemoCache.clear).toHaveBeenCalled()
    })

    it('updates only provided controls', async () => {
      process.env.SIMULATE_LLM_FAILURE = 'false'
      process.env.BYPASS_CACHE = 'true'

      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({
          simulateFailure: true,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.applied).toEqual({
        simulateFailure: true,
        bypassCache: true, // unchanged
        cacheCleared: false,
      })

      expect(process.env.SIMULATE_LLM_FAILURE).toBe('true')
      expect(process.env.BYPASS_CACHE).toBe('true') // unchanged
    })

    it('skips cache clear when not requested', async () => {
      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({
          simulateFailure: false,
        }),
      })

      const response = await POST(request)

      expect(mockDemoCache.clear).not.toHaveBeenCalled()
    })

    it('validates request data', async () => {
      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({
          invalidField: 'value',
          simulateFailure: 'not-boolean',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
      expect(data.details).toBeDefined()
    })

    it('handles empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.applied.cacheCleared).toBe(false)
    })

    it('handles cache clear errors gracefully', async () => {
      mockDemoCache.clear.mockRejectedValue(new Error('Cache error'))

      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: JSON.stringify({
          clearCache: true,
        }),
      })

      const response = await POST(request)
      
      // Cache error will cause 500 status - this is expected behavior
      expect(response.status).toBe(500)
    })

    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/demo', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })
})