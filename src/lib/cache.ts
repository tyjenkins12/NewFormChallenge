import { db } from './db'

export class DemoCache {
  private static instance: DemoCache
  private enabled: boolean

  constructor() {
    this.enabled = process.env.DEMO_MODE_ENABLED === 'true'
  }

  static getInstance(): DemoCache {
    if (!DemoCache.instance) {
      DemoCache.instance = new DemoCache()
    }
    return DemoCache.instance
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null

    try {
      const cached = await db.demoCache.findUnique({
        where: { key },
      })

      if (!cached || cached.expiresAt < new Date()) {
        if (cached) {
          await db.demoCache.delete({ where: { key } })
        }
        return null
      }

      return cached.data as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    if (!this.enabled) return

    const defaultTtl = parseInt(process.env.DEMO_CACHE_DURATION_MS || '600000')
    const expiresAt = new Date(Date.now() + (ttlMs || defaultTtl))

    try {
      await db.demoCache.upsert({
        where: { key },
        update: {
          data: data as any,
          expiresAt,
        },
        create: {
          key,
          data: data as any,
          expiresAt,
        },
      })
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) return

    try {
      await db.demoCache.delete({ where: { key } })
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  async clear(): Promise<void> {
    if (!this.enabled) return

    try {
      await db.demoCache.deleteMany({})
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  async cleanup(): Promise<void> {
    try {
      await db.demoCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }
}

export const demoCache = DemoCache.getInstance()