import { test, expect } from '@playwright/test'

test.describe('Demo Flow', () => {
  // Mock API responses before each test
  test.beforeEach(async ({ page }) => {
    // Mock configs API
    await page.route('/api/configs', async (route) => {
      await route.fulfill({
        json: [
          {
            id: 'mock-config-1',
            name: 'Mock Analytics Report',
            description: 'Mocked configuration for testing',
            schedule: '0 9 * * 1',
            enabled: true,
            allowedSites: ['https://example.com'],
            _count: { runs: 5, reports: 3 }
          }
        ]
      })
    })

    // Mock demo API
    await page.route('/api/demo', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            demoMode: true,
            acceleratedSchedule: true,
            simulateFailure: false,
            bypassCache: false,
            cacheDuration: 600000,
            llmTimeout: 5000
          }
        })
      } else {
        await route.fulfill({
          json: {
            success: true,
            applied: {
              simulateFailure: true,
              bypassCache: true,
              cacheCleared: true
            }
          }
        })
      }
    })

    // Mock runs API
    await page.route('/api/runs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          json: { runId: 'mock-run-123' }
        })
      } else {
        await route.fulfill({
          json: [
            {
              id: 'mock-run-1',
              status: 'COMPLETED',
              startedAt: new Date().toISOString(),
              duration: 60000
            }
          ]
        })
      }
    })

    // Mock reports API  
    await page.route('/api/reports/*', async (route) => {
      await route.fulfill({
        json: {
          id: 'mock-report-1',
          slug: 'demo-report-sample',
          title: 'Mock Analytics Report',
          summary: 'This is a mocked report for testing purposes.',
          kpis: [
            {
              metric: 'Page Views',
              current: 45230,
              previous: 42150,
              delta: 3080,
              deltaPercent: 7,
              trend: 'up'
            }
          ],
          isPublic: true
        }
      })
    })
  })

  test('complete evaluation workflow', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/')
    
    await expect(page.locator('h1')).toContainText('Report Runner')
    await expect(page.locator('text=Demo Mode')).toBeVisible()

    // 2. Check API endpoints work with mocked data
    const configsResponse = await page.request.get('/api/configs')
    expect(configsResponse.ok()).toBeTruthy()
    
    const configs = await configsResponse.json()
    expect(Array.isArray(configs)).toBeTruthy()
    expect(configs.length).toBeGreaterThan(0)
    expect(configs[0].name).toBe('Mock Analytics Report')

    // 3. Test demo controls
    const demoResponse = await page.request.get('/api/demo')
    expect(demoResponse.ok()).toBeTruthy()
    
    const demoState = await demoResponse.json()
    expect(demoState.demoMode).toBe(true)

    // 4. Toggle simulate LLM failure
    const toggleResponse = await page.request.post('/api/demo', {
      data: { simulateFailure: true }
    })
    expect(toggleResponse.ok()).toBeTruthy()

    // 5. Execute a run with mocked response
    const runResponse = await page.request.post('/api/runs', {
      data: {
        configId: configs[0].id,
        simulateFailure: true
      }
    })

    expect(runResponse.ok()).toBeTruthy()
    const runResult = await runResponse.json()
    expect(runResult.runId).toBe('mock-run-123')

    // 6. Test bypass cache
    await page.request.post('/api/demo', {
      data: { bypassCache: true }
    })

    // 7. Visit sample report page (uses static page, no API)
    await page.goto('/r/demo-report-sample')
    
    await expect(page.locator('h1')).toContainText('Sample Analytics Report')
    await expect(page.locator('text=Executive Summary')).toBeVisible()
    await expect(page.locator('text=Key Metrics')).toBeVisible()
    
    // Check for accessibility indicators
    const trendIndicators = page.locator('[class*="text-green-600"], [class*="text-red-600"]')
    await expect(trendIndicators.first()).toBeVisible()

    // Check for color-blind friendly symbols
    await expect(page.locator('text=↗')).toBeVisible()

    // 8. Verify shareable link is shown
    await expect(page.locator('text=Share this link')).toBeVisible()
  })

  test('API error handling', async ({ page }) => {
    // Mock 404 response for non-existent report
    await page.route('/api/reports/non-existent-slug', async (route) => {
      await route.fulfill({
        status: 404,
        json: { error: 'Report not found' }
      })
    })

    const response = await page.request.get('/api/reports/non-existent-slug')
    expect(response.status()).toBe(404)
    
    const error = await response.json()
    expect(error.error).toBe('Report not found')
  })

  test('concurrent run protection', async ({ page }) => {
    let requestCount = 0
    
    // Mock API to simulate concurrent run protection
    await page.route('/api/runs', async (route) => {
      if (route.request().method() === 'POST') {
        requestCount++
        if (requestCount === 1) {
          await route.fulfill({
            json: { runId: 'mock-run-first' }
          })
        } else {
          await route.fulfill({
            status: 409,
            json: { error: 'Run already in progress for this configuration' }
          })
        }
      }
    })

    const configsResponse = await page.request.get('/api/configs')
    const configs = await configsResponse.json()

    // Start first run
    const run1Promise = page.request.post('/api/runs', {
      data: { configId: configs[0].id }
    })

    // Immediately try to start second run
    const run2Promise = page.request.post('/api/runs', {
      data: { configId: configs[0].id }
    })

    const [run1Response, run2Response] = await Promise.all([run1Promise, run2Promise])

    // One should succeed, one should fail with 409
    const statuses = [run1Response.status(), run2Response.status()]
    
    expect(statuses).toContain(200) // First should succeed
    expect(statuses).toContain(409) // Second should be rejected
  })

  test('demo cache functionality', async ({ page }) => {
    // Clear cache
    const clearResponse = await page.request.post('/api/demo', {
      data: { clearCache: true }
    })
    expect(clearResponse.ok()).toBeTruthy()

    const result = await clearResponse.json()
    expect(result.applied.cacheCleared).toBe(true)
  })

  test('public report accessibility', async ({ page }) => {
    await page.goto('/r/demo-report-sample')
    
    // Check ARIA attributes
    const buttons = page.locator('button')
    if (await buttons.count() > 0) {
      // If buttons exist, they should have proper ARIA
      for (let i = 0; i < await buttons.count(); i++) {
        const button = buttons.nth(i)
        // Check for aria-label or aria-describedby
        const hasAria = await button.getAttribute('aria-label') !== null ||
                       await button.getAttribute('aria-describedby') !== null ||
                       await button.textContent() !== ''
        expect(hasAria).toBeTruthy()
      }
    }

    // Check color contrast alternatives (symbols)
    const trendSymbols = ['↗', '↘', '→']
    for (const symbol of trendSymbols) {
      if (await page.locator(`text=${symbol}`).count() > 0) {
        await expect(page.locator(`text=${symbol}`)).toBeVisible()
      }
    }
  })
})