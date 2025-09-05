import { generateSlug, formatDuration, truncateString, isValidCron } from '@/lib/utils'

describe('Utils', () => {
  describe('generateSlug', () => {
    it('generates slug of default length', () => {
      const slug = generateSlug()
      expect(slug).toHaveLength(8)
      expect(slug).toMatch(/^[a-z0-9]+$/)
    })

    it('generates slug of custom length', () => {
      const slug = generateSlug(12)
      expect(slug).toHaveLength(12)
      expect(slug).toMatch(/^[a-z0-9]+$/)
    })

    it('generates unique slugs', () => {
      const slug1 = generateSlug()
      const slug2 = generateSlug()
      expect(slug1).not.toBe(slug2)
    })
  })

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(999)).toBe('999ms')
    })

    it('formats seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s')
      expect(formatDuration(1500)).toBe('1.5s')
      expect(formatDuration(59999)).toBe('60.0s')
    })

    it('formats minutes', () => {
      expect(formatDuration(60000)).toBe('1.0m')
      expect(formatDuration(90000)).toBe('1.5m')
      expect(formatDuration(300000)).toBe('5.0m')
    })
  })

  describe('truncateString', () => {
    it('returns original string if shorter than limit', () => {
      expect(truncateString('short', 10)).toBe('short')
    })

    it('truncates string and adds ellipsis', () => {
      expect(truncateString('this is a long string', 10)).toBe('this is a ...')
    })

    it('handles exact length', () => {
      expect(truncateString('exactly10c', 10)).toBe('exactly10c')
    })
  })

  describe('isValidCron', () => {
    it('validates correct cron expressions', () => {
      expect(isValidCron('0 9 * * 1')).toBe(true)
      expect(isValidCron('*/15 * * * *')).toBe(true)
      expect(isValidCron('0 0 1 1 *')).toBe(true)
    })

    it('rejects invalid cron expressions', () => {
      expect(isValidCron('invalid')).toBe(false)
      expect(isValidCron('60 * * * *')).toBe(false)
      expect(isValidCron('* 24 * * *')).toBe(false)
      expect(isValidCron('* * 32 * *')).toBe(false)
    })
  })
})