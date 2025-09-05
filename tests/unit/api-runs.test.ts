/**
 * @jest-environment node
 */

import { POST, GET } from '@/app/api/runs/route'
import { reportRunner } from '@/lib/runner'
import { NextRequest } from 'next/server'

jest.mock('@/lib/runner', () => ({
  reportRunner: {
    isRunning: jest.fn(),
    executeRun: jest.fn(),
    getRecentRuns: jest.fn(),
  },
}))

const mockReportRunner = reportRunner as jest.Mocked<typeof reportRunner>

describe('/api/runs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('creates new run successfully', async () => {
      mockReportRunner.isRunning.mockReturnValue(false)
      mockReportRunner.executeRun.mockResolvedValue('run-123')

      const request = new NextRequest('http://localhost:3000/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          configId: 'config-123',
          useCache: true,
          simulateFailure: false,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.runId).toBe('run-123')
      expect(mockReportRunner.executeRun).toHaveBeenCalledWith('config-123', {
        useCache: true,
        simulateFailure: false,
        bypassCache: undefined,
      })
    })

    it('rejects concurrent runs', async () => {
      mockReportRunner.isRunning.mockReturnValue(true)

      const request = new NextRequest('http://localhost:3000/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          configId: 'config-123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Run already in progress for this configuration')
      expect(mockReportRunner.executeRun).not.toHaveBeenCalled()
    })

    it('validates request data', async () => {
      const request = new NextRequest('http://localhost:3000/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          invalidField: 'value',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
      expect(data.details).toBeDefined()
    })

    it('handles execution errors', async () => {
      mockReportRunner.isRunning.mockReturnValue(false)
      mockReportRunner.executeRun.mockRejectedValue(new Error('Execution failed'))

      const request = new NextRequest('http://localhost:3000/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          configId: 'config-123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Execution failed')
    })

    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/runs', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })

  describe('GET', () => {
    it('fetches recent runs with default limit', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'COMPLETED' },
        { id: 'run-2', status: 'RUNNING' },
      ]
      mockReportRunner.getRecentRuns.mockResolvedValue(mockRuns as any)

      const request = new NextRequest('http://localhost:3000/api/runs')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRuns)
      expect(mockReportRunner.getRecentRuns).toHaveBeenCalledWith(undefined, 10)
    })

    it('filters by configId when provided', async () => {
      const mockRuns = [{ id: 'run-1', configId: 'config-123' }]
      mockReportRunner.getRecentRuns.mockResolvedValue(mockRuns as any)

      const request = new NextRequest('http://localhost:3000/api/runs?configId=config-123&limit=5')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockReportRunner.getRecentRuns).toHaveBeenCalledWith('config-123', 5)
    })

    it('enforces maximum limit', async () => {
      mockReportRunner.getRecentRuns.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/runs?limit=100')
      const response = await GET(request)

      expect(mockReportRunner.getRecentRuns).toHaveBeenCalledWith(undefined, 50)
    })

    it('handles fetch errors', async () => {
      mockReportRunner.getRecentRuns.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/runs')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch runs')
    })

    it('handles invalid limit parameter', async () => {
      mockReportRunner.getRecentRuns.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/runs?limit=invalid')
      const response = await GET(request)

      // parseInt('invalid') returns NaN, Math.min(NaN, 50) returns NaN, so we should get default of 10
      expect(mockReportRunner.getRecentRuns).toHaveBeenCalledWith(undefined, 10)
    })
  })
})