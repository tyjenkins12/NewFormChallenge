import { ReportConfig } from '@/types';

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

export async function fetchAdData(config: ReportConfig): Promise<Record<string, unknown>[]> {
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
      // No Authorization header needed
    },
    body: JSON.stringify(body),
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
    console.log(`Suggestion: Try 'campaign' level or 'last30' date range for more data availability`);
    
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
          flatItem[key] = value;
        });
      }
      
      // Flatten dimensions object to top level
      if (item.dimensions && typeof item.dimensions === 'object') {
        Object.entries(item.dimensions).forEach(([key, value]) => {
          flatItem[key] = value;
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
  
  // Return array as-is for other platforms (Meta)
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