import { ReportConfig } from '@/types';
import { generateEmailCharts } from './chart-generator';

export async function generateReport(data: Record<string, unknown>[], summary: string, config: ReportConfig): Promise<string> {
  // Handle empty data gracefully
  const hasData = data && data.length > 0;
  
  return generateCustomizedReport(data, summary, config, hasData);
}

export async function generateEmailReport(data: Record<string, unknown>[], summary: string, config: ReportConfig): Promise<string> {
  // Handle empty data gracefully
  const hasData = data && data.length > 0;
  
  return generateEmailOptimizedReport(data, summary, config, hasData);
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

  // Group metrics by actual data scale (not just category) for better chart visualization
  const groupMetricsByScale = () => {
    if (!hasData || data.length === 0) {
      // Fallback to single group if no data
      return { group1: config.metrics };
    }

    // Calculate the actual range/scale of each metric's values
    const metricScales: Record<string, { avg: number, max: number }> = {};
    
    config.metrics.forEach(metric => {
      const values = data.map(item => parseFloat(String(item[metric])) || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      
      metricScales[metric] = { avg, max };
    });

    // Group metrics that have similar scales (within 10x of each other)
    const groups: Record<string, string[]> = {};
    const SCALE_THRESHOLD = 10; // Metrics can be at most 10x different

    config.metrics.forEach(metric => {
      const currentScale = metricScales[metric];
      let grouped = false;

      // Try to find an existing group this metric can join
      for (const [groupName, existingMetrics] of Object.entries(groups)) {
        if (existingMetrics.length > 0) {
          const firstMetricInGroup = existingMetrics[0];
          const existingScale = metricScales[firstMetricInGroup];
          
          // Check if scales are compatible (within threshold)
          const ratio = Math.max(currentScale.avg, existingScale.avg) / 
                       Math.min(currentScale.avg, existingScale.avg);
          
          if (ratio <= SCALE_THRESHOLD) {
            groups[groupName].push(metric);
            grouped = true;
            break;
          }
        }
      }

      // If not grouped, create a new group
      if (!grouped) {
        const newGroupName = `group${Object.keys(groups).length + 1}`;
        groups[newGroupName] = [metric];
      }
    });

    return groups;
  };

  // Generate chart data for selected metrics with proper scaling
  const generateChartData = () => {
    if (!hasData) {
      return { 
        primary: { labels: ['No Data'], datasets: [] },
        secondary: { labels: ['No Data'], datasets: [] }
      };
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

    const labels = chartData.map(d => d.name);
    const metricGroups = groupMetricsByScale();
    const colors = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa'];

    // Create primary chart with first metric group (up to 3 metrics)
    const firstGroup = Object.values(metricGroups)[0] || [];
    const primaryMetrics = firstGroup.slice(0, 3);
    
    const primaryDatasets = primaryMetrics.map((metric, index) => {
      const display = getMetricDisplay(metric);
      return {
        label: display.label,
        data: chartData.map(d => d[metric]),
        backgroundColor: colors[index] + '80',
        borderColor: colors[index],
        borderWidth: 2,
        type: index === 0 ? 'bar' : 'line',
        tension: 0.3
      };
    });

    // Create secondary chart with remaining metrics (different scale)
    const remainingGroups = Object.values(metricGroups).slice(1);
    const secondaryMetrics = remainingGroups.flat().slice(0, 3);
    
    const secondaryDatasets = secondaryMetrics.map((metric, index) => {
      const display = getMetricDisplay(metric);
      return {
        label: display.label,
        data: chartData.map(d => d[metric]),
        backgroundColor: colors[index + 2] + '80',
        borderColor: colors[index + 2],
        borderWidth: 2,
        type: index % 2 === 0 ? 'bar' : 'line',
        tension: 0.3
      };
    });

    return {
      primary: {
        labels,
        datasets: primaryDatasets,
        title: primaryMetrics.length > 0 ? getScaleGroupTitle(primaryMetrics) : 'Primary Metrics'
      },
      secondary: {
        labels,
        datasets: secondaryDatasets,
        title: secondaryMetrics.length > 0 ? getScaleGroupTitle(secondaryMetrics) : 'Secondary Metrics'
      }
    };
  };

  // Get appropriate title for metric scale group
  const getScaleGroupTitle = (metrics: string[]): string => {
    if (metrics.length === 0) return 'Performance Metrics';
    
    // Check what type of metrics are in this group
    const volumeMetrics = ['impressions', 'clicks', 'conversions', 'reach', 'actions'];
    const monetaryMetrics = ['spend', 'cpc', 'cost_per_conversion', 'cost_per_action_type'];
    const percentageMetrics = ['ctr', 'conversion_rate', 'frequency'];
    
    const hasVolume = metrics.some(m => volumeMetrics.includes(m));
    const hasMonetary = metrics.some(m => monetaryMetrics.includes(m));
    const hasPercentage = metrics.some(m => percentageMetrics.includes(m));
    
    // Return the most appropriate title based on the mix
    if (hasVolume && !hasMonetary && !hasPercentage) return 'Volume Metrics';
    if (hasMonetary && !hasVolume && !hasPercentage) return 'Monetary Metrics';
    if (hasPercentage && !hasVolume && !hasMonetary) return 'Rate Metrics';
    
    // Mixed group - use a generic title with the primary metric
    const display = getMetricDisplay(metrics[0]);
    return `${display.label} & Related`;
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
    
    const maxRows = Math.min(data.length, 15); // Limit to 15 rows for PDF
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
        .charts-section{margin:18px 0}
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
        
        /* PDF-specific styles */
        @media print {
          .container { padding: 8px !important; }
          .card, .charts .card { page-break-inside: avoid; margin-bottom: 12px; }
          .kpis { page-break-inside: avoid; margin: 12px 0; }
          .charts-section { page-break-inside: avoid; margin: 12px 0; }
          .charts { grid-template-columns: 1fr 1fr !important; gap: 12px; }
          .charts .card { margin-bottom: 0; }
          .charts .card h3 { font-size: 16px; margin: 0 0 8px 0; }
          canvas { page-break-inside: avoid; height: 320px !important; }
          .table-wrap { overflow: visible; }
          table { font-size: 11px; page-break-inside: auto; }
          th, td { padding: 8px 10px; }
          tbody tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          header { margin-bottom: 8px; }
          .summary-section { page-break-inside: avoid; margin: 12px 0; }
          .summary-section .card { padding: 12px; }
          footer { page-break-before: avoid; margin-top: 10px; }
        }
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
    <section class="charts-section">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: var(--text);">Performance Graphs</h2>
        <div class="charts" aria-label="Charts">
            <div class="card">
                <h3>${chartData.primary.title || 'Primary Metrics'}</h3>
                <canvas id="chartPrimary" width="380" height="320" aria-label="Chart of primary selected metrics" role="img"></canvas>
            </div>
            ${chartData.secondary.datasets.length > 0 ? `
            <div class="card">
                <h3>${chartData.secondary.title || 'Secondary Metrics'}</h3>
                <canvas id="chartSecondary" width="380" height="320" aria-label="Chart of secondary metrics" role="img"></canvas>
            </div>
            ` : ''}
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
    
    if (hasData && chartData.primary.labels && chartData.primary.labels.length > 0) {
        // Primary metrics chart
        if (chartData.primary.datasets.length > 0) {
            const ctxPrimary = document.getElementById('chartPrimary').getContext('2d');
            new Chart(ctxPrimary, {
                type: 'bar',
                data: {
                    labels: chartData.primary.labels,
                    datasets: chartData.primary.datasets
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { 
                            display: true,
                            position: 'top'
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#9ca3af'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#9ca3af'
                            }
                        }
                    }
                }
            });
        }

        // Secondary metrics chart (only if we have secondary metrics)
        if (chartData.secondary.datasets.length > 0) {
            const ctxSecondary = document.getElementById('chartSecondary').getContext('2d');
            new Chart(ctxSecondary, {
                type: 'bar',
                data: {
                    labels: chartData.secondary.labels,
                    datasets: chartData.secondary.datasets
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { 
                            display: true,
                            position: 'top'
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#9ca3af'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#9ca3af'
                            }
                        }
                    }
                }
            });
        }
    } else {
        // Show "No data" message in charts
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

async function generateEmailOptimizedReport(data: Record<string, unknown>[], summary: string, config: ReportConfig, hasData: boolean): Promise<string> {
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
      case 'cost_per_conversion':
        return totalConversions > 0 ? totalSpend / totalConversions : 0;
      case 'conversion_rate':
        return totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      case 'frequency':
        return calculateMetricTotal(data, 'reach') > 0 ? totalImpressions / calculateMetricTotal(data, 'reach') : 0;
      default:
        return calculateMetricTotal(data, metric);
    }
  };

  // Generate KPI cards for selected metrics
  const generateEmailKPIs = (): string => {
    if (!hasData || !config.metrics || config.metrics.length === 0) {
      return '<p style="color: #6b7280; text-align: center; padding: 20px;">No metrics data available</p>';
    }

    const selectedMetrics = config.metrics.slice(0, 6); // Limit to 6 for email
    
    return `
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        <tr>
          ${selectedMetrics.map(metric => {
            const display = getMetricDisplay(metric);
            const value = calculateDerivedMetric(data, metric);
            return `
              <td style="width: ${100/selectedMetrics.length}%; padding: 15px; background: #f8f9fa; border: 1px solid #e9ecef; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #1f2937;">${display.format(value)}</div>
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">${display.label}</div>
              </td>
            `;
          }).join('')}
        </tr>
      </table>
    `;
  };

  // Generate simple data table for email
  const generateEmailTable = (): string => {
    if (!hasData || data.length === 0) {
      return '<p style="color: #6b7280; text-align: center; padding: 20px;">No detailed data available</p>';
    }
    
    const headers = Object.keys(data[0]);
    const maxRows = Math.min(data.length, 10); // Limit to 10 rows for email
    
    return `
      <table cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f8f9fa;">
            ${headers.map(header => 
              `<th style="border: 1px solid #e9ecef; text-align: left; font-size: 12px; color: #374151; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${header.replace(/_/g, ' ')}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, maxRows).map((row, index) => `
            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              ${headers.map(header => `<td style="border: 1px solid #e9ecef; font-size: 13px; color: #374151;">${formatValue(row[header])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.length > maxRows ? `<p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 10px;">Showing first ${maxRows} of ${data.length} records</p>` : ''}
    `;
  };

  // Generate charts for email
  const chartUrls = await generateEmailCharts(data, config);

  // Email-optimized HTML with inline styles
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${config.platform.toUpperCase()} Insight Report</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, sans-serif; line-height: 1.4;">
    <table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="padding: 30px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${config.platform.toUpperCase()} Performance Report</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Generated on ${new Date().toLocaleDateString()} • ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 Days')}</p>
            </td>
        </tr>
        
        <!-- Configuration Info -->
        <tr>
            <td style="padding: 20px; background-color: #f8f9fa; border-bottom: 1px solid #e9ecef;">
                <table cellpadding="4" cellspacing="0" style="width: 100%;">
                    <tr>
                        <td style="font-size: 12px; color: #6b7280; font-weight: bold;">Platform:</td>
                        <td style="font-size: 12px; color: #374151;">${config.platform.toUpperCase()}</td>
                        <td style="font-size: 12px; color: #6b7280; font-weight: bold;">Level:</td>
                        <td style="font-size: 12px; color: #374151;">${config.level}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 12px; color: #6b7280; font-weight: bold;">Metrics:</td>
                        <td style="font-size: 12px; color: #374151;">${config.metrics.length} selected</td>
                        <td style="font-size: 12px; color: #6b7280; font-weight: bold;">Date Range:</td>
                        <td style="font-size: 12px; color: #374151;">${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 Days')}</td>
                    </tr>
                </table>
            </td>
        </tr>
        
        <!-- KPIs -->
        <tr>
            <td style="padding: 20px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Key Performance Indicators</h2>
                ${generateEmailKPIs()}
            </td>
        </tr>
        
        <!-- Summary -->
        <tr>
            <td style="padding: 0 20px 20px 20px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Executive Summary</h2>
                <div style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; color: #374151; font-size: 14px; line-height: 1.6;">
                    ${summary}
                </div>
            </td>
        </tr>
        
        <!-- Charts -->
        ${(chartUrls.primary || chartUrls.secondary) ? `
        <tr>
            <td style="padding: 0 20px 20px 20px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Performance Charts</h2>
                
                ${chartUrls.primary ? `
                <div style="margin-bottom: 20px; text-align: center;">
                    <img src="${chartUrls.primary}" alt="Primary metrics chart" style="max-width: 100%; height: auto; border: 1px solid #e9ecef; border-radius: 8px;">
                </div>
                ` : ''}
                
                ${chartUrls.secondary ? `
                <div style="margin-bottom: 20px; text-align: center;">
                    <img src="${chartUrls.secondary}" alt="Secondary metrics chart" style="max-width: 100%; height: auto; border: 1px solid #e9ecef; border-radius: 8px;">
                </div>
                ` : ''}
            </td>
        </tr>
        ` : ''}
        
        <!-- Data Table -->
        <tr>
            <td style="padding: 0 20px 20px 20px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Detailed Data</h2>
                ${generateEmailTable()}
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 20px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    This report was automatically generated by your scheduled insight system.
                </p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">
                    Data shows ${hasData ? data.length : 0} records from ${config.platform.toUpperCase()} for ${config.dateRangeEnum} period.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`;

  return html;
}

export const reportGenerator = {
  generateReport,
  generateEmailReport
};