/**
 * Test for token UI integration functionality
 */

import { ReportConfig } from '@/types';
import { reportAuthTokens } from '../auth-tokens';

describe('Token UI Integration', () => {
  beforeEach(() => {
    // Reset token configuration
    reportAuthTokens.updateConfig({
      requireTokens: false,
      allowTokenRefresh: true,
      defaultExpirationHours: 168
    });
  });

  it('should handle token settings configuration', () => {
    const tokenSettings = {
      enabled: true,
      expirationHours: 24,
      allowRefresh: true
    };

    const config: ReportConfig = {
      id: 'test-config',
      platform: 'meta' as const,
      metrics: ['impressions', 'clicks'],
      level: 'campaign',
      dateRangeEnum: 'last7' as const,
      cadence: 'daily' as const,
      delivery: 'email' as const,
      email: 'test@example.com',
      tokenSettings
    };

    // Verify config includes token settings
    expect(config.tokenSettings).toBeDefined();
    expect(config.tokenSettings?.enabled).toBe(true);
    expect(config.tokenSettings?.expirationHours).toBe(24);
    expect(config.tokenSettings?.allowRefresh).toBe(true);
  });

  it('should handle disabled token settings', () => {
    const tokenSettings = {
      enabled: false,
      expirationHours: 168,
      allowRefresh: true
    };

    const config: ReportConfig = {
      id: 'test-config',
      platform: 'meta' as const,
      metrics: ['impressions', 'clicks'],
      level: 'campaign',
      dateRangeEnum: 'last7' as const,
      cadence: 'daily' as const,
      delivery: 'link' as const,
      tokenSettings
    };

    // Verify disabled configuration
    expect(config.tokenSettings?.enabled).toBe(false);
    expect(config.tokenSettings?.expirationHours).toBe(168);
  });

  it('should validate token settings expiration options', () => {
    const validExpirationHours = [1, 6, 24, 72, 168, 720];
    
    validExpirationHours.forEach(hours => {
      const tokenSettings = {
        enabled: true,
        expirationHours: hours,
        allowRefresh: true
      };
      
      expect(typeof tokenSettings.expirationHours).toBe('number');
      expect(tokenSettings.expirationHours).toBeGreaterThan(0);
    });
  });

  it('should handle token configuration updates', () => {
    // Initial configuration
    let tokenSettings = {
      enabled: false,
      expirationHours: 168,
      allowRefresh: true
    };

    // Simulate enabling tokens (like UI onChange)
    const updatedSettings = {
      ...tokenSettings,
      enabled: true,
      expirationHours: tokenSettings.enabled ? tokenSettings.expirationHours : 168
    };

    expect(updatedSettings.enabled).toBe(true);
    expect(updatedSettings.expirationHours).toBe(168);
    expect(updatedSettings.allowRefresh).toBe(true);
  });

  it('should handle PDF attachment setting', () => {
    const config: ReportConfig = {
      id: 'test-config',
      platform: 'meta' as const,
      metrics: ['impressions'],
      level: 'campaign',
      dateRangeEnum: 'last7' as const,
      cadence: 'daily' as const,
      delivery: 'email' as const,
      email: 'test@example.com',
      pdfAttachment: true,
      tokenSettings: {
        enabled: true,
        expirationHours: 24,
        allowRefresh: true
      }
    };

    // Verify PDF attachment can be enabled with token settings
    expect(config.pdfAttachment).toBe(true);
    expect(config.tokenSettings?.enabled).toBe(true);
    expect(config.delivery).toBe('email');
  });

  it('should generate proper signed URLs for UI display', () => {
    const baseUrl = 'https://example.com';
    const reportId = 'ui-test-123';
    
    // Generate signed URLs for both HTML and PDF
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

    // Verify URLs are properly formatted for UI consumption
    expect(htmlUrl).toContain(`${baseUrl}/reports/report-${reportId}.html`);
    expect(htmlUrl).toContain('token=');
    expect(pdfUrl).toContain(`${baseUrl}/reports/report-${reportId}.pdf`);
    expect(pdfUrl).toContain('token=');
    
    // Verify tokens can be extracted (for UI link handling)
    const htmlToken = new URL(htmlUrl).searchParams.get('token');
    const pdfToken = new URL(pdfUrl).searchParams.get('token');
    
    expect(htmlToken).toBeTruthy();
    expect(pdfToken).toBeTruthy();
    expect(htmlToken).not.toBe(pdfToken); // Should be different tokens
  });

  it('should handle dashboard display data correctly', () => {
    // Simulate report run data that would be displayed in dashboard
    const mockReportRun = {
      id: 'run-123',
      configId: 'config-123',
      timestamp: new Date(),
      status: 'success' as const,
      reportUrl: '/reports/report-run-123.html',
      signedUrl: 'https://example.com/reports/report-run-123.html?token=signed-token',
      pdfUrl: '/reports/report-run-123.pdf',
      signedPdfUrl: 'https://example.com/reports/report-run-123.pdf?token=signed-pdf-token'
    };

    // Verify dashboard would show signed URLs when available
    expect(mockReportRun.signedUrl).toContain('token=');
    expect(mockReportRun.signedPdfUrl).toContain('token=');
    
    // Verify fallback to regular URLs works
    const urlToUse = mockReportRun.signedUrl || mockReportRun.reportUrl;
    expect(urlToUse).toBe(mockReportRun.signedUrl);
  });

  it('should validate token settings form data', () => {
    interface FormData {
      platform: 'meta' | 'tiktok';
      metrics: string[];
      level: string;
      dateRangeEnum: 'last7' | 'last14' | 'last30' | 'lifetime';
      cadence: 'manual' | 'hourly' | '12hours' | 'daily';
      delivery: 'email' | 'link';
      email?: string;
      pdfAttachment?: boolean;
      tokenSettings?: {
        enabled: boolean;
        expirationHours?: number;
        allowRefresh?: boolean;
      };
    }

    const formData: FormData = {
      platform: 'meta',
      metrics: ['impressions', 'clicks'],
      level: 'campaign',
      dateRangeEnum: 'last7',
      cadence: 'daily',
      delivery: 'email',
      email: 'test@example.com',
      pdfAttachment: true,
      tokenSettings: {
        enabled: true,
        expirationHours: 72,
        allowRefresh: false
      }
    };

    // Verify form validation would pass
    expect(formData.metrics.length).toBeGreaterThan(0);
    expect(formData.level).toBeTruthy();
    if (formData.delivery === 'email') {
      expect(formData.email).toBeTruthy();
      expect(formData.email).toMatch(/\S+@\S+\.\S+/);
    }
    expect(formData.tokenSettings?.enabled).toBe(true);
    expect(formData.tokenSettings?.expirationHours).toBe(72);
  });
});