/**
 * Level-Dimension Mapping for Meta and TikTok
 * 
 * Defines which dimensions/breakdowns are valid for each reporting level.
 * This prevents users from selecting incompatible combinations that would return no data.
 */

// Meta breakdowns that work for different levels
export const META_LEVEL_BREAKDOWNS = {
  'account': [
    'age', 'gender', 'country', 'region', 'impression_device', 
    'platform_position', 'publisher_platform'
  ],
  'campaign': [
    'age', 'gender', 'country', 'region', 'dma', 
    'impression_device', 'platform_position', 'publisher_platform'
  ],
  'adset': [
    'age', 'gender', 'country', 'impression_device', 
    'platform_position', 'publisher_platform'
  ],
  'ad': [
    'age', 'gender', 'impression_device', 'publisher_platform'
  ]
};

// TikTok dimensions that work for different levels
export const TIKTOK_LEVEL_DIMENSIONS = {
  'AUCTION_ADVERTISER': ['advertiser_id'],
  'AUCTION_CAMPAIGN': ['campaign_id', 'stat_time_day', 'country_code'],
  'AUCTION_AD': ['ad_id', 'stat_time_day', 'country_code']
};

/**
 * Get valid breakdowns for a Meta level
 */
export function getValidMetaBreakdowns(level: string): string[] {
  return META_LEVEL_BREAKDOWNS[level as keyof typeof META_LEVEL_BREAKDOWNS] || [];
}

/**
 * Get valid dimensions for a TikTok level
 */
export function getValidTikTokDimensions(level: string): string[] {
  return TIKTOK_LEVEL_DIMENSIONS[level as keyof typeof TIKTOK_LEVEL_DIMENSIONS] || [];
}

/**
 * Check if a breakdown is valid for a Meta level
 */
export function isValidMetaBreakdown(level: string, breakdown: string): boolean {
  const validBreakdowns = getValidMetaBreakdowns(level);
  return validBreakdowns.includes(breakdown);
}

/**
 * Check if a dimension is valid for a TikTok level
 */
export function isValidTikTokDimension(level: string, dimension: string): boolean {
  const validDimensions = getValidTikTokDimensions(level);
  return validDimensions.includes(dimension);
}

/**
 * Get dimension/breakdown labels for display
 */
export const DIMENSION_LABELS = {
  // TikTok dimensions
  'advertiser_id': 'Advertiser ID',
  'campaign_id': 'Campaign ID', 
  'ad_id': 'Ad ID',
  'stat_time_day': 'Daily Breakdown',
  'country_code': 'Country',
  
  // Meta breakdowns
  'age': 'Age',
  'gender': 'Gender',
  'country': 'Country',
  'region': 'Region',
  'dma': 'DMA (Designated Market Area)',
  'impression_device': 'Device',
  'platform_position': 'Platform Position',
  'publisher_platform': 'Publisher Platform'
};

/**
 * Get display label for a dimension/breakdown
 */
export function getDimensionLabel(dimension: string): string {
  return DIMENSION_LABELS[dimension as keyof typeof DIMENSION_LABELS] || dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}