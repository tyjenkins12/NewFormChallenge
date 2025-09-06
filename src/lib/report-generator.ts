import { ReportConfig } from '@/types';

export async function generateReport(data: Record<string, unknown>[], summary: string, config: ReportConfig): Promise<string> {
  // Handle empty data gracefully
  const hasData = data && data.length > 0;
  
  return generateCustomizedReport(data, summary, config, hasData);
}

function generateCustomizedReport(data: Record<string, unknown>[], summary: string, config: ReportConfig, hasData: boolean): string {
  // Get metric display info
  const getMetricDisplay = (metric: string) => {
    const displays: Record<string, { label: string, format: (n: number) => string }> = {
      impressions: { label: 'TOTAL IMPRESSIONS', format: (n) => Math.round(n).toLocaleString() },
      clicks: { label: 'TOTAL CLICKS', format: (n) => Math.round(n).toLocaleString() },
      spend: { label: 'TOTAL SPEND', format: (n) => `$${n.toFixed(2)}` },
      conversions: { label: 'TOTAL CONVERSIONS', format: (n) => Math.round(n).toString() },
      ctr: { label: 'AVERAGE CTR', format: (n) => `${n.toFixed(2)}%` },
      cpc: { label: 'AVERAGE CPC', format: (n) => `$${n.toFixed(2)}` },
      reach: { label: 'TOTAL REACH', format: (n) => Math.round(n).toLocaleString() },
      frequency: { label: 'AVERAGE FREQUENCY', format: (n) => n.toFixed(2) },
      cost_per_conversion: { label: 'COST PER CONVERSION', format: (n) => `$${n.toFixed(2)}` },
      conversion_rate: { label: 'CONVERSION RATE', format: (n) => `${n.toFixed(2)}%` },
      actions: { label: 'TOTAL ACTIONS', format: (n) => n.toFixed(2) },
      cost_per_action_type: { label: 'COST PER ACTION', format: (n) => `$${n.toFixed(2)}` }
    };
    
    return displays[metric] || { label: metric.replace(/_/g, ' ').toUpperCase(), format: (n) => n.toString() };
  };

  // Calculate totals for selected metrics
  const calculateMetricTotal = (data: Record<string, unknown>[], metric: string): number => {
    return data.reduce((sum, item) => {
      const value = parseFloat(String(item[metric])) || 0;
      return sum + value;
    }, 0);
  };

  // Calculate derived metrics
  const calculateDerivedMetric = (data: Record<string, unknown>[], metric: string): number => {
    const totalImpressions = calculateMetricTotal(data, 'impressions');
    const totalClicks = calculateMetricTotal(data, 'clicks');
    const totalSpend = calculateMetricTotal(data, 'spend');
    const totalConversions = calculateMetricTotal(data, 'conversions');
    
    switch (metric) {
      case 'ctr':
        return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      case 'cpc':
        return totalClicks > 0 ? totalSpend / totalClicks : 0;
      case 'conversion_rate':
        return totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      case 'cost_per_conversion':
        return totalConversions > 0 ? totalSpend / totalConversions : 0;
      default:
        return calculateMetricTotal(data, metric);
    }
  };

  // Generate KPI cards based on selected metrics (show only what's selected)
  const generateCustomKPIs = (): string => {
    if (!hasData) {
      return `
        <div class="kpi">
            <h3>NO DATA</h3>
            <div class="v">--</div>
            <div class="delta">Select different settings</div>
        </div>
      `;
    }

    const selectedMetrics = config.metrics;
    const kpis = selectedMetrics.map(metric => {
      const display = getMetricDisplay(metric);
      const value = calculateDerivedMetric(data, metric);
      
      return `
        <div class="kpi">
            <h3>${display.label}</h3>
            <div class="v">${display.format(value)}</div>
            <div class="delta">From ${data.length} records</div>
        </div>
      `;
    });

    return kpis.join('');
  };

  // Generate chart data for selected metrics
  const generateChartData = () => {
    if (!hasData) {
      return { labels: ['No Data'], datasets: [] };
    }

    // Group data by date or campaign/ad name for chart
    const chartData = data.slice(0, 10).map((item, index) => {
      const name = String(item.campaign_name || item.ad_name || item.date_start || `Item ${index + 1}`);
      const dataPoint: Record<string, any> = { name };
      
      config.metrics.forEach(metric => {
        dataPoint[metric] = parseFloat(String(item[metric])) || 0;
      });
      
      return dataPoint;
    });

    return {
      labels: chartData.map(d => d.name),
      datasets: config.metrics.slice(0, 3).map((metric, index) => {
        const colors = ['#60a5fa', '#34d399', '#f59e0b'];
        const display = getMetricDisplay(metric);
        
        return {
          label: display.label,
          data: chartData.map(d => d[metric]),
          backgroundColor: colors[index] + '80',
          borderColor: colors[index],
          borderWidth: 2,
          type: index === 0 ? 'bar' : 'line'
        };
      })
    };
  };

  const chartData = generateChartData();

  // Generate table headers based on available data keys
  const generateTableHeaders = (): string => {
    if (!hasData || data.length === 0) return '<th>No Data</th>';
    
    const headers = Object.keys(data[0]);
    return headers.map(header => 
      `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`
    ).join('');
  };

  // Generate table rows
  const generateTableRows = (): string => {
    if (!hasData || data.length === 0) {
      return '<tr><td colspan="100%">No data available for the selected configuration</td></tr>';
    }
    
    const maxRows = Math.min(data.length, 20);
    const headers = Object.keys(data[0]);
    
    return data.slice(0, maxRows).map(row => `
      <tr>
        ${headers.map(header => `<td>${formatValue(row[header])}</td>`).join('')}
      </tr>
    `).join('');
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${config.platform.toUpperCase()} Insight Report — ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 Days')}</title>
    <meta name="description" content="Expert-level marketing report for ${config.platform.toUpperCase()} campaigns with KPIs, trends, and actionable recommendations." />
    <style>
        :root{
          --bg: #0b0d12;
          --panel: #11151d;
          --muted: #6b7280;
          --text: #eef2ff;
          --accent: #60a5fa;
          --accent-2: #34d399;
          --danger: #f87171;
          --warning: #f59e0b;
          --border: #1f2937;
          --chip: #0f172a;
          --shadow: 0 6px 24px rgba(0,0,0,.35);
          --radius-xl: 18px;
          --radius-lg: 14px;
          --radius-md: 10px;
        }
        *{box-sizing:border-box}
        html,body{margin:0;background:var(--bg);color:var(--text);font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";line-height:1.45}
        a{color:var(--accent)}
        .container{max-width:1200px;margin:0 auto;padding:28px}
        header{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-bottom:18px}
        .brand{display:flex;gap:12px;align-items:center}
        .badge{background:linear-gradient(135deg,#1f2937,#0b1220);border:1px solid var(--border);padding:8px 12px;border-radius:999px;color:var(--muted);font-weight:600;font-size:12px;letter-spacing:.4px}
        .title h1{font-size:clamp(22px,3.2vw,30px);margin:0}
        .subtitle{color:#9ca3af;font-size:14px;margin-top:4px}
        .panel{background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0));border:1px solid var(--border);border-radius:var(--radius-xl);box-shadow:var(--shadow)}
        .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin:18px 0}
        @media (max-width:520px){.kpis{grid-template-columns:1fr}}
        .kpi{padding:18px;border-radius:var(--radius-lg);background:var(--panel);border:1px solid var(--border)}
        .kpi h3{margin:0 0 6px 0;color:#cbd5e1;font-size:12px;letter-spacing:.6px;font-weight:700}
        .kpi .v{font-size:clamp(20px,4vw,28px);font-weight:800}
        .kpi .delta{margin-top:8px;font-size:12px;color:#94a3b8}
        .summary-section{margin:18px 0}
        .card{padding:18px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-xl)}
        .card h2{margin:0 0 12px 0;font-size:18px}
        .prose{color:#e5e7eb;font-size:14px}
        .prose p{margin:.6em 0}
        .prose h3{color:#cbd5e1;font-size:16px;margin:1em 0 .5em 0;font-weight:700}
        .prose ul{margin:.8em 0;padding-left:1.2em}
        .prose li{margin:.3em 0}
        .prose strong{color:#f8fafc;font-weight:600}
        .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
        .chip{background:var(--chip);border:1px solid var(--border);padding:6px 10px;border-radius:999px;color:#94a3b8;font-size:12px}
        .charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media (max-width:980px){.charts{grid-template-columns:1fr}}
        canvas{background:transparent;border-radius:var(--radius-lg);border:1px solid var(--border);padding:8px}
        .table-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius-xl)}
        table{width:100%;border-collapse:separate;border-spacing:0;min-width:900px}
        th,td{padding:12px 14px;text-align:right;border-bottom:1px solid var(--border);font-size:13px}
        th:first-child, td:first-child{text-align:left}
        thead th{position:sticky;top:0;background:#0e1420;z-index:1}
        tbody tr:hover{background:rgba(255,255,255,.02)}
        .pill{display:inline-block;padding:4px 8px;border-radius:999px;border:1px solid var(--border);background:#0b1220;color:#cbd5e1;font-size:12px}
        footer{color:#94a3b8;font-size:12px;margin:22px 0 40px}
        .note{color:#a3a3a3;font-size:12px;margin-top:6px}
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="brand">
            <div class="badge" aria-label="Report Type">${config.platform.toUpperCase()} • Insight Report</div>
            <div class="title">
                <h1>Expert Marketing Performance Report</h1>
                <div class="subtitle">Generated on <strong>${new Date().toLocaleDateString()}</strong> • Window: <strong>${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 Days')}</strong></div>
            </div>
        </div>
        <div class="chips" role="list" aria-label="Meta Data">
            <span class="chip" role="listitem">Platform: ${config.platform.toUpperCase()}</span>
            <span class="chip" role="listitem">Level: ${config.level}</span>
            <span class="chip" role="listitem">Metrics: ${config.metrics.length} selected</span>
        </div>
    </header>

    <!-- KPI Strip -->
    <section class="kpis" aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" class="sr-only">Key Performance Indicators</h2>
        ${generateCustomKPIs()}
    </section>

    <!-- Summary -->
    <section class="summary-section">
        <article class="card">
            <h2>Executive Summary</h2>
            <div class="prose" id="exec-summary">
                ${summary}
            </div>
            <div class="note">Report customized for ${config.platform.toUpperCase()} ${config.level} level with ${config.metrics.length} selected metrics.</div>
        </article>
    </section>

    <!-- Charts -->
    <section class="charts" aria-label="Charts">
        <div class="card">
            <h2>Primary Metrics</h2>
            <canvas id="chartPrimary" height="250" aria-label="Chart of primary selected metrics" role="img"></canvas>
        </div>
        <div class="card">
            <h2>Performance Trend</h2>
            <canvas id="chartTrend" height="250" aria-label="Mixed chart of performance trends" role="img"></canvas>
        </div>
    </section>

    <!-- Detailed Table -->
    <section class="card" style="margin-top:18px">
        <h2>Detailed Data</h2>
        <div class="table-wrap">
            <table id="detail-table" aria-describedby="table-note">
                <thead>
                <tr>
                    ${generateTableHeaders()}
                </tr>
                </thead>
                <tbody id="table-body">
                    ${generateTableRows()}
                </tbody>
            </table>
        </div>
        <div id="table-note" class="note">Data shows ${hasData ? data.length : 0} records from ${config.platform.toUpperCase()} API for ${config.dateRangeEnum} period.</div>
    </section>

    <footer>
        © 2025 Scheduled Insight Reports • Generated for ${config.platform.toUpperCase()} • ${new Date().toLocaleDateString()}.
    </footer>
</div>

<!-- Chart.js CDN -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>

<script>
    // Chart data from server
    const chartData = ${JSON.stringify(chartData)};
    const hasData = ${hasData};
    
    if (hasData && chartData.labels && chartData.labels.length > 0) {
        // Primary metrics chart (bar)
        const ctxPrimary = document.getElementById('chartPrimary').getContext('2d');
        new Chart(ctxPrimary, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.slice(0, 1)
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: {
                        display: true,
                        text: 'Primary Metric Performance'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Performance trend chart (mixed)
        const ctxTrend = document.getElementById('chartTrend').getContext('2d');
        new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: {
                        display: true,
                        text: 'Multi-Metric Performance'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } else {
        // Show "No data" message in charts
        document.getElementById('chartPrimary').style.display = 'none';
        document.getElementById('chartTrend').style.display = 'none';
        const chartContainers = document.querySelectorAll('.charts .card');
        chartContainers.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                canvas.style.display = 'none';
                const noDataMsg = document.createElement('div');
                noDataMsg.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 60px 20px;">No data available for selected configuration</p>';
                container.appendChild(noDataMsg);
            }
        });
    }
</script>
</body>
</html>`;

  return html;
}

function generateMetricsCards(data: Record<string, unknown>[]): string {
  const totalSpend = data.reduce((sum, item) => sum + (parseFloat(String(item.spend)) || 0), 0);
  const totalImpressions = data.reduce((sum, item) => sum + (parseInt(String(item.impressions)) || 0), 0);
  const totalClicks = data.reduce((sum, item) => sum + (parseInt(String(item.clicks)) || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

  return `
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-label">Total Spend</div>
            <div class="metric-value">$${totalSpend.toFixed(2)}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Impressions</div>
            <div class="metric-value">${totalImpressions.toLocaleString()}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Clicks</div>
            <div class="metric-value">${totalClicks.toLocaleString()}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Average CTR</div>
            <div class="metric-value">${avgCTR.toFixed(2)}%</div>
        </div>
    </div>
  `;
}

function generateDataTable(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) {
    return '<p>No data available</p>';
  }

  const headers = Object.keys(data[0]);
  const maxRows = Math.min(data.length, 20); // Limit to first 20 rows

  return `
    <table>
        <thead>
            <tr>
                ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${data.slice(0, maxRows).map(row => `
                <tr>
                    ${headers.map(header => `<td>${formatValue(row[header])}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>
    ${data.length > maxRows ? `<p style="padding: 20px; text-align: center; color: #6b7280;">Showing first ${maxRows} of ${data.length} rows</p>` : ''}
  `;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (value % 1 !== 0) {
      return value.toFixed(2);
    }
    return value.toLocaleString();
  }
  return String(value);
}

export const reportGenerator = {
  generateReport
};