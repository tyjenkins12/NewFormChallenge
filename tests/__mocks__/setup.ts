// Mock data for consistent testing
export const mockReportConfig = {
  id: 'config-123',
  name: 'Test Config',
  description: 'Test configuration for unit tests',
  schedule: '0 9 * * 1',
  enabled: true,
  allowedSites: ['https://example.com', 'https://test.com'],
  createdAt: new Date('2024-01-01T09:00:00Z'),
  updatedAt: new Date('2024-01-01T09:00:00Z'),
}

export const mockReportRun = {
  id: 'run-123',
  configId: 'config-123',
  status: 'COMPLETED' as const,
  startedAt: new Date('2024-01-01T10:00:00Z'),
  completedAt: new Date('2024-01-01T10:05:00Z'),
  duration: 300000,
  retryCount: 0,
  lastErrorCode: null,
  lastErrorSnippet: null,
  rawPayload: null,
}

export const mockReport = {
  id: 'report-123',
  runId: 'run-123',
  configId: 'config-123',
  slug: 'test-report-abc123',
  title: 'Test Analytics Report - January 2024',
  summary: 'Test report generated for unit testing purposes with mock analytics data.',
  kpis: [
    {
      metric: 'Page Views',
      current: 45230,
      previous: 42150,
      delta: 3080,
      deltaPercent: 7,
      trend: 'up' as const,
    },
    {
      metric: 'Unique Visitors',
      current: 12450,
      previous: 11800,
      delta: 650,
      deltaPercent: 6,
      trend: 'up' as const,
    },
    {
      metric: 'Bounce Rate',
      current: 42,
      previous: 45,
      delta: -3,
      deltaPercent: -7,
      trend: 'up' as const,
    },
  ],
  rawData: {
    metrics: {
      pageViews: 45230,
      uniqueVisitors: 12450,
      bounceRate: 0.42,
      avgSessionDuration: 245,
      conversionRate: 0.032,
    },
    trends: {
      pageViewsTrend: 0.07,
      visitorsTrend: 0.06,
      bounceTrend: -0.07,
      sessionTrend: 0.12,
      conversionTrend: 0.10,
    },
    topPages: [
      { path: '/', views: 8500, change: 0.15 },
      { path: '/products', views: 6200, change: 0.08 },
      { path: '/about', views: 4100, change: -0.05 },
    ],
    sources: [
      { name: 'Organic Search', visitors: 7200, change: 0.12 },
      { name: 'Direct', visitors: 3100, change: 0.05 },
      { name: 'Social Media', visitors: 1800, change: 0.25 },
    ],
  },
  emailHtml: null,
  deliveryMethod: 'link' as const,
  deliveryTarget: null,
  isPublic: true,
  createdAt: new Date('2024-01-01T10:05:00Z'),
}

export const mockAnalyticsData = {
  metrics: {
    pageViews: 45230,
    uniqueVisitors: 12450,
    bounceRate: 0.42,
    avgSessionDuration: 245,
    conversionRate: 0.032,
  },
  trends: {
    pageViewsTrend: 0.07,
    visitorsTrend: 0.06,
    bounceTrend: -0.07,
    sessionTrend: 0.12,
    conversionTrend: 0.10,
  },
  topPages: [
    { path: '/', views: 8500, change: 0.15 },
    { path: '/products', views: 6200, change: 0.08 },
    { path: '/about', views: 4100, change: -0.05 },
    { path: '/contact', views: 2900, change: 0.03 },
    { path: '/blog', views: 3800, change: 0.22 },
  ],
  sources: [
    { name: 'Organic Search', visitors: 7200, change: 0.12 },
    { name: 'Direct', visitors: 3100, change: 0.05 },
    { name: 'Social Media', visitors: 1800, change: 0.25 },
    { name: 'Email', visitors: 900, change: -0.08 },
    { name: 'Paid Ads', visitors: 1200, change: 0.18 },
  ],
}

// Mock OpenAI responses
export const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: 'This is a mock AI-generated insight for testing purposes. The analytics show positive trends across key metrics with notable growth in page views and user engagement.',
      },
    },
  ],
}

// Mock email service responses
export const mockEmailSuccess = {
  success: true,
  messageId: 'msg-test-123',
}

export const mockEmailError = {
  success: false,
  error: 'Mock email service error for testing',
}

// Mock demo cache data
export const mockCacheEntry = {
  key: 'test-cache-key',
  data: { mockField: 'mockValue', timestamp: Date.now() },
  expiresAt: new Date(Date.now() + 600000),
  createdAt: new Date(),
}