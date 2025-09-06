import { validateCronExpression, describeCronExpression, getNextCronExecution, getCronExpressionForCadence } from '../utils/cron-utils';

describe('Cron Utils', () => {
  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const result = validateCronExpression('0 9 * * 1');
      expect(result.isValid).toBe(true);
      expect(result.nextRunDates).toHaveLength(3);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid cron expressions', () => {
      const result = validateCronExpression('invalid cron');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.nextRunDates).toBeUndefined();
    });

    it('should reject empty expressions', () => {
      const result = validateCronExpression('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Cron expression is required');
    });
  });

  describe('describeCronExpression', () => {
    it('should describe hourly expressions', () => {
      const description = describeCronExpression('0 * * * *');
      expect(description).toBe('Every hour');
    });

    it('should describe daily expressions', () => {
      const description = describeCronExpression('0 9 * * *');
      expect(description).toBe('Daily at 9:00');
    });

    it('should describe weekly expressions', () => {
      const description = describeCronExpression('0 9 * * 1');
      expect(description).toBe('Weekly on Monday at 9:00');
    });

    it('should describe monthly expressions', () => {
      const description = describeCronExpression('0 8 1 * *');
      expect(description).toBe('Monthly on 1st at 8:00');
    });

    it('should handle invalid expressions', () => {
      const description = describeCronExpression('invalid');
      expect(description).toBe('Invalid cron expression');
    });
  });

  describe('getNextCronExecution', () => {
    it('should return next execution date for valid expression', () => {
      const nextRun = getNextCronExecution('0 9 * * 1'); // Every Monday at 9 AM
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid expression', () => {
      const nextRun = getNextCronExecution('invalid');
      expect(nextRun).toBeNull();
    });
  });

  describe('getCronExpressionForCadence', () => {
    it('should return correct expressions for built-in cadences', () => {
      expect(getCronExpressionForCadence('hourly')).toBe('0 * * * *');
      expect(getCronExpressionForCadence('12hours')).toBe('0 */12 * * *');
      expect(getCronExpressionForCadence('daily')).toBe('0 9 * * *');
      expect(getCronExpressionForCadence('weekly')).toBe('0 9 * * 1');
      expect(getCronExpressionForCadence('monthly')).toBe('0 9 1 * *');
    });

    it('should return null for invalid cadences', () => {
      expect(getCronExpressionForCadence('invalid')).toBeNull();
      expect(getCronExpressionForCadence('manual')).toBeNull();
      expect(getCronExpressionForCadence('custom')).toBeNull();
    });
  });
});