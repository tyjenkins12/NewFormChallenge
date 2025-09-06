/**
 * Tests for Next.js middleware that handles report routing
 */

import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

// Mock console.log to avoid test output noise
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Middleware', () => {
  afterEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should rewrite HTML report requests to API route', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-abc123.html?token=xyz');
    
    const response = middleware(request);
    
    expect(response).toBeDefined();
    // Check that it's a rewrite (not a redirect)
    expect(response.headers.get('x-middleware-rewrite')).toBeTruthy();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Middleware: Rewriting /reports/report-abc123.html -> /reports/report-abc123.html')
    );
  });

  it('should rewrite PDF report requests to API route', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-xyz789.pdf?token=abc');
    
    const response = middleware(request);
    
    expect(response).toBeDefined();
    expect(response.headers.get('x-middleware-rewrite')).toBeTruthy();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Middleware: Rewriting /reports/report-xyz789.pdf -> /reports/report-xyz789.pdf')
    );
  });

  it('should preserve query parameters in rewrite', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-test.html?token=abc123&user=test');
    
    const response = middleware(request);
    
    expect(response).toBeDefined();
    expect(response.headers.get('x-middleware-rewrite')).toBeTruthy();
  });

  it('should not rewrite non-report files in /reports/', () => {
    const request = new NextRequest('http://localhost:3000/reports/other-file.txt');
    
    const response = middleware(request);
    
    // Should call NextResponse.next() which continues to static file serving
    expect(response.headers.get('x-middleware-rewrite')).toBeFalsy();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should not rewrite requests outside /reports/ path', () => {
    const request = new NextRequest('http://localhost:3000/api/reports/test');
    
    const response = middleware(request);
    
    expect(response.headers.get('x-middleware-rewrite')).toBeFalsy();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should not rewrite /reports/ requests without report- prefix', () => {
    const request = new NextRequest('http://localhost:3000/reports/some-other-file.html');
    
    const response = middleware(request);
    
    expect(response.headers.get('x-middleware-rewrite')).toBeFalsy();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should handle requests without query parameters', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-test123.html');
    
    const response = middleware(request);
    
    expect(response).toBeDefined();
    expect(response.headers.get('x-middleware-rewrite')).toBeTruthy();
  });

  it('should handle complex report IDs', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-abc-123-def-456.pdf');
    
    const response = middleware(request);
    
    expect(response).toBeDefined();
    expect(response.headers.get('x-middleware-rewrite')).toBeTruthy();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('report-abc-123-def-456.pdf')
    );
  });

  it('should be case sensitive for file extensions', () => {
    const request = new NextRequest('http://localhost:3000/reports/report-test.HTML');
    
    const response = middleware(request);
    
    // Should not match uppercase .HTML
    expect(response.headers.get('x-middleware-rewrite')).toBeFalsy();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });
});