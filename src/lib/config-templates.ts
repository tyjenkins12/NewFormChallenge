import { ReportConfig } from '@/types';

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  platform: 'meta' | 'tiktok';
  config: Partial<ReportConfig>;
  tags: string[];
}

export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'meta-campaign-overview',
    name: 'Campaign Performance Overview',
    description: 'High-level campaign metrics with age breakdown over last 30 days',
    platform: 'meta',
    config: {
      level: 'campaign',
      metrics: ['spend', 'impressions', 'clicks', 'ctr'],
      breakdowns: ['age'],
      dateRangeEnum: 'last30',
      timeIncrement: '7'
    },
    tags: ['reliable', 'overview', 'popular']
  },
  {
    id: 'meta-demographic-deep-dive',
    name: 'Demographic Analysis', 
    description: 'Detailed audience performance by gender over last 2 weeks',
    platform: 'meta',
    config: {
      level: 'adset',
      metrics: ['spend', 'ctr', 'reach'],
      breakdowns: ['gender'],
      dateRangeEnum: 'last14',
      timeIncrement: '7'
    },
    tags: ['demographics', 'detailed']
  },
  {
    id: 'meta-cost-efficiency',
    name: 'Cost Efficiency Report',
    description: 'Focus on cost metrics and conversion performance',
    platform: 'meta',
    config: {
      level: 'campaign',
      metrics: ['spend', 'cpc', 'frequency'],
      breakdowns: ['age'],
      dateRangeEnum: 'last30',
      timeIncrement: '7'
    },
    tags: ['cost', 'efficiency', 'reliable']
  },
  {
    id: 'tiktok-campaign-basic',
    name: 'TikTok Campaign Basics',
    description: 'Essential TikTok campaign metrics over last 30 days',
    platform: 'tiktok',
    config: {
      level: 'AUCTION_CAMPAIGN',
      metrics: ['spend', 'impressions', 'clicks', 'ctr'],
      dimensions: ['campaign_id'],
      dateRangeEnum: 'last30',
      reportType: 'BASIC'
    },
    tags: ['reliable', 'overview', 'tiktok']
  }
];

export function getTemplatesByPlatform(platform: 'meta' | 'tiktok'): ConfigTemplate[] {
  return CONFIG_TEMPLATES.filter(template => template.platform === platform);
}

export function getReliableTemplates(): ConfigTemplate[] {
  return CONFIG_TEMPLATES.filter(template => template.tags.includes('reliable'));
}