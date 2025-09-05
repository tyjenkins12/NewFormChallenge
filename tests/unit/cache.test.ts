import { DemoCache } from '@/lib/cache'

jest.mock('@/lib/db', () => ({
  db: {
    demoCache: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

const mockDb = require('@/lib/db').db

describe('DemoCache', () => {
  let cache: DemoCache

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DEMO_MODE_ENABLED = 'true'
    cache = new DemoCache()
  })

  afterEach(() => {
    delete process.env.DEMO_MODE_ENABLED
  })

  describe('get', () => {
    it('returns cached data when valid', async () => {
      const mockData = { test: 'value' }
      mockDb.demoCache.findUnique.mockResolvedValue({
        key: 'test-key',
        data: mockData,
        expiresAt: new Date(Date.now() + 10000),
      })

      const result = await cache.get('test-key')

      expect(result).toEqual(mockData)
      expect(mockDb.demoCache.findUnique).toHaveBeenCalledWith({
        where: { key: 'test-key' },
      })
    })

    it('returns null when not found', async () => {
      mockDb.demoCache.findUnique.mockResolvedValue(null)

      const result = await cache.get('missing-key')

      expect(result).toBeNull()
    })

    it('returns null when expired and deletes cache entry', async () => {
      mockDb.demoCache.findUnique.mockResolvedValue({
        key: 'expired-key',
        data: { test: 'value' },
        expiresAt: new Date(Date.now() - 10000), // Expired
      })

      const result = await cache.get('expired-key')

      expect(result).toBeNull()
      expect(mockDb.demoCache.delete).toHaveBeenCalledWith({
        where: { key: 'expired-key' },
      })
    })

    it('returns null when demo mode disabled', async () => {
      process.env.DEMO_MODE_ENABLED = 'false'
      cache = new DemoCache()

      const result = await cache.get('test-key')

      expect(result).toBeNull()
      expect(mockDb.demoCache.findUnique).not.toHaveBeenCalled()
    })

    it('handles database errors gracefully', async () => {
      mockDb.demoCache.findUnique.mockRejectedValue(new Error('DB Error'))

      const result = await cache.get('test-key')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('stores data with default TTL', async () => {
      process.env.DEMO_CACHE_DURATION_MS = '60000'
      const testData = { test: 'value' }

      await cache.set('test-key', testData)

      expect(mockDb.demoCache.upsert).toHaveBeenCalledWith({
        where: { key: 'test-key' },
        update: {
          data: testData,
          expiresAt: expect.any(Date),
        },
        create: {
          key: 'test-key',
          data: testData,
          expiresAt: expect.any(Date),
        },
      })
    })

    it('stores data with custom TTL', async () => {
      const testData = { test: 'value' }
      const customTtl = 30000

      await cache.set('test-key', testData, customTtl)

      const call = mockDb.demoCache.upsert.mock.calls[0][0]
      const expiresAt = call.create.expiresAt
      const expectedMinTime = Date.now() + customTtl - 1000 // Allow 1s tolerance
      const expectedMaxTime = Date.now() + customTtl + 1000

      expect(expiresAt.getTime()).toBeGreaterThan(expectedMinTime)
      expect(expiresAt.getTime()).toBeLessThan(expectedMaxTime)
    })

    it('does nothing when demo mode disabled', async () => {
      process.env.DEMO_MODE_ENABLED = 'false'
      cache = new DemoCache()

      await cache.set('test-key', { test: 'value' })

      expect(mockDb.demoCache.upsert).not.toHaveBeenCalled()
    })

    it('handles database errors gracefully', async () => {
      mockDb.demoCache.upsert.mockRejectedValue(new Error('DB Error'))

      await expect(cache.set('test-key', { test: 'value' })).resolves.not.toThrow()
    })
  })

  describe('delete', () => {
    it('deletes cache entry', async () => {
      await cache.delete('test-key')

      expect(mockDb.demoCache.delete).toHaveBeenCalledWith({
        where: { key: 'test-key' },
      })
    })

    it('does nothing when demo mode disabled', async () => {
      process.env.DEMO_MODE_ENABLED = 'false'
      cache = new DemoCache()

      await cache.delete('test-key')

      expect(mockDb.demoCache.delete).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('deletes all cache entries', async () => {
      await cache.clear()

      expect(mockDb.demoCache.deleteMany).toHaveBeenCalledWith({})
    })

    it('does nothing when demo mode disabled', async () => {
      process.env.DEMO_MODE_ENABLED = 'false'
      cache = new DemoCache()

      await cache.clear()

      expect(mockDb.demoCache.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('removes expired entries', async () => {
      await cache.cleanup()

      expect(mockDb.demoCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it('handles database errors gracefully', async () => {
      mockDb.demoCache.deleteMany.mockRejectedValue(new Error('DB Error'))

      await expect(cache.cleanup()).resolves.not.toThrow()
    })
  })

  describe('singleton behavior', () => {
    it('returns same instance', () => {
      const instance1 = DemoCache.getInstance()
      const instance2 = DemoCache.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})