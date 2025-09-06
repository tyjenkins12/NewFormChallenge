/**
 * Tests for report token validation middleware
 */

import { GET } from '../[filename]/route';
import { reportAuthTokens } from '@/lib/auth-tokens';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('@/lib/auth-tokens');
jest.mock('fs/promises');

const mockReportAuthTokens = reportAuthTokens as jest.Mocked<typeof reportAuthTokens>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Report Token Validation Route', () => {
  const mockReportId = 'test-report-123';
  const mockToken = 'mock-jwt-token';
  const mockFileContent = '<html><body>Test Report</body></html>';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(Buffer.from(mockFileContent));
  });

  describe('when tokens are not required', () => {
    beforeEach(() => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(false);
    });

    it('should serve HTML file without token validation', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-test-123.html');
      const params = { params: { filename: 'report-test-123.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(200);
      expect(mockReportAuthTokens.verifyToken).not.toHaveBeenCalled();
      
      const responseText = await response.text();
      expect(responseText).toBe(mockFileContent);
    });

    it('should serve PDF file without token validation', async () => {
      const pdfContent = Buffer.from('PDF content');
      mockFs.readFile.mockResolvedValue(pdfContent);

      const request = new NextRequest('http://localhost:3000/reports/report-test-123.pdf');
      const params = { params: { filename: 'report-test-123.pdf' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(mockReportAuthTokens.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('when tokens are required', () => {
    beforeEach(() => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(true);
    });

    it('should return 401 when no token is provided', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-test-123.html');
      const params = { params: { filename: 'report-test-123.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Access token required');
    });

    it('should return 403 when token is invalid', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue(null);

      const request = new NextRequest(`http://localhost:3000/reports/report-test-123.html?token=${mockToken}`);
      const params = { params: { filename: 'report-test-123.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(403);
      expect(mockReportAuthTokens.verifyToken).toHaveBeenCalledWith(mockToken);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should return 403 when token reportId does not match', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue({
        reportId: 'different-report',
        reportType: 'html',
        permissions: ['read'],
        expiresAt: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600
      });

      const request = new NextRequest(`http://localhost:3000/reports/report-${mockReportId}.html?token=${mockToken}`);
      const params = { params: { filename: `report-${mockReportId}.html` } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Token mismatch');
    });

    it('should return 403 when token reportType does not match', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue({
        reportId: mockReportId,
        reportType: 'pdf',
        permissions: ['read'],
        expiresAt: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600
      });

      const request = new NextRequest(`http://localhost:3000/reports/report-${mockReportId}.html?token=${mockToken}`);
      const params = { params: { filename: `report-${mockReportId}.html` } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('File type mismatch');
    });

    it('should return 403 when token lacks read permission', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue({
        reportId: mockReportId,
        reportType: 'html',
        permissions: ['download'], // No 'read' permission
        expiresAt: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600
      });

      const request = new NextRequest(`http://localhost:3000/reports/report-${mockReportId}.html?token=${mockToken}`);
      const params = { params: { filename: `report-${mockReportId}.html` } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should serve file when token is valid', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue({
        reportId: mockReportId,
        reportType: 'html',
        permissions: ['read'],
        expiresAt: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
        userId: 'test-user'
      });

      const request = new NextRequest(`http://localhost:3000/reports/report-${mockReportId}.html?token=${mockToken}`);
      const params = { params: { filename: `report-${mockReportId}.html` } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      
      const responseText = await response.text();
      expect(responseText).toBe(mockFileContent);
    });

    it('should return 404 when file does not exist', async () => {
      mockReportAuthTokens.verifyToken.mockReturnValue({
        reportId: mockReportId,
        reportType: 'html',
        permissions: ['read'],
        expiresAt: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600
      });

      mockFs.access.mockRejectedValue(new Error('File not found'));

      const request = new NextRequest(`http://localhost:3000/reports/report-${mockReportId}.html?token=${mockToken}`);
      const params = { params: { filename: `report-${mockReportId}.html` } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Report not found');
    });
  });

  describe('filename validation', () => {
    beforeEach(() => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(false);
    });

    it('should return 400 for invalid filename format', async () => {
      const request = new NextRequest('http://localhost:3000/reports/invalid-file.txt');
      const params = { params: { filename: 'invalid-file.txt' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid report filename');
    });

    it('should accept valid HTML report filename', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-abc123.html');
      const params = { params: { filename: 'report-abc123.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(200);
    });

    it('should accept valid PDF report filename', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-xyz789.pdf');
      const params = { params: { filename: 'report-xyz789.pdf' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
    });
  });

  describe('security headers', () => {
    beforeEach(() => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(false);
    });

    it('should include security headers for HTML files', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-test.html');
      const params = { params: { filename: 'report-test.html' } };

      const response = await GET(request, params);
      
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    });

    it('should include Content-Disposition header for PDF files', async () => {
      const request = new NextRequest('http://localhost:3000/reports/report-test.pdf');
      const params = { params: { filename: 'report-test.pdf' } };

      const response = await GET(request, params);
      
      expect(response.headers.get('content-disposition')).toBe('inline; filename="report-test.pdf"');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(false);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const request = new NextRequest('http://localhost:3000/reports/report-test.html');
      const params = { params: { filename: 'report-test.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('File read error');
    });

    it('should handle token verification errors gracefully', async () => {
      mockReportAuthTokens.areTokensRequired.mockReturnValue(true);
      mockReportAuthTokens.verifyToken.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      const request = new NextRequest(`http://localhost:3000/reports/report-test.html?token=${mockToken}`);
      const params = { params: { filename: 'report-test.html' } };

      const response = await GET(request, params);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Server error');
    });
  });
});