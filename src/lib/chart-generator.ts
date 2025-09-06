import { ReportConfig } from '@/types';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
  }[];
}

export interface EmailChartUrls {
  primary?: string;
  secondary?: string;
}

export async function generateEmailCharts(data: Record<string, unknown>[], config: ReportConfig): Promise<EmailChartUrls> {
  if (!data || data.length === 0 || !config.metrics || config.metrics.length === 0) {
    return {};
  }

  try {
    // Get metric display info
    const getMetricDisplay = (metric: string) => {
      const displays: Record<string, { label: string, format: (n: number) => string }> = {
        impressions: { label: 'Impressions', format: (n) => Math.round(n).toLocaleString() },
        clicks: { label: 'Clicks', format: (n) => Math.round(n).toLocaleString() },
        spend: { label: 'Spend', format: (n) => `$${n.toFixed(2)}` },
        conversions: { label: 'Conversions', format: (n) => Math.round(n).toString() },
        ctr: { label: 'CTR (%)', format: (n) => `${n.toFixed(2)}%` },
        cpc: { label: 'CPC', format: (n) => `$${n.toFixed(2)}` },
        reach: { label: 'Reach', format: (n) => Math.round(n).toLocaleString() },
        frequency: { label: 'Frequency', format: (n) => n.toFixed(2) },
        cost_per_conversion: { label: 'Cost/Conv', format: (n) => `$${n.toFixed(2)}` },
        conversion_rate: { label: 'Conv Rate (%)', format: (n) => `${n.toFixed(2)}%` },
        actions: { label: 'Actions', format: (n) => n.toFixed(2) },
        cost_per_action_type: { label: 'Cost/Action', format: (n) => `$${n.toFixed(2)}` }
      };
      
      return displays[metric] || { label: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), format: (n) => n.toString() };
    };

    // Group metrics by scale for better visualization
    const groupMetricsByScale = () => {
      const groups: Record<string, string[]> = {};
      const SCALE_THRESHOLD = 10;
      
      // Calculate average values for each metric
      const avgValues: Record<string, number> = {};
      config.metrics.forEach(metric => {
        const values = data.map(item => parseFloat(String(item[metric])) || 0);
        avgValues[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
      });
      
      // Group metrics by scale
      const sortedMetrics = [...config.metrics].sort((a, b) => avgValues[b] - avgValues[a]);
      
      let currentGroup = 'group1';
      groups[currentGroup] = [sortedMetrics[0]];
      
      for (let i = 1; i < sortedMetrics.length; i++) {
        const currentMetric = sortedMetrics[i];
        const lastGroupMetric = groups[currentGroup][0];
        
        const ratio = avgValues[lastGroupMetric] / avgValues[currentMetric];
        
        if (ratio > SCALE_THRESHOLD) {
          // Start new group
          currentGroup = `group${Object.keys(groups).length + 1}`;
          groups[currentGroup] = [currentMetric];
        } else {
          // Add to current group
          groups[currentGroup].push(currentMetric);
        }
      }
      
      return groups;
    };

    // Prepare chart data
    const chartData = data.slice(0, 10).map((item, index) => {
      const name = String(item.campaign_name || item.ad_name || item.date_start || `Item ${index + 1}`);
      const dataPoint: Record<string, any> = { name: name.length > 15 ? name.substring(0, 15) + '...' : name };
      
      config.metrics.forEach(metric => {
        dataPoint[metric] = parseFloat(String(item[metric])) || 0;
      });
      
      return dataPoint;
    });

    const labels = chartData.map(d => d.name);
    const metricGroups = groupMetricsByScale();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    const charts: EmailChartUrls = {};

    // Create primary chart
    const firstGroup = Object.values(metricGroups)[0] || [];
    if (firstGroup.length > 0) {
      const primaryMetrics = firstGroup.slice(0, 3);
      
      const datasets = primaryMetrics.map((metric, index) => {
        const display = getMetricDisplay(metric);
        return {
          label: display.label,
          data: chartData.map(d => d[metric]),
          backgroundColor: colors[index] + '80',
          borderColor: colors[index],
          borderWidth: 2,
          fill: false
        };
      });

      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: getScaleGroupTitle(primaryMetrics),
              font: { size: 16 }
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#e5e7eb'
              }
            },
            x: {
              grid: {
                color: '#e5e7eb'
              }
            }
          }
        }
      };

      charts.primary = await generateQuickChartUrl(chartConfig);
    }

    // Create secondary chart if there are more metric groups
    const remainingGroups = Object.values(metricGroups).slice(1);
    const secondaryMetrics = remainingGroups.flat().slice(0, 3);
    
    if (secondaryMetrics.length > 0) {
      const datasets = secondaryMetrics.map((metric, index) => {
        const display = getMetricDisplay(metric);
        return {
          label: display.label,
          data: chartData.map(d => d[metric]),
          backgroundColor: colors[index + 2] + '80',
          borderColor: colors[index + 2],
          borderWidth: 2,
          fill: false
        };
      });

      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: getScaleGroupTitle(secondaryMetrics),
              font: { size: 16 }
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#e5e7eb'
              }
            },
            x: {
              grid: {
                color: '#e5e7eb'
              }
            }
          }
        }
      };

      charts.secondary = await generateQuickChartUrl(chartConfig);
    }

    return charts;

  } catch (error) {
    console.error('Error generating email charts:', error);
    return {};
  }
}

function getScaleGroupTitle(metrics: string[]): string {
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
  const getMetricDisplay = (metric: string) => {
    const displays: Record<string, { label: string }> = {
      impressions: { label: 'Impressions' },
      clicks: { label: 'Clicks' },
      spend: { label: 'Spend' },
      conversions: { label: 'Conversions' },
      ctr: { label: 'CTR' },
      cpc: { label: 'CPC' },
      reach: { label: 'Reach' },
      frequency: { label: 'Frequency' },
      cost_per_conversion: { label: 'Cost/Conv' },
      conversion_rate: { label: 'Conv Rate' },
      actions: { label: 'Actions' },
      cost_per_action_type: { label: 'Cost/Action' }
    };
    
    return displays[metric] || { label: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
  };
  
  const display = getMetricDisplay(metrics[0]);
  return `${display.label} & Related`;
}

async function generateQuickChartUrl(chartConfig: any): Promise<string> {
  try {
    const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
    
    // Use QuickChart.io free service to generate chart images
    const chartUrl = `https://quickchart.io/chart?width=500&height=300&c=${encodedConfig}`;
    
    return chartUrl;
    
  } catch (error) {
    console.error('Error generating QuickChart URL:', error);
    throw error;
  }
}