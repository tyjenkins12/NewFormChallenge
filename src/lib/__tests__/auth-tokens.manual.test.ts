/**
 * Manual test for token system - run with: npm test manual
 * This demonstrates the complete token workflow
 */

import { ReportAuthTokens } from '../auth-tokens';

describe('Manual Token System Test', () => {
  it('should demonstrate complete token workflow', () => {
    // Initialize token system
    const authTokens = new ReportAuthTokens({
      defaultExpirationHours: 24,
      requireTokens: true
    });

    console.log('\n🔐 JWT Token System Demo');
    console.log('=' .repeat(50));

    // 1. Generate a signed URL
    const signedUrl = authTokens.generateSignedUrl({
      reportId: 'demo-report-123',
      reportType: 'html',
      baseUrl: 'https://myapp.com',
      permissions: ['read', 'download'],
      userId: 'demo-user'
    });

    console.log('✅ Generated Signed URL:');
    console.log(`   ${signedUrl}`);

    // 2. Extract token from URL
    const token = authTokens.extractTokenFromUrl(signedUrl);
    console.log('\n🔍 Extracted Token:');
    console.log(`   ${token?.substring(0, 50)}...`);

    // 3. Verify token
    const decoded = authTokens.verifyToken(token!);
    console.log('\n📋 Decoded Token Payload:');
    console.log(`   Report ID: ${decoded?.reportId}`);
    console.log(`   Report Type: ${decoded?.reportType}`);
    console.log(`   Permissions: ${decoded?.permissions.join(', ')}`);
    console.log(`   User ID: ${decoded?.userId}`);
    console.log(`   Expires: ${new Date(decoded!.expiresAt * 1000).toLocaleString()}`);

    // 4. Generate PDF version
    const pdfUrl = authTokens.generateSignedUrl({
      reportId: 'demo-report-123',
      reportType: 'pdf',
      baseUrl: 'https://myapp.com'
    });

    console.log('\n📄 PDF Signed URL:');
    console.log(`   ${pdfUrl}`);

    // 5. Show refresh capability
    const refreshed = authTokens.refreshToken(token!);
    console.log('\n🔄 Refreshed Token:');
    console.log(`   New token generated: ${refreshed !== token}`);

    console.log('\n' + '=' .repeat(50));
    console.log('✅ Token system working correctly!\n');

    // Assertions for test framework
    expect(signedUrl).toContain('token=');
    expect(decoded).toBeTruthy();
    expect(decoded!.reportId).toBe('demo-report-123');
    expect(refreshed).not.toBe(token);
  });
});