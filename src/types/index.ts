export interface ReportConfig {
  id?: string;
  platform: 'meta' | 'tiktok';
  metrics: string[];
  level: string;
  breakdowns?: string[]; // For Meta
  dimensions?: string[]; // For TikTok
  dateRangeEnum: 'last7' | 'last14' | 'last30' | 'lifetime';
  cadence: 'manual' | 'hourly' | '12hours' | 'daily';
  delivery: 'email' | 'link';
  email?: string;
  pdfAttachment?: boolean;
  timeIncrement?: string; // For Meta
  reportType?: 'BASIC' | 'AUDIENCE'; // For TikTok
  demoMode?: {
    enabled: boolean;
    accelerated: boolean;
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
  pdfPath?: string;
  pdfUrl?: string;
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
  'spend', 'impressions', 'clicks', 'conversions', 'cost_per_conversion',
  'conversion_rate', 'ctr', 'cpc', 'reach', 'frequency', 'skan_app_install',
  'skan_cost_per_app_install', 'skan_purchase', 'skan_cost_per_purchase'
];

export const TIKTOK_DIMENSIONS = [
  'ad_id', 'campaign_id', 'adgroup_id', 'advertiser_id', 'stat_time_day',
  'campaign_name', 'adgroup_name', 'ad_name', 'country_code', 'age',
  'gender', 'province_id', 'dma_id'
];

export const TIKTOK_LEVELS = [
  'AUCTION_ADVERTISER', 'AUCTION_AD', 'AUCTION_CAMPAIGN'
];

export const META_METRICS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 'frequency',
  'conversions', 'cost_per_conversion', 'conversion_rate', 'actions',
  'cost_per_action_type'
];

export const META_BREAKDOWNS = [
  'age', 'gender', 'country', 'region', 'dma', 'impression_device',
  'platform_position', 'publisher_platform'
];

export const META_LEVELS = ['account', 'campaign', 'adset', 'ad'];

export const DATE_RANGES = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'lifetime', label: 'Lifetime' }
];

export const CADENCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'hourly', label: 'Hourly' },
  { value: '12hours', label: 'Every 12 hours' },
  { value: 'daily', label: 'Daily' }
];