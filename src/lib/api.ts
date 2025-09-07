import { ReportConfig } from '@/types';
import { fetchAdDataPartitioned } from './partitioned-api';

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

export async function fetchAdData(config: ReportConfig, usePartitioning: boolean = true): Promise<Record<string, unknown>[]> {
  // Use partitioned approach by default to handle mixed metric availability
  if (usePartitioning) {
    console.log('🔀 Using partitioned API approach for robust data fetching');
    const result = await fetchAdDataPartitioned(config);
    
    if (result.totalRecords > 0) {
      console.log(`✅ Partitioned fetch successful: ${result.totalRecords} records from ${result.partitionsUsed} partitions`);
      return result.data;
    } else {
      console.log('⚠️ Partitioned fetch returned no data, falling back to regular approach');
      // Fall back to regular approach
    }
  }

  // Original single-request approach (fallback)
  console.log('📡 Using original single-request API approach');
  const endpoint = config.platform === 'meta' ? '/sample-data/meta' : '/sample-data/tiktok';
  
  const body: Record<string, unknown> = {
    metrics: config.metrics,
    level: config.level,
    dateRangeEnum: config.dateRangeEnum, // Keep original format: "last30", "last14", etc.
  };

  if (config.platform === 'meta') {
    if (config.breakdowns?.length) {
      body.breakdowns = config.breakdowns;
    }
    // Add default timeIncrement for Meta if not provided
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

  console.log('Fetching from NewForm API:', endpoint);
  console.log('Request payload:', JSON.stringify(body, null, 2));

  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${TOKEN}`,
    },
    body: JSON.stringify(body),
    redirect: 'follow', // Equivalent to curl --location flag
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('NewForm API Error:', response.status, response.statusText, errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const apiResponse = await response.json();
  console.log(`API response received with ${apiResponse.data?.length || 0} records`);
  
  // Handle API response format - extract data property if it exists
  const data = apiResponse.data || apiResponse;
  
  // Check if data is empty and provide helpful info
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log(`No data available for: ${config.platform} ${config.level} level, ${config.dateRangeEnum} date range`);
    
    // Provide specific suggestions based on current config
    const suggestions = [];
    if (config.level !== 'campaign') {
      suggestions.push("Try 'campaign' level");
    }
    if (config.dateRangeEnum !== 'last30') {
      suggestions.push("Try 'last30' date range");
    }
    if (config.platform === 'meta' && config.breakdowns && config.breakdowns.length > 1) {
      suggestions.push("Try fewer breakdowns (like just 'age')");
    }
    
    if (suggestions.length > 0) {
      console.log(`Suggestions: ${suggestions.join(', ')}`);
    }
    
    // Still return empty array - the report generator will handle this gracefully
    return [];
  }
  
  const dataArray = Array.isArray(data) ? data : [];
  
  // Transform TikTok nested format to flat format expected by report generator
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
    
    // Filter out records where all selected metrics are zero
    const filteredData = transformedData.filter(item => {
      return config.metrics.some(metric => {
        const value = parseFloat(String(item[metric])) || 0;
        return value > 0;
      });
    });
    
    console.log(`TikTok data: ${dataArray.length} total records, ${filteredData.length} with non-zero values`);
    return filteredData;
  }
  
  // Transform Meta data to handle complex objects like actions and cost_per_action_type
  if (config.platform === 'meta') {
    console.log('🔧 API Transform: Meta platform detected, processing data...');
    console.log('🔧 API Transform: Data array length:', dataArray.length);
    console.log('🔧 API Transform: First item structure:', dataArray[0] ? Object.keys(dataArray[0]) : 'No data');
    
    const transformedData = dataArray.map((item, index) => {
      const flatItem: Record<string, unknown> = { ...item };
      
      if (index === 0) {
        console.log('🔧 API Transform: Processing first item:', JSON.stringify(item, null, 2));
      }
      
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

export async function generateLLMSummary(data: Record<string, unknown>[], config: ReportConfig): Promise<string> {
  console.log('Generating LLM summary using OpenAI API...');
  
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.log('OpenAI API key not configured, using fallback summary');
    return generateFallbackSummary(data, config);
  }

  // Handle empty data case
  if (!data || data.length === 0) {
    console.log('No data available, generating empty data summary');
    return `
## ${config.platform.toUpperCase()} Campaign Performance Summary

**Period**: ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days')}  
**Level**: ${config.level} level

**Status**: No data available for this configuration.

**Recommendation**: Try switching to 'Campaign' level with 'Last 30 days' date range for better data availability.
    `;
  }

  try {
    // Prepare data summary for the prompt
    const totalSpend = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseFloat(String(item.spend)) || 0), 0);
    const totalImpressions = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseInt(String(item.impressions)) || 0), 0);
    const totalClicks = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseInt(String(item.clicks)) || 0), 0);
    
    const sampleData = data.slice(0, 5); // First 5 records for context
    
    const prompt = `
You are a digital marketing analyst. Analyze this ${config.platform.toUpperCase()} advertising data and provide actionable insights.

**Campaign Configuration:**
- Platform: ${config.platform.toUpperCase()}
- Level: ${config.level}
- Date Range: ${config.dateRangeEnum}
- Metrics: ${config.metrics.join(', ')}
- Total Records: ${data.length}

**Key Totals:**
- Total Spend: $${totalSpend.toFixed(2)}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%

**Sample Data:**
${JSON.stringify(sampleData, null, 2)}

Please provide a well-structured analysis with:
1. Performance summary with key insights
2. Notable trends or patterns
3. 2-3 actionable recommendations for optimization

IMPORTANT: Format your response as clean HTML without markdown. Use <h3> for section headers, <p> for paragraphs, <strong> for emphasis, and <ul><li> for lists. Do not use ### headers or ** bold markdown formatting. Keep the response concise (under 200 words) and focus on actionable insights.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert digital marketing analyst who provides clear, actionable insights from advertising data.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content;
    
    if (!summary) {
      throw new Error('No summary generated by OpenAI');
    }

    console.log('OpenAI summary generated successfully');
    return summary;

  } catch (error) {
    console.error('Failed to generate OpenAI summary:', error);
    console.log('Falling back to basic summary...');
    return generateFallbackSummary(data, config);
  }
}

function generateFallbackSummary(data: Record<string, unknown>[], config: ReportConfig): string {
  const totalSpend = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseFloat(String(item.spend)) || 0), 0);
  const totalImpressions = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseInt(String(item.impressions)) || 0), 0);
  const totalClicks = data.reduce((sum: number, item: Record<string, unknown>) => sum + (parseInt(String(item.clicks)) || 0), 0);
  
  return `
## ${config.platform.toUpperCase()} Campaign Performance Summary

**Period**: ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days')}

**Key Metrics:**
- Total Spend: $${totalSpend.toFixed(2)}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%

**Analysis**: Your ${config.platform} campaigns generated ${totalImpressions.toLocaleString()} impressions 
with ${totalClicks.toLocaleString()} clicks, resulting in a ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}% click-through rate. 
Total advertising spend was $${totalSpend.toFixed(2)}.
  `;
}