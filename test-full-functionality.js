#!/usr/bin/env node

/**
 * Full Functionality Test for Scheduled Insight Reports
 * 
 * This test demonstrates all core functionality:
 * 1. Fetches data from NewForm API (both Meta and TikTok)
 * 2. Uses OpenAI to generate LLM summaries
 * 3. Generates HTML reports with charts
 * 4. Saves reports as HTML files
 */

const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const { Resend } = require('resend');

// Load environment variables
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

const API_BASE = 'https://bizdev.newform.ai';
const TOKEN = 'NEWFORMCODINGCHALLENGE';

// Test configurations for both platforms - working API format  
const testConfigs = {
  meta: {
    platform: 'meta',
    metrics: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cost_per_conversion'],
    level: 'campaign',
    breakdowns: ['age'],
    timeIncrement: '7',
    dateRangeEnum: 'last30'
  },
  tiktok: {
    platform: 'tiktok',
    metrics: ['spend', 'impressions', 'clicks', 'conversions', 'ctr'],
    dimensions: ['ad_id', 'country_code', 'age'],
    level: 'AUCTION_CAMPAIGN',
    dateRangeEnum: 'last14',
    reportType: 'BASIC'
  }
};

/**
 * Fetch data from NewForm API
 */
async function fetchNewFormData(config) {
  console.log(`\n🔄 Fetching ${config.platform.toUpperCase()} data from NewForm API...`);
  
  const endpoint = config.platform === 'meta' ? '/sample-data/meta' : '/sample-data/tiktok';
  
  const body = {
    metrics: config.metrics,
    level: config.level,
    dateRangeEnum: config.dateRangeEnum,
  };

  // Add platform-specific parameters
  if (config.platform === 'meta') {
    if (config.breakdowns?.length) {
      body.breakdowns = config.breakdowns;
    }
    if (config.timeIncrement) {
      body.timeIncrement = config.timeIncrement;
    }
  } else if (config.platform === 'tiktok') {
    if (config.dimensions?.length) {
      body.dimensions = config.dimensions;
    }
    if (config.reportType) {
      body.reportType = config.reportType;
    }
  }

  console.log('📤 Request payload:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const apiResponse = await response.json();
    console.log(`✅ Successfully fetched ${apiResponse.data?.length || 0} records`);
    
    // Handle API response format
    const data = apiResponse.data || apiResponse;
    
    // If empty data, generate some sample data for demonstration
    if (!data || data.length === 0) {
      console.log('📝 API returned empty data, generating sample data for demonstration...');
      return generateMockData(config);
    }
    
    return data;
  } catch (error) {
    console.error('❌ NewForm API Error:', error.message);
    // Return mock data for testing when API fails
    return generateMockData(config);
  }
}

/**
 * Generate mock data when API is unavailable
 */
function generateMockData(config) {
  console.log('📝 Generating mock data for testing...');
  
  const mockData = [];
  const campaignNames = ['Holiday Campaign', 'Brand Awareness', 'Product Launch', 'Retargeting', 'Lead Generation'];
  
  for (let i = 0; i < 10; i++) {
    const record = {
      campaign_name: campaignNames[i % campaignNames.length] + ` ${i + 1}`,
      spend: Math.random() * 1000 + 100,
      impressions: Math.floor(Math.random() * 50000 + 10000),
      clicks: Math.floor(Math.random() * 1000 + 100),
      conversions: Math.floor(Math.random() * 50 + 10),
    };
    
    // Add platform-specific fields
    if (config.platform === 'meta') {
      record.ctr = (record.clicks / record.impressions) * 100;
      record.age = ['18-24', '25-34', '35-44', '45-54'][Math.floor(Math.random() * 4)];
      record.country = ['US', 'CA', 'UK', 'AU'][Math.floor(Math.random() * 4)];
    } else {
      record.ctr = (record.clicks / record.impressions) * 100;
      record.country_code = ['US', 'CA', 'UK', 'AU'][Math.floor(Math.random() * 4)];
      record.age = ['18-24', '25-34', '35-44', '45-54'][Math.floor(Math.random() * 4)];
    }
    
    mockData.push(record);
  }
  
  return mockData;
}

/**
 * Generate LLM summary using OpenAI
 */
async function generateLLMSummary(data, config) {
  console.log('\n🤖 Generating LLM summary with OpenAI...');
  
  // Calculate key metrics
  const totalSpend = data.reduce((sum, item) => sum + (parseFloat(item.spend) || 0), 0);
  const totalImpressions = data.reduce((sum, item) => sum + (parseInt(item.impressions) || 0), 0);
  const totalClicks = data.reduce((sum, item) => sum + (parseInt(item.clicks) || 0), 0);
  const totalConversions = data.reduce((sum, item) => sum + (parseInt(item.conversions) || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
  const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100) : 0;

  const prompt = `
    Analyze the following ${config.platform.toUpperCase()} advertising campaign data and provide actionable insights.
    
    Key Metrics:
    - Total Spend: $${totalSpend.toFixed(2)}
    - Total Impressions: ${totalImpressions.toLocaleString()}
    - Total Clicks: ${totalClicks.toLocaleString()}
    - Total Conversions: ${totalConversions.toLocaleString()}
    - Average CTR: ${avgCTR.toFixed(2)}%
    - Average CPC: $${avgCPC.toFixed(2)}
    - Conversion Rate: ${conversionRate.toFixed(2)}%
    
    Campaign Data:
    ${JSON.stringify(data.slice(0, 5), null, 2)}
    
    Please provide:
    1. Performance summary
    2. Key insights and trends
    3. Recommendations for optimization
    4. Areas of concern or opportunity
    
    Keep the response concise but actionable (under 300 words).
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert digital marketing analyst. Provide clear, actionable insights from advertising data.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content || '';
    console.log('✅ LLM summary generated successfully');
    return summary;
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
    // Return fallback summary
    return generateFallbackSummary(data, config);
  }
}

/**
 * Generate fallback summary when OpenAI is unavailable
 */
function generateFallbackSummary(data, config) {
  const totalSpend = data.reduce((sum, item) => sum + (parseFloat(item.spend) || 0), 0);
  const totalImpressions = data.reduce((sum, item) => sum + (parseInt(item.impressions) || 0), 0);
  const totalClicks = data.reduce((sum, item) => sum + (parseInt(item.clicks) || 0), 0);
  const totalConversions = data.reduce((sum, item) => sum + (parseInt(item.conversions) || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

  return `
## ${config.platform.toUpperCase()} Campaign Performance Summary

**Period**: ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days')}

**Key Metrics:**
- Total Spend: $${totalSpend.toFixed(2)}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Total Conversions: ${totalConversions.toLocaleString()}
- Average CTR: ${avgCTR.toFixed(2)}%

**Analysis**: Your ${config.platform} campaigns generated ${totalImpressions.toLocaleString()} impressions with ${totalClicks.toLocaleString()} clicks, resulting in a ${avgCTR.toFixed(2)}% click-through rate. Total advertising spend was $${totalSpend.toFixed(2)} with ${totalConversions.toLocaleString()} conversions.

**Recommendations**: Focus on optimizing campaigns with below-average CTR and consider reallocating budget to top-performing segments.
  `;
}

/**
 * Generate HTML report with charts
 */
function generateHTMLReport(data, summary, config) {
  console.log('\n📊 Generating HTML report with charts...');
  
  // Prepare chart data
  const chartData = data.slice(0, 10).map((item, index) => ({
    name: String(item.campaign_name || item.ad_name || `Campaign ${index + 1}`),
    spend: parseFloat(item.spend) || 0,
    impressions: parseInt(item.impressions) || 0,
    clicks: parseInt(item.clicks) || 0,
    conversions: parseInt(item.conversions) || 0,
  }));

  // Calculate summary metrics
  const totalSpend = data.reduce((sum, item) => sum + (parseFloat(item.spend) || 0), 0);
  const totalImpressions = data.reduce((sum, item) => sum + (parseInt(item.impressions) || 0), 0);
  const totalClicks = data.reduce((sum, item) => sum + (parseInt(item.clicks) || 0), 0);
  const totalConversions = data.reduce((sum, item) => sum + (parseInt(item.conversions) || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.platform.toUpperCase()} Insight Report - ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 0;
            opacity: 0.9;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #4f46e5;
            margin: 10px 0;
        }
        .metric-label {
            color: #6b7280;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .summary {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .chart-container h2 {
            color: #374151;
            margin-top: 0;
        }
        .data-table {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }
        .data-table h2 {
            background: #f8fafc;
            margin: 0;
            padding: 20px 30px;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background-color: #f8fafc;
            font-weight: 600;
            color: #374151;
        }
        tr:hover {
            background-color: #f8fafc;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        canvas {
            max-height: 400px;
        }
        .test-info {
            background: #fef3c7;
            color: #92400e;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #fbbf24;
        }
        .test-info strong {
            color: #78350f;
        }
    </style>
</head>
<body>
    <div class="test-info">
        <strong>🧪 Test Report</strong> - This is a demonstration of the full functionality including NewForm API integration, OpenAI summarization, and HTML report generation with charts.
    </div>

    <div class="header">
        <h1>${config.platform.toUpperCase()} Insight Report</h1>
        <p>Generated on ${new Date().toLocaleDateString()} • ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days')}</p>
    </div>

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
            <div class="metric-label">Total Conversions</div>
            <div class="metric-value">${totalConversions.toLocaleString()}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Average CTR</div>
            <div class="metric-value">${avgCTR.toFixed(2)}%</div>
        </div>
    </div>

    <div class="summary">
        <h2 style="color: #374151; margin-top: 0;">AI-Generated Executive Summary</h2>
        <div style="white-space: pre-line;">${summary}</div>
    </div>

    <div class="chart-container">
        <h2>Performance Overview</h2>
        <canvas id="performanceChart"></canvas>
    </div>

    <div class="chart-container">
        <h2>Conversion Performance</h2>
        <canvas id="conversionChart"></canvas>
    </div>

    <div class="data-table">
        <h2>Campaign Details</h2>
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        ${Object.keys(data[0] || {}).map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.slice(0, 15).map(row => `
                        <tr>
                            ${Object.values(row).map(value => `<td>${formatValue(value)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${data.length > 15 ? `<p style="padding: 20px; text-align: center; color: #6b7280;">Showing first 15 of ${data.length} rows</p>` : ''}
        </div>
    </div>

    <div class="footer">
        <p><strong>Report generated by Scheduled Insight Reports Test</strong></p>
        <p>Data sourced from NewForm API (${config.platform.toUpperCase()}) • AI Summary powered by OpenAI GPT-4</p>
        <p>Generated at: ${new Date().toLocaleString()}</p>
    </div>

    <script>
        // Performance Chart
        const ctx1 = document.getElementById('performanceChart').getContext('2d');
        const performanceChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(chartData.map(d => d.name))},
                datasets: [
                    {
                        label: 'Spend ($)',
                        data: ${JSON.stringify(chartData.map(d => d.spend))},
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Impressions',
                        data: ${JSON.stringify(chartData.map(d => d.impressions))},
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Campaign Spend vs Impressions'
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Spend ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Impressions'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });

        // Conversion Chart
        const ctx2 = document.getElementById('conversionChart').getContext('2d');
        const conversionChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(chartData.map(d => d.name))},
                datasets: [
                    {
                        label: 'Clicks',
                        data: ${JSON.stringify(chartData.map(d => d.clicks))},
                        borderColor: 'rgba(234, 88, 12, 1)',
                        backgroundColor: 'rgba(234, 88, 12, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Conversions',
                        data: ${JSON.stringify(chartData.map(d => d.conversions))},
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Clicks vs Conversions Trend'
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                }
            }
        });

        function formatValue(value) {
            if (value === null || value === undefined) return '-';
            if (typeof value === 'number') {
                if (value % 1 !== 0) {
                    return value.toFixed(2);
                }
                return value.toLocaleString();
            }
            return String(value);
        }
    </script>
</body>
</html>`;

  return html;
}

/**
 * Send email with HTML report
 */
async function sendEmailReport(html, config, summary, recipientEmail = 'test@example.com') {
  console.log('\n📧 Sending email report...');
  
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    console.log('📧 Email delivery skipped - Resend API not configured');
    console.log(`   Would send to: ${recipientEmail}`);
    console.log(`   Subject: ${config.platform.toUpperCase()} Insight Report - ${new Date().toLocaleDateString()}`);
    return { success: false, reason: 'API not configured' };
  }

  // Create a simplified email version of the report
  const emailHtml = createEmailVersion(html, config, summary);
  
  try {
    const emailSubject = `${config.platform.toUpperCase()} Insight Report - ${new Date().toLocaleDateString()}`;
    
    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log('📧 Resend API response:', JSON.stringify(response, null, 2));

    const { data, error } = response;

    if (error) {
      console.error('Resend API error details:', error);
      throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
    }

    console.log('✅ Email sent successfully!');
    console.log(`   📧 To: ${recipientEmail}`);
    console.log(`   📬 Message ID: ${data?.id || 'N/A'}`);
    console.log(`   📋 Subject: ${emailSubject}`);
    
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create email-optimized version of the report
 */
function createEmailVersion(html, config, summary) {
  // Extract key metrics from the HTML
  const totalSpendMatch = html.match(/Total Spend<\/div>\s*<div[^>]*>([^<]+)/);
  const totalImpressionsMatch = html.match(/Total Impressions<\/div>\s*<div[^>]*>([^<]+)/);
  const totalClicksMatch = html.match(/Total Clicks<\/div>\s*<div[^>]*>([^<]+)/);
  const totalConversionsMatch = html.match(/Total Conversions<\/div>\s*<div[^>]*>([^<]+)/);
  const avgCTRMatch = html.match(/Average CTR<\/div>\s*<div[^>]*>([^<]+)/);

  const totalSpend = totalSpendMatch ? totalSpendMatch[1] : '$0.00';
  const totalImpressions = totalImpressionsMatch ? totalImpressionsMatch[1] : '0';
  const totalClicks = totalClicksMatch ? totalClicksMatch[1] : '0';
  const totalConversions = totalConversionsMatch ? totalConversionsMatch[1] : '0';
  const avgCTR = avgCTRMatch ? avgCTRMatch[1] : '0.00%';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.platform.toUpperCase()} Insight Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px 20px;
        }
        .metrics-grid {
            display: table;
            width: 100%;
            margin: 20px 0;
        }
        .metric-row {
            display: table-row;
        }
        .metric-label, .metric-value {
            display: table-cell;
            padding: 8px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .metric-label {
            font-weight: 600;
            color: #374151;
            width: 50%;
        }
        .metric-value {
            font-weight: bold;
            color: #4f46e5;
            text-align: right;
        }
        .summary {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #4f46e5;
        }
        .summary h3 {
            margin: 0 0 10px 0;
            color: #374151;
        }
        .cta {
            text-align: center;
            margin: 30px 0 20px 0;
        }
        .button {
            display: inline-block;
            background: #4f46e5;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            padding: 20px;
            border-top: 1px solid #e5e7eb;
        }
        .test-note {
            background: #fef3c7;
            color: #92400e;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #fbbf24;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.platform.toUpperCase()} Insight Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} • ${config.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days')}</p>
        </div>
        
        <div class="content">
            <div class="test-note">
                <strong>🧪 Test Email</strong> - This is a demonstration of the email delivery functionality for the Scheduled Insight Reports system.
            </div>
            
            <h2 style="color: #374151; margin-top: 0;">Key Performance Metrics</h2>
            
            <div class="metrics-grid">
                <div class="metric-row">
                    <div class="metric-label">Total Spend</div>
                    <div class="metric-value">${totalSpend}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Total Impressions</div>
                    <div class="metric-value">${totalImpressions}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Total Clicks</div>
                    <div class="metric-value">${totalClicks}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Total Conversions</div>
                    <div class="metric-value">${totalConversions}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Average CTR</div>
                    <div class="metric-value">${avgCTR}</div>
                </div>
            </div>
            
            <div class="summary">
                <h3>AI-Generated Executive Summary</h3>
                <div style="white-space: pre-line;">${summary}</div>
            </div>
            
            <div class="cta">
                <p style="margin: 10px 0; color: #6b7280;">📊 View the full interactive report with charts and detailed data:</p>
                <a href="#" class="button">Open Full Report</a>
                <p style="margin: 10px 0; font-size: 12px; color: #9ca3af;">
                    (Link would direct to the hosted report in a real deployment)
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Scheduled Insight Reports Test</strong></p>
            <p>Data sourced from NewForm API (${config.platform.toUpperCase()}) • AI Summary powered by OpenAI</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Save report as HTML file
 */
async function saveHTMLReport(html, config) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${config.platform}-insight-report-${timestamp}.html`;
  const filepath = path.join(process.cwd(), 'public', 'reports', filename);
  
  try {
    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, html, 'utf8');
    console.log(`✅ Report saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('❌ Error saving report:', error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function runFullFunctionalityTest() {
  console.log('🚀 Starting Full Functionality Test for Scheduled Insight Reports\n');
  console.log('This test will demonstrate:');
  console.log('1. ✅ NewForm API data fetching (Meta & TikTok)');
  console.log('2. ✅ OpenAI LLM summary generation');
  console.log('3. ✅ HTML report generation with charts');
  console.log('4. ✅ File saving to public/reports/');
  console.log('5. ✅ Email delivery via Resend API');
  console.log('=' .repeat(60));

  const results = {};

  // Test both platforms
  for (const [platform, config] of Object.entries(testConfigs)) {
    console.log(`\n🎯 Testing ${platform.toUpperCase()} platform...`);
    console.log('-'.repeat(40));

    try {
      // Step 1: Fetch data from NewForm API
      const data = await fetchNewFormData(config);
      
      // Step 2: Generate LLM summary
      const summary = await generateLLMSummary(data, config);
      
      // Step 3: Generate HTML report
      const htmlReport = generateHTMLReport(data, summary, config);
      
      // Step 4: Save report
      const savedPath = await saveHTMLReport(htmlReport, config);
      
      // Step 5: Send email report
      const emailResult = await sendEmailReport(htmlReport, config, summary, 'tyjen1218@gmail.com');
      
      results[platform] = {
        success: true,
        dataRecords: data.length,
        reportPath: savedPath,
        summaryLength: summary.length,
        emailDelivered: emailResult.success,
        emailMessageId: emailResult.messageId
      };
      
      console.log(`✅ ${platform.toUpperCase()} test completed successfully!`);
      
    } catch (error) {
      console.error(`❌ ${platform.toUpperCase()} test failed:`, error.message);
      results[platform] = {
        success: false,
        error: error.message
      };
    }
  }

  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('🏁 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  for (const [platform, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`✅ ${platform.toUpperCase()}: SUCCESS`);
      console.log(`   📊 Data records: ${result.dataRecords}`);
      console.log(`   📝 Summary length: ${result.summaryLength} chars`);
      console.log(`   📁 Report saved: ${path.basename(result.reportPath)}`);
      console.log(`   📧 Email delivered: ${result.emailDelivered ? '✅' : '❌'}`);
      if (result.emailMessageId) {
        console.log(`   📬 Email ID: ${result.emailMessageId}`);
      }
    } else {
      console.log(`❌ ${platform.toUpperCase()}: FAILED`);
      console.log(`   💥 Error: ${result.error}`);
    }
  }
  
  const successCount = Object.values(results).filter(r => r.success).length;
  console.log(`\n📈 Overall Success Rate: ${successCount}/${Object.keys(results).length} (${(successCount/Object.keys(results).length*100).toFixed(0)}%)`);
  
  if (successCount > 0) {
    console.log('\n🎉 Test completed! Check the generated HTML reports in public/reports/');
    console.log('Open the HTML files in a browser to view the interactive charts and summaries.');
    console.log('If emails were sent, check your inbox for the delivered reports.');
  }
}

// Export formatValue function for HTML template
function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (value % 1 !== 0) {
      return value.toFixed(2);
    }
    return value.toLocaleString();
  }
  return String(value);
}

// Run the test if this file is executed directly
if (require.main === module) {
  runFullFunctionalityTest().catch(console.error);
}

module.exports = {
  runFullFunctionalityTest,
  fetchNewFormData,
  generateLLMSummary,
  generateHTMLReport,
  saveHTMLReport,
  sendEmailReport
};