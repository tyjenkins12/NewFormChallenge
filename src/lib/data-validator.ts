import { ReportConfig } from '@/types';
import { validateMetricCombination, getSuggestedMetrics } from './metric-availability';

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

export interface ValidationResult {
  hasData: boolean;
  recordCount: number;
  suggestions?: {
    level?: string;
    dateRange?: string;
    breakdowns?: string[];
    metrics?: string[];
  };
  metricIssues?: {
    unavailableMetrics: string[];
    suggestedMetrics: string[];
  };
  dimensionIssues?: string[];
}

/**
 * Validates if a configuration will return data by making a lightweight test request
 */
export async function validateDataAvailability(config: ReportConfig): Promise<ValidationResult> {
  // First check if metrics and dimensions are valid for this platform/level
  const metricValidation = validateMetricCombination(
    config.metrics, 
    config.platform, 
    config.level,
    config.dimensions
  );
  
  // If metrics are invalid, return early with suggestions
  if (!metricValidation.valid) {
    const suggestedMetrics = getSuggestedMetrics(
      config.metrics, 
      config.platform, 
      config.level
    );
    
    return {
      hasData: false,
      recordCount: 0,
      metricIssues: {
        unavailableMetrics: metricValidation.unavailableMetrics,
        suggestedMetrics: suggestedMetrics
      },
      dimensionIssues: metricValidation.dimensionIssues,
      suggestions: {
        metrics: suggestedMetrics
      }
    };
  }
  
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
    body.reportType = config.reportType || 'BASIC';
  }

  try {
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
      return { hasData: false, recordCount: 0 };
    }

    const apiResponse = await response.json();
    const data = apiResponse.data || apiResponse;
    const recordCount = Array.isArray(data) ? data.length : 0;

    // If no data, provide suggestions
    const suggestions: ValidationResult['suggestions'] = {};
    if (recordCount === 0) {
      // Suggest more reliable combinations
      if (config.level !== 'campaign') {
        suggestions.level = 'campaign';
      }
      if (config.dateRangeEnum !== 'last30') {
        suggestions.dateRange = 'last30';
      }
      if (config.platform === 'meta' && config.breakdowns && config.breakdowns.length > 1) {
        suggestions.breakdowns = ['age']; // Suggest single reliable breakdown
      }
    }

    return {
      hasData: recordCount > 0,
      recordCount,
      suggestions: recordCount === 0 ? suggestions : undefined
    };

  } catch (error) {
    console.error('Data validation failed:', error);
    return { hasData: false, recordCount: 0 };
  }
}

/**
 * Gets recommended configurations that are likely to have data
 */
export function getRecommendedConfigs(platform: 'meta' | 'tiktok'): Partial<ReportConfig>[] {
  if (platform === 'meta') {
    return [
      {
        level: 'campaign',
        dateRangeEnum: 'last30',
        breakdowns: ['age'],
        metrics: ['spend', 'impressions', 'clicks']
      },
      {
        level: 'adset', 
        dateRangeEnum: 'last30',
        breakdowns: ['gender'],
        metrics: ['spend', 'ctr']
      },
      {
        level: 'campaign',
        dateRangeEnum: 'last14',
        breakdowns: ['age'],
        metrics: ['impressions', 'clicks', 'spend']
      }
    ];
  } else {
    return [
      {
        level: 'AUCTION_CAMPAIGN',
        dateRangeEnum: 'last30', 
        dimensions: ['campaign_id'],
        metrics: ['spend', 'impressions', 'clicks']
      }
    ];
  }
}