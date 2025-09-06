const cronParser = require('cron-parser');

/**
 * Validates a cron expression and returns validation result
 */
export interface CronValidationResult {
  isValid: boolean;
  error?: string;
  nextRunDates?: Date[];
}

export function validateCronExpression(expression: string): CronValidationResult {
  if (!expression || expression.trim() === '') {
    return { isValid: false, error: 'Cron expression is required' };
  }

  try {
    const interval = cronParser.default.parse(expression);
    const nextRunDates: Date[] = [];
    
    // Get next 3 execution times to show user
    for (let i = 0; i < 3; i++) {
      nextRunDates.push(interval.next().toDate());
    }

    return {
      isValid: true,
      nextRunDates
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    };
  }
}

/**
 * Gets the next execution time for a cron expression
 */
export function getNextCronExecution(expression: string): Date | null {
  try {
    const interval = cronParser.default.parse(expression);
    return interval.next().toDate();
  } catch (error) {
    console.error('Error parsing cron expression:', error);
    return null;
  }
}

/**
 * Gets default cron expressions for built-in cadences
 */
export function getCronExpressionForCadence(cadence: string): string | null {
  switch (cadence) {
    case 'hourly':
      return '0 * * * *'; // Every hour
    case '12hours':
      return '0 */12 * * *'; // Every 12 hours
    case 'daily':
      return '0 9 * * *'; // Daily at 9 AM
    case 'weekly':
      return '0 9 * * 1'; // Weekly on Monday at 9 AM
    case 'monthly':
      return '0 9 1 * *'; // Monthly on 1st day at 9 AM
    default:
      return null;
  }
}

/**
 * Describes a cron expression in human-readable format
 */
export function describeCronExpression(expression: string): string {
  try {
    // Use cron-parser to validate and get next execution
    const interval = cronParser.default.parse(expression);
    const next = interval.next().toDate();
    
    // Basic description based on common patterns
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return 'Custom schedule';
    }
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Handle common patterns
    if (minute === '0' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every hour';
    }
    
    if (minute === '0' && hour.includes('*/') && day === '*' && month === '*' && dayOfWeek === '*') {
      const interval = hour.replace('*/', '');
      return `Every ${interval} hours`;
    }
    
    if (minute === '0' && !hour.includes('*') && day === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour}:00`;
    }
    
    if (minute === '0' && !hour.includes('*') && day === '*' && month === '*' && !dayOfWeek.includes('*')) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dayOfWeek.includes('-')) {
        return `Weekdays at ${hour}:00`;
      } else if (dayOfWeek.includes(',')) {
        return `Multiple days at ${hour}:00`;
      } else {
        const dayName = days[parseInt(dayOfWeek)] || 'Unknown day';
        return `Weekly on ${dayName} at ${hour}:00`;
      }
    }
    
    if (minute === '0' && !hour.includes('*') && day === '1' && month === '*' && dayOfWeek === '*') {
      return `Monthly on 1st at ${hour}:00`;
    }
    
    return `Next run: ${next.toLocaleString()}`;
  } catch (error) {
    return 'Invalid cron expression';
  }
}

/**
 * Calculates time until next cron execution in milliseconds
 */
export function getTimeUntilNextCron(expression: string): number | null {
  const nextExecution = getNextCronExecution(expression);
  if (!nextExecution) return null;
  
  return nextExecution.getTime() - Date.now();
}