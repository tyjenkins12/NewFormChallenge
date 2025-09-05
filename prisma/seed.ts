import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  await prisma.reportConfig.deleteMany()
  console.log('Cleared existing configurations')

  const demoConfig = await prisma.reportConfig.create({
    data: {
      name: 'Weekly Analytics Report',
      description: 'Comprehensive weekly analytics with LLM-powered insights',
      schedule: '0 9 * * 1', // Every Monday at 9 AM
      enabled: true,
      allowedSites: [
        'https://example.com',
        'https://demo.example.com',
        'https://app.example.com',
      ],
    },
  })

  const quickConfig = await prisma.reportConfig.create({
    data: {
      name: 'Demo Quick Report',
      description: 'Fast report for demo purposes with accelerated schedule',
      schedule: '*/30 * * * * *', // Every 30 seconds (demo mode)
      enabled: true,
      allowedSites: [
        'https://quickdemo.com',
        'https://test.quickdemo.com',
      ],
    },
  })

  const emailConfig = await prisma.reportConfig.create({
    data: {
      name: 'Email Delivery Test',
      description: 'Configuration with email delivery for testing',
      schedule: '0 12 * * *', // Daily at noon
      enabled: false, // Disabled by default
      allowedSites: [
        'https://emailtest.com',
      ],
    },
  })

  console.log('✅ Created report configurations:')
  console.log(`  - ${demoConfig.name} (${demoConfig.id})`)
  console.log(`  - ${quickConfig.name} (${quickConfig.id})`)
  console.log(`  - ${emailConfig.name} (${emailConfig.id})`)

  const sampleRun = await prisma.reportRun.create({
    data: {
      configId: demoConfig.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 300000), // 5 minutes ago
      completedAt: new Date(Date.now() - 240000), // 4 minutes ago
      duration: 60000, // 1 minute
      retryCount: 0,
    },
  })

  const sampleReport = await prisma.report.create({
    data: {
      runId: sampleRun.id,
      configId: demoConfig.id,
      slug: 'demo-report-sample',
      title: 'Sample Analytics Report',
      summary: 'This is a sample report generated for demonstration purposes. It shows typical analytics data with various metrics and trends.',
      kpis: [
        {
          metric: 'Page Views',
          current: 45230,
          previous: 42150,
          delta: 3080,
          deltaPercent: 7,
          trend: 'up',
        },
        {
          metric: 'Unique Visitors',
          current: 12450,
          previous: 11800,
          delta: 650,
          deltaPercent: 6,
          trend: 'up',
        },
        {
          metric: 'Bounce Rate',
          current: 42,
          previous: 45,
          delta: -3,
          deltaPercent: -7,
          trend: 'up',
        },
        {
          metric: 'Conversion Rate',
          current: 3.2,
          previous: 2.9,
          delta: 0.3,
          deltaPercent: 10,
          trend: 'up',
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
          { path: '/blog', views: 3800, change: 0.22 },
          { path: '/contact', views: 2900, change: 0.03 },
        ],
        sources: [
          { name: 'Organic Search', visitors: 7200, change: 0.12 },
          { name: 'Direct', visitors: 3100, change: 0.05 },
          { name: 'Social Media', visitors: 1800, change: 0.25 },
          { name: 'Email', visitors: 900, change: -0.08 },
          { name: 'Paid Ads', visitors: 1200, change: 0.18 },
        ],
      },
      deliveryMethod: 'link',
      isPublic: true,
    },
  })

  console.log('✅ Created sample data:')
  console.log(`  - Sample run (${sampleRun.id})`)
  console.log(`  - Sample report: /r/${sampleReport.slug}`)

  const failedRun = await prisma.reportRun.create({
    data: {
      configId: emailConfig.id,
      status: 'FAILED',
      startedAt: new Date(Date.now() - 600000), // 10 minutes ago
      completedAt: new Date(Date.now() - 540000), // 9 minutes ago
      duration: 60000,
      retryCount: 2,
      lastErrorCode: '500',
      lastErrorSnippet: 'OpenAI API timeout after 5000ms. The request exceeded the configured timeout limit.',
    },
  })

  console.log(`  - Failed run example (${failedRun.id})`)

  console.log('🎯 Seed complete! Ready for demo.')
  console.log('')
  console.log('Quick test URLs:')
  console.log('  - Sample report: http://localhost:3000/r/demo-report-sample')
  console.log('  - API configs: http://localhost:3000/api/configs')
  console.log('  - API runs: http://localhost:3000/api/runs')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })