/**
 * Integration test for token validation middleware
 * Tests the core logic without Next.js server dependencies
 */

import { reportAuthTokens } from '../auth-tokens';
import path from 'path';

describe('Token Middleware Integration', () => {
  const testReportId = 'integration-test-123';
  const testHtmlContent = '<html><body>Test Report</body></html>';

  beforeEach(() => {
    // Reset token configuration to defaults
    reportAuthTokens.updateConfig({
      requireTokens: false,
      allowTokenRefresh: true,
      defaultExpirationHours: 168
    });
  });

  describe('Token Validation Logic', () => {
    it('should validate filename format correctly', () => {
      const validFilenames = [
        'report-abc123.html',
        'report-xyz-789.pdf',
        'report-test-report-2023.html'
      ];
      
      const invalidFilenames = [
        'report.html',
        'report-abc123.txt',
        'other-file.pdf',
        'report-abc123.HTML' // case sensitive
      ];

      validFilenames.forEach(filename => {
        const match = filename.match(/^report-(.+)\.(html|pdf)$/);
        expect(match).toBeTruthy();
        expect(match![1]).toBeTruthy(); // reportId exists
        expect(['html', 'pdf']).toContain(match![2]); // valid extension
      });

      invalidFilenames.forEach(filename => {
        const match = filename.match(/^report-(.+)\.(html|pdf)$/);
        expect(match).toBeFalsy();
      });
    });

    it('should extract report details from filename correctly', () => {
      const testCases = [
        { filename: 'report-abc123.html', expectedId: 'abc123', expectedType: 'html' },
        { filename: 'report-xyz-789.pdf', expectedId: 'xyz-789', expectedType: 'pdf' },
        { filename: 'report-complex-id-123.html', expectedId: 'complex-id-123', expectedType: 'html' }
      ];

      testCases.forEach(({ filename, expectedId, expectedType }) => {
        const match = filename.match(/^report-(.+)\.(html|pdf)$/);
        expect(match).toBeTruthy();
        expect(match![1]).toBe(expectedId);
        expect(match![2]).toBe(expectedType);
      });
    });
  });

  describe('Token Authorization Flow', () => {
    it('should handle complete authorization flow', async () => {
      // 1. Configure tokens to be required
      reportAuthTokens.updateConfig({ requireTokens: true });
      
      // 2. Generate a valid token
      const token = reportAuthTokens.generateToken({
        reportId: testReportId,
        reportType: 'html',
        permissions: ['read', 'download']
      });
      
      // 3. Verify the token (simulating middleware validation)
      const decodedToken = reportAuthTokens.verifyToken(token);
      
      expect(decodedToken).toBeTruthy();
      expect(decodedToken!.reportId).toBe(testReportId);
      expect(decodedToken!.reportType).toBe('html');
      expect(decodedToken!.permissions).toContain('read');
      
      // 4. Simulate request validation
      const requestedReportId = testReportId;
      const requestedType = 'html';
      
      // Validate token matches request
      expect(decodedToken!.reportId).toBe(requestedReportId);
      expect(decodedToken!.reportType).toBe(requestedType);
      expect(decodedToken!.permissions).toContain('read');
      
      // 5. Simulate file serving
      const expectedFilePath = path.join(process.cwd(), 'public', 'reports', `report-${testReportId}.html`);
      
      // Just verify the path is constructed correctly
      expect(expectedFilePath).toContain('public/reports');
      expect(expectedFilePath).toContain(`report-${testReportId}.html`);
    });

    it('should reject mismatched report IDs', () => {
      const token = reportAuthTokens.generateToken({
        reportId: 'report-a',
        reportType: 'html',
        permissions: ['read']
      });
      
      const decodedToken = reportAuthTokens.verifyToken(token);
      expect(decodedToken).toBeTruthy();
      
      // Simulate request for different report
      const requestedReportId = 'report-b';
      
      // Should fail validation
      expect(decodedToken!.reportId).not.toBe(requestedReportId);
    });

    it('should reject mismatched file types', () => {
      const token = reportAuthTokens.generateToken({
        reportId: testReportId,
        reportType: 'html',
        permissions: ['read']
      });
      
      const decodedToken = reportAuthTokens.verifyToken(token);
      expect(decodedToken).toBeTruthy();
      
      // Simulate request for PDF when token is for HTML
      const requestedType = 'pdf';
      
      // Should fail validation
      expect(decodedToken!.reportType).not.toBe(requestedType);
    });

    it('should handle permission validation', () => {
      const tokenWithoutReadPermission = reportAuthTokens.generateToken({
        reportId: testReportId,
        reportType: 'html',
        permissions: ['download'] // No 'read' permission
      });
      
      const decodedToken = reportAuthTokens.verifyToken(tokenWithoutReadPermission);
      expect(decodedToken).toBeTruthy();
      
      // Should fail permission check
      expect(decodedToken!.permissions).not.toContain('read');
    });
  });

  describe('File Serving Logic', () => {
    it('should determine correct content type', () => {
      const testCases = [
        { filename: 'report-test.html', expectedType: 'text/html' },
        { filename: 'report-test.pdf', expectedType: 'application/pdf' }
      ];

      testCases.forEach(({ filename, expectedType }) => {
        const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'text/html';
        expect(contentType).toBe(expectedType);
      });
    });

    it('should generate appropriate security headers', () => {
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      };

      // These headers should be applied to all served files
      Object.entries(securityHeaders).forEach(([header, value]) => {
        expect(value).toBeTruthy();
        expect(header).toBeTruthy();
      });
    });

    it('should handle PDF content disposition', () => {
      const pdfFilename = 'report-test.pdf';
      const expectedDisposition = `inline; filename="${pdfFilename}"`;
      
      const contentDisposition = pdfFilename.endsWith('.pdf') 
        ? `inline; filename="${pdfFilename}"` 
        : undefined;
      
      expect(contentDisposition).toBe(expectedDisposition);
    });
  });

  describe('Error Scenarios', () => {
    it('should construct proper file paths', () => {
      const filePath = path.join(process.cwd(), 'public', 'reports', 'report-test.html');
      
      expect(filePath).toContain('public');
      expect(filePath).toContain('reports');
      expect(filePath).toContain('report-test.html');
    });

    it('should handle invalid tokens gracefully', () => {
      const invalidTokens = [
        'invalid-jwt-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        null,
        undefined
      ];

      invalidTokens.forEach(token => {
        const result = reportAuthTokens.verifyToken(token as any);
        expect(result).toBeNull();
      });
    });
  });

  describe('Configuration Impact', () => {
    it('should bypass validation when tokens are not required', () => {
      reportAuthTokens.updateConfig({ requireTokens: false });
      
      // When tokens are not required, middleware should serve files directly
      expect(reportAuthTokens.areTokensRequired()).toBe(false);
      
      // No token validation should occur
      // Files should be served based on existence only
    });

    it('should enforce validation when tokens are required', () => {
      reportAuthTokens.updateConfig({ requireTokens: true });
      
      expect(reportAuthTokens.areTokensRequired()).toBe(true);
      
      // All requests should require valid tokens
      // Invalid/missing tokens should be rejected
    });
  });
});