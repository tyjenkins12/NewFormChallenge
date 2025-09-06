/**
 * Test for email generation with signed URLs
 */

import { generateEmailReport } from '../report-generator';
import { reportAuthTokens } from '../auth-tokens';
import { ReportConfig } from '@/types';

describe('Email Generation with Signed URLs', () => {
  const mockData = [
    {
      impressions: 1000,
      clicks: 50,
      spend: 25.50,
      conversions: 5,
      ctr: 5.0,
      cpc: 0.51
    }
  ];

  const mockConfig: ReportConfig = {
    id: 'test-config',
    platform: 'meta' as const,
    metrics: ['impressions', 'clicks', 'spend'],
    level: 'campaign',
    dateRangeEnum: 'last7' as const,
    cadence: 'daily' as const,
    delivery: 'email' as const,
    email: 'test@example.com',
    tokenSettings: {
      enabled: true,
      expirationHours: 24,
      allowRefresh: true
    }
  };

  const mockSummary = "Test campaign performance shows positive trends with healthy CTR.";

  beforeEach(() => {
    // Reset token configuration
    reportAuthTokens.updateConfig({
      requireTokens: false,
      allowTokenRefresh: true,
      defaultExpirationHours: 168
    });
  });

  it('should generate email without signed URLs when none provided', async () => {
    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig);
    
    expect(emailHtml).toContain('Key Performance Indicators');
    expect(emailHtml).toContain('Executive Summary');
    expect(emailHtml).not.toContain('Report Actions');
    expect(emailHtml).not.toContain('View Full Report');
    expect(emailHtml).not.toContain('Download PDF');
  });

  it('should generate email with HTML report button when signed URL provided', async () => {
    const signedUrls = {
      reportUrl: 'https://example.com/reports/report-test.html?token=signed-token'
    };

    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig, signedUrls);
    
    expect(emailHtml).toContain('Key Performance Indicators');
    expect(emailHtml).toContain('Executive Summary');
    expect(emailHtml).toContain('Report Actions');
    expect(emailHtml).toContain('View Full Report');
    expect(emailHtml).toContain(signedUrls.reportUrl);
    expect(emailHtml).not.toContain('Download PDF');
  });

  it('should generate email with PDF download button when signed PDF URL provided', async () => {
    const signedUrls = {
      pdfUrl: 'https://example.com/reports/report-test.pdf?token=signed-pdf-token'
    };

    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig, signedUrls);
    
    expect(emailHtml).toContain('Key Performance Indicators');
    expect(emailHtml).toContain('Executive Summary');
    expect(emailHtml).toContain('Report Actions');
    expect(emailHtml).toContain('Download PDF');
    expect(emailHtml).toContain(signedUrls.pdfUrl);
    expect(emailHtml).not.toContain('View Full Report');
  });

  it('should generate email with both buttons when both signed URLs provided', async () => {
    const signedUrls = {
      reportUrl: 'https://example.com/reports/report-test.html?token=signed-token',
      pdfUrl: 'https://example.com/reports/report-test.pdf?token=signed-pdf-token'
    };

    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig, signedUrls);
    
    expect(emailHtml).toContain('Key Performance Indicators');
    expect(emailHtml).toContain('Executive Summary');
    expect(emailHtml).toContain('Report Actions');
    expect(emailHtml).toContain('View Full Report');
    expect(emailHtml).toContain('Download PDF');
    expect(emailHtml).toContain(signedUrls.reportUrl);
    expect(emailHtml).toContain(signedUrls.pdfUrl);
    expect(emailHtml).toContain('Links expire after configured time period');
  });

  it('should include proper button styling for email clients', async () => {
    const signedUrls = {
      reportUrl: 'https://example.com/reports/report-test.html?token=signed-token',
      pdfUrl: 'https://example.com/reports/report-test.pdf?token=signed-pdf-token'
    };

    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig, signedUrls);
    
    // Check for inline CSS styling for email compatibility
    expect(emailHtml).toContain('display: inline-block');
    expect(emailHtml).toContain('padding: 12px 24px');
    expect(emailHtml).toContain('text-decoration: none');
    expect(emailHtml).toContain('border-radius: 8px');
    expect(emailHtml).toContain('background: linear-gradient');
    
    // Check different button colors
    expect(emailHtml).toContain('#667eea'); // View Report button color
    expect(emailHtml).toContain('#10b981'); // Download PDF button color
  });

  it('should work with real JWT tokens', async () => {
    // Generate real signed URLs using the token system
    const baseUrl = 'https://example.com';
    const reportId = 'test-report-123';
    
    const htmlUrl = reportAuthTokens.generateSignedUrl({
      reportId,
      reportType: 'html',
      baseUrl,
      permissions: ['read', 'download']
    });
    
    const pdfUrl = reportAuthTokens.generateSignedUrl({
      reportId,
      reportType: 'pdf', 
      baseUrl,
      permissions: ['read']
    });

    const signedUrls = {
      reportUrl: htmlUrl,
      pdfUrl: pdfUrl
    };

    const emailHtml = await generateEmailReport(mockData, mockSummary, mockConfig, signedUrls);
    
    // Verify the generated email contains the actual signed URLs
    expect(emailHtml).toContain(htmlUrl);
    expect(emailHtml).toContain(pdfUrl);
    expect(emailHtml).toContain('token=');
    
    // Verify URLs are properly formatted
    expect(htmlUrl).toMatch(/^https:\/\/.*\.html\?token=.*$/);
    expect(pdfUrl).toMatch(/^https:\/\/.*\.pdf\?token=.*$/);
  });
});