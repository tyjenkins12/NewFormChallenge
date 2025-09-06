import { ReportAuthTokens, ReportToken } from '../auth-tokens';
import jwt from 'jsonwebtoken';

describe('ReportAuthTokens', () => {
  let authTokens: ReportAuthTokens;
  const mockSecret = 'test-secret-key';

  beforeEach(() => {
    // Mock environment variable
    process.env.JWT_SECRET = mockSecret;
    authTokens = new ReportAuthTokens();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.JWT_SECRET;
  });

  describe('constructor', () => {
    it('should use JWT_SECRET from environment', () => {
      process.env.JWT_SECRET = 'custom-secret';
      const tokens = new ReportAuthTokens();
      expect(tokens).toBeInstanceOf(ReportAuthTokens);
    });

    it('should use NEXTAUTH_SECRET as fallback', () => {
      delete process.env.JWT_SECRET;
      process.env.NEXTAUTH_SECRET = 'nextauth-secret';
      const tokens = new ReportAuthTokens();
      expect(tokens).toBeInstanceOf(ReportAuthTokens);
      delete process.env.NEXTAUTH_SECRET;
    });

    it('should throw error in production without proper secret', () => {
      delete process.env.JWT_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      process.env.NODE_ENV = 'production';
      
      expect(() => new ReportAuthTokens()).toThrow('JWT_SECRET or NEXTAUTH_SECRET environment variable is required in production');
      
      process.env.NODE_ENV = 'test';
    });

    it('should accept custom configuration', () => {
      const tokens = new ReportAuthTokens({
        defaultExpirationHours: 24,
        requireTokens: true
      });
      
      const config = tokens.getConfig();
      expect(config.defaultExpirationHours).toBe(24);
      expect(config.requireTokens).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = authTokens.generateToken({
        reportId: 'test-report-123',
        reportType: 'html'
      });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload data', () => {
      const params = {
        reportId: 'test-report-123',
        reportType: 'html' as const,
        permissions: ['read', 'download'],
        userId: 'user-456'
      };

      const token = authTokens.generateToken(params);
      const decoded = jwt.verify(token, mockSecret) as ReportToken;

      expect(decoded.reportId).toBe(params.reportId);
      expect(decoded.reportType).toBe(params.reportType);
      expect(decoded.permissions).toEqual(params.permissions);
      expect(decoded.userId).toBe(params.userId);
      expect(decoded.iss).toBe('scheduled-insight-reports');
      expect(decoded.aud).toBe('report-access');
    });

    it('should use default permissions when none provided', () => {
      const token = authTokens.generateToken({
        reportId: 'test-report',
        reportType: 'pdf'
      });

      const decoded = jwt.verify(token, mockSecret) as ReportToken;
      expect(decoded.permissions).toEqual(['read']);
    });

    it('should respect custom expiration hours', () => {
      const customHours = 48;
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const token = authTokens.generateToken({
        reportId: 'test-report',
        reportType: 'html',
        expirationHours: customHours
      });

      const decoded = jwt.verify(token, mockSecret) as ReportToken;
      const expectedExpiry = beforeTime + (customHours * 3600);
      
      // Allow 1 second tolerance for test timing
      expect(decoded.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1);
      expect(decoded.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode valid tokens', () => {
      const originalParams = {
        reportId: 'test-report-123',
        reportType: 'html' as const,
        permissions: ['read'],
        userId: 'user-456'
      };

      const token = authTokens.generateToken(originalParams);
      const decoded = authTokens.verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.reportId).toBe(originalParams.reportId);
      expect(decoded!.reportType).toBe(originalParams.reportType);
      expect(decoded!.permissions).toEqual(originalParams.permissions);
      expect(decoded!.userId).toBe(originalParams.userId);
    });

    it('should return null for invalid tokens', () => {
      const invalidToken = 'invalid.jwt.token';
      const result = authTokens.verifyToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should return null for expired tokens', () => {
      // Generate token that expires immediately
      const token = authTokens.generateToken({
        reportId: 'test-report',
        reportType: 'html',
        expirationHours: -1 // Already expired
      });

      const result = authTokens.verifyToken(token);
      expect(result).toBeNull();
    });

    it('should return null for tokens with wrong issuer/audience', () => {
      // Create token with wrong issuer
      const wrongToken = jwt.sign({
        reportId: 'test',
        reportType: 'html'
      }, mockSecret, {
        issuer: 'wrong-issuer',
        audience: 'report-access'
      });

      const result = authTokens.verifyToken(wrongToken);
      expect(result).toBeNull();
    });
  });

  describe('generateSignedUrl', () => {
    it('should generate a valid signed URL', () => {
      const params = {
        reportId: 'test-report-123',
        reportType: 'html' as const,
        baseUrl: 'https://example.com'
      };

      const signedUrl = authTokens.generateSignedUrl(params);
      
      expect(signedUrl).toMatch(/^https:\/\/example\.com\/reports\/report-test-report-123\.html\?token=.+$/);
    });

    it('should work without baseUrl', () => {
      const signedUrl = authTokens.generateSignedUrl({
        reportId: 'test-report',
        reportType: 'pdf'
      });

      expect(signedUrl).toMatch(/^\/reports\/report-test-report\.pdf\?token=.+$/);
    });

    it('should generate different URLs for html vs pdf', () => {
      const htmlUrl = authTokens.generateSignedUrl({
        reportId: 'test-report',
        reportType: 'html'
      });

      const pdfUrl = authTokens.generateSignedUrl({
        reportId: 'test-report',
        reportType: 'pdf'
      });

      expect(htmlUrl).toContain('.html?token=');
      expect(pdfUrl).toContain('.pdf?token=');
    });
  });

  describe('extractTokenFromUrl', () => {
    it('should extract token from valid URL', () => {
      const token = 'test-token-123';
      const url = `https://example.com/reports/test.html?token=${token}`;
      
      const extracted = authTokens.extractTokenFromUrl(url);
      expect(extracted).toBe(token);
    });

    it('should return null for URL without token', () => {
      const url = 'https://example.com/reports/test.html';
      const extracted = authTokens.extractTokenFromUrl(url);
      expect(extracted).toBeNull();
    });

    it('should handle invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const extracted = authTokens.extractTokenFromUrl(invalidUrl);
      expect(extracted).toBeNull();
    });

    it('should handle URLs with multiple query parameters', () => {
      const token = 'test-token-123';
      const url = `https://example.com/reports/test.html?other=value&token=${token}&another=param`;
      
      const extracted = authTokens.extractTokenFromUrl(url);
      expect(extracted).toBe(token);
    });
  });

  describe('configuration methods', () => {
    it('should return current configuration', () => {
      const config = authTokens.getConfig();
      
      expect(config).toHaveProperty('defaultExpirationHours');
      expect(config).toHaveProperty('allowTokenRefresh');
      expect(config).toHaveProperty('requireTokens');
      expect(config).toHaveProperty('maxTokensPerReport');
    });

    it('should update configuration', () => {
      authTokens.updateConfig({
        defaultExpirationHours: 48,
        requireTokens: true
      });

      const config = authTokens.getConfig();
      expect(config.defaultExpirationHours).toBe(48);
      expect(config.requireTokens).toBe(true);
    });

    it('should check if tokens are required', () => {
      expect(authTokens.areTokensRequired()).toBe(false);
      
      authTokens.updateConfig({ requireTokens: true });
      expect(authTokens.areTokensRequired()).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid tokens when allowed', async () => {
      authTokens.updateConfig({ allowTokenRefresh: true });
      
      const originalToken = authTokens.generateToken({
        reportId: 'test-report',
        reportType: 'html',
        permissions: ['read', 'download']
      });

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const refreshedToken = authTokens.refreshToken(originalToken);
      expect(refreshedToken).not.toBeNull();
      expect(refreshedToken).not.toBe(originalToken);

      // Verify refreshed token has same permissions
      const decoded = authTokens.verifyToken(refreshedToken!);
      expect(decoded!.reportId).toBe('test-report');
      expect(decoded!.permissions).toEqual(['read', 'download']);
    });

    it('should return null when refresh is disabled', () => {
      authTokens.updateConfig({ allowTokenRefresh: false });
      
      const originalToken = authTokens.generateToken({
        reportId: 'test-report',
        reportType: 'html'
      });

      const refreshedToken = authTokens.refreshToken(originalToken);
      expect(refreshedToken).toBeNull();
    });

    it('should return null for invalid original tokens', () => {
      authTokens.updateConfig({ allowTokenRefresh: true });
      
      const refreshedToken = authTokens.refreshToken('invalid-token');
      expect(refreshedToken).toBeNull();
    });
  });

  describe('integration test', () => {
    it('should handle complete token lifecycle', async () => {
      // 1. Generate token
      const token = authTokens.generateToken({
        reportId: 'integration-test-report',
        reportType: 'pdf',
        permissions: ['read', 'download'],
        userId: 'test-user'
      });

      // 2. Generate signed URL
      const signedUrl = authTokens.generateSignedUrl({
        reportId: 'integration-test-report',
        reportType: 'pdf',
        baseUrl: 'https://test.com'
      });

      // 3. Extract token from URL
      const extractedToken = authTokens.extractTokenFromUrl(signedUrl);
      expect(extractedToken).toBeTruthy();

      // 4. Verify extracted token
      const decoded = authTokens.verifyToken(extractedToken!);
      expect(decoded).toBeTruthy();
      expect(decoded!.reportId).toBe('integration-test-report');
      expect(decoded!.reportType).toBe('pdf');

      // 5. Refresh token
      authTokens.updateConfig({ allowTokenRefresh: true });
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const refreshed = authTokens.refreshToken(extractedToken!);
      expect(refreshed).toBeTruthy();
      expect(refreshed).not.toBe(extractedToken);
    });
  });
});