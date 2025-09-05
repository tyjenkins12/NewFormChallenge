export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Report Runner
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Automated report generation and delivery system with LLM-powered insights
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Quick Start</h3>
            <p className="mt-2 text-sm text-gray-600">
              Set up your first report configuration and start generating automated insights.
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Demo Mode</h3>
            <p className="mt-2 text-sm text-gray-600">
              Test with accelerated scheduling, LLM simulation, and cached responses.
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">API Ready</h3>
            <p className="mt-2 text-sm text-gray-600">
              Full REST API for integrations, webhooks, and programmatic access.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            API endpoints: /api/configs, /api/runs, /api/reports, /api/demo
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Public reports: /r/[slug]
          </p>
        </div>
      </div>
    </div>
  )
}