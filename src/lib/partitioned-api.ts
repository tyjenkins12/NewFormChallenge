/**
 * Partitioned API Layer
 * 
 * Uses metric partitioning to fetch data in separate calls and outer-join results.
 * This prevents zero results when some metrics don't have data for certain time/level combinations.
 */

import { ReportConfig } from '@/types';
import { partitionMetrics, outerJoinResults, generateJoinKey } from './metric-partitioner';

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

export interface PartitionedFetchResult {
  data: Record<string, unknown>[];
  partitionsUsed: number;
  partitionResults: Array<{
    groupId: string;
    metrics: string[];
    recordCount: number;
    success: boolean;
    error?: string;
  }>;
  totalRecords: number;
}

/**
 * Fetch ad data using metric partitioning to avoid zero results from missing metrics
 */
export async function fetchAdDataPartitioned(config: ReportConfig): Promise<PartitionedFetchResult> {
  console.log('🔀 Starting partitioned fetch for metrics:', config.metrics);
  
  // Partition metrics into logical groups
  const partitions = partitionMetrics(config.metrics, config.platform);
  
  if (partitions.length === 0) {
    console.log('❌ No valid metric partitions found');
    return {
      data: [],
      partitionsUsed: 0,
      partitionResults: [],
      totalRecords: 0
    };
  }
  
  console.log(`📊 Created ${partitions.length} metric partitions:`, 
    partitions.map(p => `${p.name} (${p.metrics.join(', ')})`));
  
  // Fetch data for each partition
  const datasets: Array<{ groupId: string; data: Record<string, unknown>[] }> = [];
  const partitionResults: PartitionedFetchResult['partitionResults'] = [];
  
  for (const partition of partitions) {
    try {
      console.log(`📡 Fetching ${partition.name}:`, partition.metrics);
      
      const partitionConfig = { ...config, metrics: partition.metrics };
      const partitionData = await fetchSinglePartition(partitionConfig);
      
      datasets.push({
        groupId: partition.id,
        data: partitionData
      });
      
      partitionResults.push({
        groupId: partition.id,
        metrics: partition.metrics,
        recordCount: partitionData.length,
        success: true
      });
      
      console.log(`✅ ${partition.name}: ${partitionData.length} records`);
      
    } catch (error) {
      console.error(`❌ Failed to fetch ${partition.name}:`, error);
      
      partitionResults.push({
        groupId: partition.id,
        metrics: partition.metrics,
        recordCount: 0,
        success: false,
        error: String(error)
      });
    }
  }
  
  // Outer join all datasets
  console.log('🔗 Performing outer join on datasets...');
  const mergedData = outerJoinResults(datasets, config);
  console.log(`✨ Merged result: ${mergedData.length} records`);
  
  return {
    data: mergedData,
    partitionsUsed: partitions.length,
    partitionResults,
    totalRecords: mergedData.length
  };
}

/**
 * Fetch data for a single metric partition
 */
async function fetchSinglePartition(config: ReportConfig): Promise<Record<string, unknown>[]> {
  const endpoint = config.platform === 'meta' ? '/sample-data/meta' : '/sample-data/tiktok';
  
  const body: Record<string, unknown> = {
    metrics: config.metrics,
    level: config.level,
    dateRangeEnum: config.dateRangeEnum,
  };

  if (config.platform === 'meta') {
    // Always include a basic breakdown for Meta to match working patterns
    if (config.breakdowns?.length) {
      body.breakdowns = config.breakdowns;
    } else {
      body.breakdowns = ['age']; // Default reliable breakdown
    }
    body.timeIncrement = config.timeIncrement || '7';
  } else if (config.platform === 'tiktok') {
    // TikTok requires dimensions - use selected ones or level-appropriate defaults
    if (config.dimensions?.length) {
      body.dimensions = config.dimensions;
    } else {
      // Set default dimensions based on level
      if (config.level === 'AUCTION_ADVERTISER') {
        body.dimensions = ['advertiser_id'];
      } else if (config.level === 'AUCTION_AD') {
        body.dimensions = ['ad_id'];
      } else { // AUCTION_CAMPAIGN
        body.dimensions = ['campaign_id'];
      }
    }
    // Add reportType for TikTok
    body.reportType = config.reportType || 'BASIC';
  }

  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${TOKEN}`,
    },
    body: JSON.stringify(body),
    redirect: 'follow',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const apiResponse = await response.json();
  
  // Handle API response format - extract data property if it exists
  const data = apiResponse.data || apiResponse;
  const dataArray = Array.isArray(data) ? data : [];
  
  // Transform TikTok nested format to flat format
  if (config.platform === 'tiktok') {
    const transformedData = dataArray.map(item => {
      const flatItem: Record<string, unknown> = {};
      
      // Flatten metrics object to top level
      if (item.metrics && typeof item.metrics === 'object') {
        Object.entries(item.metrics).forEach(([key, value]) => {
          // Ensure we're storing primitive values, not objects
          if (typeof value === 'object' && value !== null) {
            console.log(`🔍 Complex metric detected - ${key}:`, JSON.stringify(value, null, 2));
            
            // Special handling for actions metric (often an array of action objects)
            if (key === 'actions' && Array.isArray(value)) {
              // Sum up all action values or get the first meaningful number
              const totalActions = value.reduce((sum, action) => {
                if (typeof action === 'number') return sum + action;
                if (typeof action === 'object' && action !== null) {
                  if ('value' in action && typeof action.value === 'number') return sum + action.value;
                  if ('count' in action && typeof action.count === 'number') return sum + action.count;
                  if ('total' in action && typeof action.total === 'number') return sum + action.total;
                }
                return sum;
              }, 0);
              flatItem[key] = totalActions;
            }
            // Special handling for cost_per_action_type (often an object with action types)
            else if (key === 'cost_per_action_type' && typeof value === 'object') {
              // Try to get a meaningful cost value
              if ('value' in value) {
                flatItem[key] = value.value;
              } else if ('cost' in value) {
                flatItem[key] = value.cost;
              } else if ('average' in value) {
                flatItem[key] = value.average;
              } else {
                // If it's an object with multiple action types, take the first numeric value
                const firstNumericValue = Object.values(value).find(v => typeof v === 'number');
                flatItem[key] = firstNumericValue || 0;
              }
            }
            // Generic object handling
            else if ('value' in value) {
              flatItem[key] = value.value;
            } else if ('total' in value) {
              flatItem[key] = value.total;
            } else if ('count' in value) {
              flatItem[key] = value.count;
            } else if ('amount' in value) {
              flatItem[key] = value.amount;
            } else {
              // For completely unknown structures, try to extract first numeric value
              const numericValue = Object.values(value).find(v => typeof v === 'number');
              flatItem[key] = numericValue || 0;
              console.log(`⚠️  Unknown object structure for ${key}, using fallback value:`, numericValue || 0);
            }
          } else {
            flatItem[key] = value;
          }
        });
      }
      
      // Flatten dimensions object to top level
      if (item.dimensions && typeof item.dimensions === 'object') {
        Object.entries(item.dimensions).forEach(([key, value]) => {
          // Ensure we're storing primitive values, not objects
          if (typeof value === 'object' && value !== null) {
            // If it's still an object, convert to string
            flatItem[key] = String(value);
          } else {
            flatItem[key] = value;
          }
        });
      }
      
      // Keep any other properties at top level
      Object.entries(item).forEach(([key, value]) => {
        if (key !== 'metrics' && key !== 'dimensions') {
          flatItem[key] = value;
        }
      });
      
      return flatItem;
    });
    
    return transformedData;
  }
  
  // Transform Meta data to handle complex objects like actions and cost_per_action_type
  if (config.platform === 'meta') {
    const transformedData = dataArray.map(item => {
      const flatItem: Record<string, unknown> = { ...item };
      
      // Handle complex Meta metrics
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          console.log(`🔍 Complex Meta metric detected - ${key}:`, JSON.stringify(value, null, 2));
          
          // Special handling for actions (array of action objects)
          if (key === 'actions' && Array.isArray(value)) {
            // Store the full actions array for later analysis
            flatItem['_actions_breakdown'] = value;
            
            const totalActions = value.reduce((sum, action) => {
              if (typeof action === 'number') return sum + action;
              if (typeof action === 'object' && action !== null) {
                if ('value' in action) {
                  const numValue = typeof action.value === 'string' ? parseFloat(action.value) : action.value;
                  return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
                }
                if ('count' in action) {
                  const numValue = typeof action.count === 'string' ? parseFloat(action.count) : action.count;
                  return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
                }
                if ('total' in action) {
                  const numValue = typeof action.total === 'string' ? parseFloat(action.total) : action.total;
                  return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
                }
              }
              return sum;
            }, 0);
            flatItem[key] = totalActions;
          }
          // Special handling for cost_per_action_type
          else if (key === 'cost_per_action_type' && Array.isArray(value)) {
            // Store the full cost_per_action_type array for later analysis
            flatItem['_cost_per_action_breakdown'] = value;
            
            // If it's an array, sum up or average the costs
            const costs = value
              .map(cost => {
                if (typeof cost === 'number') return cost;
                if (typeof cost === 'object' && cost !== null) {
                  if ('value' in cost) {
                    const numValue = typeof cost.value === 'string' ? parseFloat(cost.value) : cost.value;
                    return typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0;
                  }
                  if ('cost' in cost) {
                    const numValue = typeof cost.cost === 'string' ? parseFloat(cost.cost) : cost.cost;
                    return typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0;
                  }
                  if ('average' in cost) {
                    const numValue = typeof cost.average === 'string' ? parseFloat(cost.average) : cost.average;
                    return typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0;
                  }
                }
                return 0;
              })
              .filter(cost => cost > 0);
            
            flatItem[key] = costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0;
          }
          else if (key === 'cost_per_action_type' && typeof value === 'object') {
            // Handle as object
            if ('value' in value) {
              flatItem[key] = value.value;
            } else if ('cost' in value) {
              flatItem[key] = value.cost;
            } else if ('average' in value) {
              flatItem[key] = value.average;
            } else {
              const firstNumericValue = Object.values(value).find(v => typeof v === 'number');
              flatItem[key] = firstNumericValue || 0;
            }
          }
        }
      });
      
      return flatItem;
    });
    
    return transformedData;
  }
  
  // Return array as-is for other platforms 
  return dataArray;
}

/**
 * Compare partitioned vs non-partitioned results for debugging
 */
export async function comparePartitionedVsRegular(
  config: ReportConfig
): Promise<{
  partitioned: PartitionedFetchResult;
  regular: { success: boolean; recordCount: number; error?: string };
  comparison: {
    partitionedWins: boolean;
    recordCountDifference: number;
    analysis: string;
  };
}> {
  console.log('🔬 Comparing partitioned vs regular fetch...');
  
  // Try partitioned approach
  const partitioned = await fetchAdDataPartitioned(config);
  
  // Try regular approach (should fail with mixed metrics)
  let regular: { success: boolean; recordCount: number; error?: string };
  try {
    const regularData = await fetchSinglePartition(config);
    regular = {
      success: true,
      recordCount: regularData.length
    };
  } catch (error) {
    regular = {
      success: false,
      recordCount: 0,
      error: String(error)
    };
  }
  
  const comparison = {
    partitionedWins: partitioned.totalRecords > regular.recordCount,
    recordCountDifference: partitioned.totalRecords - regular.recordCount,
    analysis: partitioned.totalRecords > regular.recordCount 
      ? 'Partitioned approach successfully retrieved data where regular approach failed'
      : partitioned.totalRecords === regular.recordCount 
        ? 'Both approaches returned same results'
        : 'Regular approach performed better (unexpected)'
  };
  
  console.log('📊 Comparison result:', comparison.analysis);
  
  return { partitioned, regular, comparison };
}