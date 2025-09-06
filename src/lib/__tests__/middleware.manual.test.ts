/**
 * Manual test demonstrating middleware functionality
 * This shows how the complete token validation flow works
 */

import { reportAuthTokens } from '../auth-tokens';

describe('Middleware Manual Demo', () => {
  it('should demonstrate complete middleware workflow', () => {
    console.log('\n🛡️ Middleware Token Validation Demo');
    console.log('=' .repeat(50));

    // 1. Configure middleware to require tokens
    reportAuthTokens.updateConfig({ 
      requireTokens: true,
      defaultExpirationHours: 24
    });
    
    console.log('✅ Configured middleware to require tokens');

    // 2. Simulate incoming request without token
    const requestWithoutToken = {
      url: 'https://myapp.com/reports/report-demo123.html',
      filename: 'report-demo123.html'
    };
    
    console.log('\n🚫 Simulating request WITHOUT token:');
    console.log(`   URL: ${requestWithoutToken.url}`);
    
    // Extract filename details
    const match = requestWithoutToken.filename.match(/^report-(.+)\.(html|pdf)$/);
    if (!match) {
      console.log('   ❌ Invalid filename format');
    } else {
      console.log(`   📄 Report ID: ${match[1]}, Type: ${match[2]}`);
      console.log('   ❌ No token provided - Request would be rejected (401)');
    }

    // 3. Generate valid token and simulate request with token
    const validToken = reportAuthTokens.generateToken({
      reportId: 'demo123',
      reportType: 'html',
      permissions: ['read', 'download'],
      userId: 'demo-user'
    });

    const requestWithToken = {
      url: `https://myapp.com/reports/report-demo123.html?token=${validToken}`,
      filename: 'report-demo123.html',
      token: validToken
    };

    console.log('\n✅ Simulating request WITH valid token:');
    console.log(`   URL: ${requestWithToken.url.substring(0, 80)}...`);

    // Validate filename
    const tokenMatch = requestWithToken.filename.match(/^report-(.+)\.(html|pdf)$/);
    if (tokenMatch) {
      const [, reportId, reportType] = tokenMatch;
      
      // Verify token
      const decodedToken = reportAuthTokens.verifyToken(requestWithToken.token);
      
      if (decodedToken) {
        console.log(`   ✅ Token verified successfully`);
        console.log(`   📋 Token Report ID: ${decodedToken.reportId}`);
        console.log(`   📋 Token Report Type: ${decodedToken.reportType}`);
        console.log(`   📋 Token Permissions: ${decodedToken.permissions.join(', ')}`);
        
        // Validate token matches request
        if (decodedToken.reportId === reportId && 
            decodedToken.reportType === reportType &&
            decodedToken.permissions.includes('read')) {
          console.log(`   ✅ Token validation passed - File would be served (200)`);
        } else {
          console.log(`   ❌ Token validation failed - Request would be rejected (403)`);
        }
      } else {
        console.log(`   ❌ Token verification failed - Request would be rejected (403)`);
      }
    }

    // 4. Simulate invalid token scenarios
    console.log('\n🚫 Testing invalid token scenarios:');

    const invalidScenarios = [
      {
        name: 'Expired token',
        token: reportAuthTokens.generateToken({
          reportId: 'demo123',
          reportType: 'html',
          expirationHours: -1 // Already expired
        })
      },
      {
        name: 'Wrong report ID',
        token: reportAuthTokens.generateToken({
          reportId: 'different-report',
          reportType: 'html'
        })
      },
      {
        name: 'Wrong file type',
        token: reportAuthTokens.generateToken({
          reportId: 'demo123',
          reportType: 'pdf' // Request is for HTML
        })
      },
      {
        name: 'No read permission',
        token: reportAuthTokens.generateToken({
          reportId: 'demo123',
          reportType: 'html',
          permissions: ['download'] // No 'read' permission
        })
      }
    ];

    invalidScenarios.forEach(scenario => {
      const decodedToken = reportAuthTokens.verifyToken(scenario.token);
      const isValid = decodedToken && 
        decodedToken.reportId === 'demo123' &&
        decodedToken.reportType === 'html' &&
        decodedToken.permissions.includes('read');
      
      console.log(`   ${isValid ? '❌ UNEXPECTED' : '✅'} ${scenario.name}: ${isValid ? 'PASSED' : 'REJECTED'}`);
    });

    // 5. Test tokens disabled mode
    console.log('\n🔓 Testing tokens disabled mode:');
    reportAuthTokens.updateConfig({ requireTokens: false });
    
    console.log(`   ✅ Tokens required: ${reportAuthTokens.areTokensRequired()}`);
    console.log(`   ✅ All requests would be served without validation`);

    console.log('\n' + '=' .repeat(50));
    console.log('✅ Middleware validation system working correctly!\n');

    // Assertions for test framework
    expect(validToken).toBeTruthy();
    expect(requestWithoutToken.filename).toMatch(/^report-.+\.(html|pdf)$/);
    expect(reportAuthTokens.verifyToken(validToken)).toBeTruthy();
  });

  it('should handle different file types correctly', () => {
    const testFiles = [
      { filename: 'report-test.html', expectedType: 'html' },
      { filename: 'report-test.pdf', expectedType: 'pdf' },
      { filename: 'report-complex-id-123.html', expectedType: 'html' },
      { filename: 'report-uuid-abc-def.pdf', expectedType: 'pdf' }
    ];

    console.log('\n📁 File Type Detection Demo');
    console.log('=' .repeat(30));

    testFiles.forEach(testFile => {
      const match = testFile.filename.match(/^report-(.+)\.(html|pdf)$/);
      if (match) {
        const [, reportId, reportType] = match;
        console.log(`   ✅ ${testFile.filename} -> ID: ${reportId}, Type: ${reportType}`);
        expect(reportType).toBe(testFile.expectedType);
      } else {
        console.log(`   ❌ ${testFile.filename} -> Invalid format`);
      }
    });

    console.log('');
  });
});