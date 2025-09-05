import { db } from './db'
import { llmService } from './llm'
import { generateSlug, truncateString } from './utils'
import { newFormApi } from './newform-api'
import type { KPI, Report, CreateReport } from '@/types/reports'

interface GenerateReportOptions {
  useCache?: boolean
  simulateFailure?: boolean
}

interface ReportData {
  metrics: {
    pageViews: number
    uniqueVisitors: number
    bounceRate: number
    avgSessionDuration: number
    conversionRate: number
  }
  trends: {
    pageViewsTrend: number
    visitorsTrend: number
    bounceTrend: number
    sessionTrend: number
    conversionTrend: number
  }
  topPages: Array<{
    path: string
    views: number
    change: number
  }>
  sources: Array<{
    name: string
    visitors: number
    change: number
  }>
}

export class ReportGenerator {
  async generateReport(
    runId: string,
    configId: string,
    allowedSites: string[],
    options: GenerateReportOptions = {}
  ): Promise<Report> {
    const mockData = await this.fetchAnalyticsData(allowedSites, options)
    
    const kpis = this.calculateKPIs(mockData)
    
    const llmResponse = await llmService.generateInsight(
      mockData,
      'Generate a concise executive summary highlighting the most important trends and actionable recommendations from this analytics data.',
      {
        useCache: options.useCache,
        simulateFailure: options.simulateFailure,
      }
    )

    const summary = llmResponse.success 
      ? llmResponse.content!
      : llmService.generateFallbackSummary(mockData)

    const slug = generateSlug(12)
    const title = `Analytics Report - ${new Date().toLocaleDateString()}`

    const report: CreateReport = {
      runId,
      configId,
      slug,
      title,
      summary,
      kpis,
      rawData: mockData,
      deliveryMethod: 'link',
      isPublic: true,
    }

    const created = await db.report.create({
      data: report,
    })

    return {
      ...created,
      kpis: created.kpis as KPI[],
      rawData: created.rawData as ReportData,
      createdAt: created.createdAt,
    }
  }

  private async fetchAnalyticsData(
    allowedSites: string[],
    options: GenerateReportOptions = {}
  ): Promise<ReportData> {
    try {
      // Try to fetch real data from NewFormApi
      const apiParams = {
        limit: 50,
        page: Math.floor(Math.random() * 5) + 1, // Random page 1-5
        category: ['analytics', 'metrics', 'performance'][Math.floor(Math.random() * 3)],
        type: ['website_data', 'user_behavior', 'conversion_metrics'][Math.floor(Math.random() * 3)],
        source: allowedSites[0] || 'demo-site.com'
      }

      console.log('🔄 Fetching analytics data from NewFormApi with params:', apiParams)
      
      const apiResponse = await newFormApi.fetchAnalyticsData({
        endpoint: '/data',
        params: apiParams,
        useCache: options.useCache
      })

      console.log('✅ Analytics data retrieved:', {
        pageViews: apiResponse.metrics.pageViews,
        visitors: apiResponse.metrics.uniqueVisitors,
        apiDataLength: apiResponse.rawApiData.length
      })

      // Return the transformed data
      return {
        metrics: apiResponse.metrics,
        trends: apiResponse.trends,
        topPages: apiResponse.topPages,
        sources: apiResponse.sources
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch from NewFormApi, using fallback data:', error instanceof Error ? error.message : 'Unknown error')
      
      // Fallback to enhanced mock data
      return this.generateFallbackData()
    }
  }

  private generateFallbackData(): ReportData {
    return {
      metrics: {
        pageViews: Math.floor(Math.random() * 50000) + 10000,
        uniqueVisitors: Math.floor(Math.random() * 15000) + 3000,
        bounceRate: Math.random() * 0.4 + 0.3,
        avgSessionDuration: Math.random() * 300 + 120,
        conversionRate: Math.random() * 0.05 + 0.02,
      },
      trends: {
        pageViewsTrend: (Math.random() - 0.5) * 0.4,
        visitorsTrend: (Math.random() - 0.5) * 0.3,
        bounceTrend: (Math.random() - 0.5) * 0.2,
        sessionTrend: (Math.random() - 0.5) * 0.25,
        conversionTrend: (Math.random() - 0.5) * 0.15,
      },
      topPages: [
        { path: '/', views: Math.floor(Math.random() * 5000) + 1000, change: (Math.random() - 0.5) * 0.3 },
        { path: '/products', views: Math.floor(Math.random() * 3000) + 500, change: (Math.random() - 0.5) * 0.4 },
        { path: '/about', views: Math.floor(Math.random() * 2000) + 300, change: (Math.random() - 0.5) * 0.2 },
        { path: '/contact', views: Math.floor(Math.random() * 1500) + 200, change: (Math.random() - 0.5) * 0.35 },
        { path: '/blog', views: Math.floor(Math.random() * 2500) + 400, change: (Math.random() - 0.5) * 0.25 },
      ],
      sources: [
        { name: 'Organic Search', visitors: Math.floor(Math.random() * 8000) + 2000, change: (Math.random() - 0.5) * 0.3 },
        { name: 'Direct', visitors: Math.floor(Math.random() * 4000) + 1000, change: (Math.random() - 0.5) * 0.2 },
        { name: 'Social Media', visitors: Math.floor(Math.random() * 3000) + 500, change: (Math.random() - 0.5) * 0.4 },
        { name: 'Email', visitors: Math.floor(Math.random() * 2000) + 300, change: (Math.random() - 0.5) * 0.25 },
        { name: 'Paid Ads', visitors: Math.floor(Math.random() * 2500) + 400, change: (Math.random() - 0.5) * 0.35 },
      ],
    }
  }

  private calculateKPIs(data: ReportData): KPI[] {
    return [
      {
        metric: 'Page Views',
        current: data.metrics.pageViews,
        previous: Math.floor(data.metrics.pageViews / (1 + data.trends.pageViewsTrend)),
        delta: Math.floor(data.metrics.pageViews * data.trends.pageViewsTrend),
        deltaPercent: Math.round(data.trends.pageViewsTrend * 100),
        trend: data.trends.pageViewsTrend > 0.05 ? 'up' : data.trends.pageViewsTrend < -0.05 ? 'down' : 'stable',
      },
      {
        metric: 'Unique Visitors',
        current: data.metrics.uniqueVisitors,
        previous: Math.floor(data.metrics.uniqueVisitors / (1 + data.trends.visitorsTrend)),
        delta: Math.floor(data.metrics.uniqueVisitors * data.trends.visitorsTrend),
        deltaPercent: Math.round(data.trends.visitorsTrend * 100),
        trend: data.trends.visitorsTrend > 0.05 ? 'up' : data.trends.visitorsTrend < -0.05 ? 'down' : 'stable',
      },
      {
        metric: 'Bounce Rate',
        current: Math.round(data.metrics.bounceRate * 100),
        previous: Math.round((data.metrics.bounceRate / (1 + data.trends.bounceTrend)) * 100),
        delta: Math.round(data.metrics.bounceRate * data.trends.bounceTrend * 100),
        deltaPercent: Math.round(data.trends.bounceTrend * 100),
        trend: data.trends.bounceTrend > 0.05 ? 'down' : data.trends.bounceTrend < -0.05 ? 'up' : 'stable',
      },
      {
        metric: 'Avg Session Duration',
        current: Math.round(data.metrics.avgSessionDuration),
        previous: Math.round(data.metrics.avgSessionDuration / (1 + data.trends.sessionTrend)),
        delta: Math.round(data.metrics.avgSessionDuration * data.trends.sessionTrend),
        deltaPercent: Math.round(data.trends.sessionTrend * 100),
        trend: data.trends.sessionTrend > 0.05 ? 'up' : data.trends.sessionTrend < -0.05 ? 'down' : 'stable',
      },
      {
        metric: 'Conversion Rate',
        current: Math.round(data.metrics.conversionRate * 100 * 100) / 100,
        previous: Math.round((data.metrics.conversionRate / (1 + data.trends.conversionTrend)) * 100 * 100) / 100,
        delta: Math.round(data.metrics.conversionRate * data.trends.conversionTrend * 100 * 100) / 100,
        deltaPercent: Math.round(data.trends.conversionTrend * 100),
        trend: data.trends.conversionTrend > 0.05 ? 'up' : data.trends.conversionTrend < -0.05 ? 'down' : 'stable',
      },
    ]
  }
}

export const reportGenerator = new ReportGenerator()