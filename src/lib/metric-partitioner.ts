/**
 * Metric Partitioning System
 * 
 * The NewForm API returns rows only where ALL requested metrics have values (strict intersection).
 * This causes zero results when mixing metrics with different data availability.
 * 
 * Solution: Partition metrics into logical groups, fetch separately, then outer-join results.
 */

import { ReportConfig } from '@/types';

export interface MetricGroup {
  id: string;
  name: string;
  metrics: string[];
  description: string;
  platform: 'meta' | 'tiktok' | 'both';
}

// Metric groups based on data availability patterns
export const METRIC_GROUPS: MetricGroup[] = [
  {
    id: 'core',
    name: 'Core Metrics',
    description: 'Basic performance metrics available across most configurations',
    platform: 'both',
    metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach', 'frequency']
  },
  {
    id: 'conversions_meta',
    name: 'Conversion Metrics (Meta)',
    description: 'Conversion-related metrics for Meta platform',
    platform: 'meta',
    metrics: ['conversions', 'cost_per_conversion']
    // Note: 'conversion_rate' excluded as it's not available in Meta API
  },
  {
    id: 'conversions_tiktok',
    name: 'Conversion Metrics (TikTok)',
    description: 'Conversion-related metrics for TikTok platform',
    platform: 'tiktok',
    metrics: ['conversions', 'cost_per_conversion', 'conversion_rate']
    // Note: TikTok includes conversion_rate unlike Meta
  },
  {
    id: 'actions',
    name: 'Action Metrics',
    description: 'Meta action-based metrics',
    platform: 'meta',
    metrics: ['actions', 'cost_per_action_type']
  },
  {
    id: 'skan',
    name: 'SKAN Metrics',
    description: 'TikTok SKAdNetwork metrics',
    platform: 'tiktok',
    metrics: ['skan_app_install', 'skan_cost_per_app_install', 'skan_purchase', 'skan_cost_per_purchase']
  }
];

/**
 * Partition requested metrics into logical groups for separate API calls
 */
export function partitionMetrics(
  requestedMetrics: string[], 
  platform: 'meta' | 'tiktok'
): MetricGroup[] {
  const relevantGroups = METRIC_GROUPS.filter(
    group => group.platform === platform || group.platform === 'both'
  );
  
  const partitions: MetricGroup[] = [];
  
  for (const group of relevantGroups) {
    const groupMetrics = requestedMetrics.filter(metric => 
      group.metrics.includes(metric)
    );
    
    if (groupMetrics.length > 0) {
      partitions.push({
        ...group,
        metrics: groupMetrics
      });
    }
  }
  
  return partitions;
}

/**
 * Generate join key for a data row based on time bucket + breakdown fields + level id
 */
export function generateJoinKey(
  row: Record<string, unknown>, 
  config: ReportConfig
): string {
  const keyParts: string[] = [];
  
  // Add time bucket
  if (row.date_start && row.date_stop) {
    keyParts.push(`${row.date_start}-${row.date_stop}`);
  }
  
  // Add breakdown dimensions for Meta
  if (config.platform === 'meta' && config.breakdowns) {
    for (const breakdown of config.breakdowns) {
      if (row[breakdown] !== undefined) {
        keyParts.push(`${breakdown}:${row[breakdown]}`);
      }
    }
  }
  
  // Add dimensions for TikTok
  if (config.platform === 'tiktok' && config.dimensions) {
    for (const dimension of config.dimensions) {
      if (row[dimension] !== undefined) {
        keyParts.push(`${dimension}:${row[dimension]}`);
      }
    }
  }
  
  // Add level-specific identifiers
  const levelFields = {
    'campaign': 'campaign_id',
    'adset': 'adset_id', 
    'ad': 'ad_id',
    'account': 'account_id',
    'AUCTION_CAMPAIGN': 'campaign_id',
    'AUCTION_AD': 'ad_id',
    'AUCTION_ADVERTISER': 'advertiser_id'
  };
  
  const levelField = levelFields[config.level as keyof typeof levelFields];
  if (levelField && row[levelField] !== undefined) {
    keyParts.push(`${levelField}:${row[levelField]}`);
  }
  
  return keyParts.join('|') || 'default';
}

/**
 * Outer join multiple datasets on common keys
 */
export function outerJoinResults(
  datasets: Array<{ groupId: string; data: Record<string, unknown>[] }>,
  config: ReportConfig
): Record<string, unknown>[] {
  // Create a map of all unique join keys
  const allKeys = new Set<string>();
  const keyToRowsMap = new Map<string, Map<string, Record<string, unknown>>>();
  
  // Process each dataset
  for (const dataset of datasets) {
    for (const row of dataset.data) {
      const joinKey = generateJoinKey(row, config);
      allKeys.add(joinKey);
      
      if (!keyToRowsMap.has(joinKey)) {
        keyToRowsMap.set(joinKey, new Map());
      }
      keyToRowsMap.get(joinKey)!.set(dataset.groupId, row);
    }
  }
  
  // Create merged results
  const mergedResults: Record<string, unknown>[] = [];
  
  for (const joinKey of allKeys) {
    const rowsByGroup = keyToRowsMap.get(joinKey)!;
    const mergedRow: Record<string, unknown> = {};
    
    // Start with dimensional data from first available row
    const firstRow = Array.from(rowsByGroup.values())[0];
    
    // Copy dimensional fields (non-metric fields)
    for (const [key, value] of Object.entries(firstRow)) {
      if (!isMetricField(key)) {
        mergedRow[key] = value;
      }
    }
    
    // Merge metrics from all groups
    for (const [groupId, row] of rowsByGroup) {
      const group = METRIC_GROUPS.find(g => g.id === groupId);
      if (group) {
        for (const metric of group.metrics) {
          if (row[metric] !== undefined) {
            mergedRow[metric] = row[metric];
          } else {
            // Set null/missing indicator for unavailable metrics
            mergedRow[metric] = null;
          }
        }
      }
    }
    
    mergedResults.push(mergedRow);
  }
  
  return mergedResults;
}

/**
 * Check if a field is a metric (vs dimensional data)
 */
function isMetricField(fieldName: string): boolean {
  const allMetrics = METRIC_GROUPS.flatMap(group => group.metrics);
  return allMetrics.includes(fieldName);
}

/**
 * Get suggested metric partitions for a configuration
 */
export function getSuggestedPartitions(
  requestedMetrics: string[],
  platform: 'meta' | 'tiktok'
): { 
  partitions: MetricGroup[];
  totalMetrics: number;
  partitionCount: number;
  estimatedCalls: number;
} {
  const partitions = partitionMetrics(requestedMetrics, platform);
  
  return {
    partitions,
    totalMetrics: requestedMetrics.length,
    partitionCount: partitions.length,
    estimatedCalls: partitions.length
  };
}