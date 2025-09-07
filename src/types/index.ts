export interface ReportConfig {
  id?: string;
  platform: 'meta' | 'tiktok';
  metrics: string[];
  level: string;
  breakdowns?: string[]; // For Meta
  dimensions?: string[]; // For TikTok
  dateRangeEnum: 'last7' | 'last14' | 'last30' | 'lifetime';
  cadence: 'manual' | 'hourly' | '12hours' | 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression?: string; // For custom cadence
  delivery: 'email' | 'link';
  email?: string;
  pdfAttachment?: boolean;
  timeIncrement?: string; // For Meta
  reportType?: 'BASIC' | 'AUDIENCE'; // For TikTok
  demoMode?: {
    enabled: boolean;
    accelerated: boolean;
  };
  tokenSettings?: {
    enabled: boolean;
    expirationHours?: number;
    allowRefresh?: boolean;
  };
}

export interface ReportRun {
  id: string;
  configId: string;
  timestamp: Date;
  status: 'success' | 'error' | 'running';
  error?: string;
  reportPath?: string;
  reportUrl?: string;
  signedUrl?: string;
  pdfPath?: string;
  pdfUrl?: string;
  signedPdfUrl?: string;
}

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  lastError?: string;
  reportPath?: string;
  pdfPath?: string;
}

// Platform-specific parameters
export const TIKTOK_METRICS = [
  'spend', 'impressions', 'clicks', 'cost_per_conversion',
  'conversion_rate', 'ctr', 'cpc', 'reach', 'frequency', 'skan_app_install',
  'skan_cost_per_app_install', 'skan_purchase', 'skan_cost_per_purchase'
];

export const TIKTOK_DIMENSIONS = [
  'ad_id', 'campaign_id', 'advertiser_id', 'stat_time_day', 'country_code'
];

export const TIKTOK_LEVELS = [
  'AUCTION_ADVERTISER', 'AUCTION_AD', 'AUCTION_CAMPAIGN'
];

export const META_METRICS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 'frequency',
  'conversions', 'cost_per_conversion', 'actions', 'cost_per_action_type'
  // Note: 'conversion_rate' removed as it's not available in the NewForm API
];

export const META_BREAKDOWNS = [
  'age', 'gender', 'country', 'region', 'dma', 'impression_device',
  'platform_position', 'publisher_platform'
];

export const META_LEVELS = ['campaign', 'adset', 'ad', 'account']; // Move most reliable option first

export const DATE_RANGES = [
  { value: 'last30', label: 'Last 30 days' }, // Move most reliable option first
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'lifetime', label: 'Lifetime' }
];

export const CADENCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'hourly', label: 'Hourly' },
  { value: '12hours', label: 'Every 12 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (Cron Expression)' }
];

// Preset cron expressions for common scheduling patterns
export const CRON_PRESETS = [
  { label: 'Every Monday at 9 AM', expression: '0 9 * * 1', description: 'Weekly on Monday' },
  { label: 'Every Friday at 5 PM', expression: '0 17 * * 5', description: 'Weekly on Friday' },
  { label: 'First day of month at 8 AM', expression: '0 8 1 * *', description: 'Monthly' },
  { label: 'Every weekday at 10 AM', expression: '0 10 * * 1-5', description: 'Monday to Friday' },
  { label: 'Every 6 hours', expression: '0 */6 * * *', description: 'Every 6 hours' },
  { label: 'Twice daily (9 AM & 6 PM)', expression: '0 9,18 * * *', description: '9 AM and 6 PM daily' }
];