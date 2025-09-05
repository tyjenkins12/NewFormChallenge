import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function truncateString(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function isValidCron(expression: string): boolean {
  const parts = expression.split(' ')
  if (parts.length !== 5) return false
  
  const [minute, hour, day, month, weekday] = parts
  
  // Simple validation - allow * and basic ranges
  const isValidPart = (part: string, min: number, max: number) => {
    if (part === '*') return true
    if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2))
      return step >= 1 && step <= max
    }
    const num = parseInt(part)
    return num >= min && num <= max
  }
  
  return isValidPart(minute, 0, 59) &&
         isValidPart(hour, 0, 23) &&
         isValidPart(day, 1, 31) &&
         isValidPart(month, 1, 12) &&
         isValidPart(weekday, 0, 6)
}