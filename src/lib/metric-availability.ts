/**
 * Metric availability mapping based on comprehensive API testing
 * 
 * Key finding: The NewForm API follows an ALL-OR-NOTHING approach:
 * - If ANY requested metric is unavailable, the entire request returns 0 results
 * - This means we need to filter out unsupported metrics before making requests
 */

export interface MetricAvailability {
  platform: 'meta' | 'tiktok';
  level: string;
  dateRange: string;
  availableMetrics: string[];
  unavailableMetrics: string[];
}

// Based on testing results from quick-metric-test.sh
export const METRIC_AVAILABILITY: MetricAvailability[] = [
  // Meta Campaign Level - Most comprehensive
  {
    platform: 'meta',
    level: 'campaign',
    dateRange: 'all', // Works for all date ranges
    availableMetrics: [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 
      'frequency', 'conversions', 'cost_per_conversion', 'actions', 
      'cost_per_action_type'
    ],
    unavailableMetrics: ['conversion_rate']
  },
  
  // Meta Adset Level - Most metrics work
  {
    platform: 'meta',
    level: 'adset',
    dateRange: 'all',
    availableMetrics: [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 
      'frequency', 'conversions', 'cost_per_conversion'
    ],
    unavailableMetrics: ['conversion_rate']
  },
  
  // TikTok Campaign Level - Includes conversion_rate (unlike Meta)
  {
    platform: 'tiktok',
    level: 'AUCTION_CAMPAIGN',
    dateRange: 'all',
    availableMetrics: [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 
      'frequency', 'conversion_rate'
    ],
    unavailableMetrics: []
  }
];

/**
 * Get available metrics for a specific platform and level
 */
export function getAvailableMetrics(platform: 'meta' | 'tiktok', level: string): string[] {
  const config = METRIC_AVAILABILITY.find(
    config => config.platform === platform && config.level === level
  );
  
  if (!config) {
    // Fallback to safe defaults
    if (platform === 'meta') {
      return ['spend', 'impressions', 'clicks', 'ctr'];
    } else {
      return ['spend', 'impressions', 'clicks', 'ctr'];
    }
  }
  
  return config.availableMetrics;
}

/**
 * Filter out unavailable metrics from a metric list
 */
export function filterAvailableMetrics(
  metrics: string[], 
  platform: 'meta' | 'tiktok', 
  level: string
): string[] {
  const availableMetrics = getAvailableMetrics(platform, level);
  return metrics.filter(metric => availableMetrics.includes(metric));
}

/**
 * Check if a metric combination will work
 */
export function validateMetricCombination(
  metrics: string[], 
  platform: 'meta' | 'tiktok', 
  level: string,
  dimensions?: string[]
): { valid: boolean; unavailableMetrics: string[]; dimensionIssues?: string[] } {
  const availableMetrics = getAvailableMetrics(platform, level);
  const unavailableMetrics = metrics.filter(metric => !availableMetrics.includes(metric));
  
  let dimensionIssues: string[] = [];
  
  // Validate TikTok dimensions for level compatibility
  if (platform === 'tiktok' && dimensions && dimensions.length > 0) {
    const levelDimensionMap = {
      'AUCTION_ADVERTISER': ['advertiser_id'],
      'AUCTION_CAMPAIGN': ['campaign_id'],
      'AUCTION_AD': ['ad_id']
    };
    
    const validDimensions = levelDimensionMap[level as keyof typeof levelDimensionMap] || [];
    const invalidDimensions = dimensions.filter(dim => !validDimensions.includes(dim));
    
    if (invalidDimensions.length > 0) {
      dimensionIssues = [`For ${level} level, use ${validDimensions.join(' or ')} instead of ${invalidDimensions.join(', ')}`];
    }
  }
  
  return {
    valid: unavailableMetrics.length === 0 && dimensionIssues.length === 0,
    unavailableMetrics,
    dimensionIssues: dimensionIssues.length > 0 ? dimensionIssues : undefined
  };
}

/**
 * Get suggested alternative metrics when some are unavailable
 */
export function getSuggestedMetrics(
  requestedMetrics: string[], 
  platform: 'meta' | 'tiktok', 
  level: string
): string[] {
  const availableMetrics = getAvailableMetrics(platform, level);
  const validRequested = requestedMetrics.filter(metric => availableMetrics.includes(metric));
  
  // If we have valid metrics, return them
  if (validRequested.length > 0) {
    return validRequested;
  }
  
  // Otherwise, return safe defaults
  if (platform === 'meta') {
    return ['spend', 'impressions', 'clicks', 'ctr'];
  } else {
    return ['spend', 'impressions', 'clicks', 'ctr'];
  }
}

/**
 * Enhanced metric lists that only include verified working metrics
 */
export const VERIFIED_META_METRICS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 
  'frequency', 'conversions', 'cost_per_conversion'
  // Note: 'conversion_rate' is excluded as it's not available in the API
];

export const VERIFIED_TIKTOK_METRICS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 
  'frequency', 'conversion_rate'
  // Note: TikTok actually has conversion_rate available (unlike Meta)
];