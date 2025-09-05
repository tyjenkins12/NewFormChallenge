import { ReportConfig } from '@/types';

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

export async function fetchAdData(config: ReportConfig): Promise<Record<string, unknown>[]> {
  const endpoint = config.platform === 'meta' ? '/sample-data/meta' : '/sample-data/tiktok';
  
  const body: Record<string, unknown> = {
    metrics: config.metrics,
    level: config.level,
    dateRangeEnum: config.dateRangeEnum.toUpperCase(),
  };

  if (config.platform === 'meta') {
    if (config.breakdowns?.length) {
      body.breakdowns = config.breakdowns;
    }
    if (config.timeIncrement) {
      body.timeIncrement = config.timeIncrement;
    }
  } else if (config.platform === 'tiktok') {
    if (config.dimensions?.length) {
      body.dimensions = config.dimensions;
    }
    if (config.reportType) {
      body.reportType = config.reportType;
    }
  }

  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function generateLLMSummary(data: Record<string, unknown>[], config: ReportConfig): Promise<string> {
  // Simple summary generation - in production you'd use OpenAI or Claude
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