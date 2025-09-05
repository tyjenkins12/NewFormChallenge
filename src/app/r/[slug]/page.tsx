import { db } from '@/lib/db'
import { formatDuration } from '@/lib/utils'
import { notFound } from 'next/navigation'
import type { KPI } from '@/types/reports'

interface Props {
  params: { slug: string }
}

export default async function PublicReportPage({ params }: Props) {
  const report = await db.report.findUnique({
    where: { slug: params.slug },
    include: {
      config: {
        select: {
          name: true,
          description: true,
        },
      },
      run: {
        select: {
          status: true,
          duration: true,
          completedAt: true,
        },
      },
    },
  })

  if (!report || !report.isPublic) {
    notFound()
  }

  const kpis = report.kpis as KPI[]
  const rawData = report.rawData as any

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {report.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {report.config.name} • Generated {report.createdAt.toLocaleDateString()}
          </p>
          {report.run.duration && (
            <p className="text-sm text-gray-500">
              Completed in {formatDuration(report.run.duration)}
            </p>
          )}
        </header>

        {report.summary && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-medium text-gray-900">Executive Summary</h2>
            <p className="mt-3 text-gray-700">{report.summary}</p>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900">Key Metrics</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <div key={kpi.metric} className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">{kpi.metric}</h3>
                  <span className={getTrendIcon(kpi.trend)}>{getTrendSymbol(kpi.trend)}</span>
                </div>
                <div className="mt-2 flex items-baseline">
                  <p className="text-2xl font-semibold text-gray-900">
                    {kpi.current.toLocaleString()}
                  </p>
                  <p className={`ml-2 text-sm ${getTrendColor(kpi.trend)}`}>
                    {kpi.deltaPercent > 0 ? '+' : ''}{kpi.deltaPercent}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {rawData?.topPages && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-medium text-gray-900">Top Pages</h2>
            <div className="mt-4 space-y-3">
              {rawData.topPages.slice(0, 5).map((page: any, index: number) => (
                <div key={page.path} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {index + 1}
                    </span>
                    <span className="ml-3 text-sm text-gray-900">{page.path}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {page.views.toLocaleString()} views
                    </p>
                    <p className={`text-xs ${page.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {page.change >= 0 ? '+' : ''}{Math.round(page.change * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This report was generated automatically.</p>
          <p className="mt-1">Share this link: {process.env.NEXTAUTH_URL}/r/{report.slug}</p>
        </div>
      </div>
    </div>
  )
}

function getTrendSymbol(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↗'
    case 'down': return '↘'
    default: return '→'
  }
}

function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return 'text-green-600'
    case 'down': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return 'text-green-600'
    case 'down': return 'text-red-600'
    default: return 'text-gray-600'
  }
}