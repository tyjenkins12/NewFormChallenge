import { NextRequest, NextResponse } from 'next/server';
import { reportAuthTokens } from '@/lib/auth-tokens';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    const url = new URL(request.url);
    
    // Extract report ID and type from filename (e.g., "report-abc123.html" -> id: "abc123", type: "html")
    const match = filename.match(/^report-(.+)\.(html|pdf)$/);
    if (!match) {
      return NextResponse.json({ error: 'Invalid report filename' }, { status: 400 });
    }
    
    const [, reportId, reportType] = match;
    
    // Check if tokens are required (feature can be disabled)
    if (!reportAuthTokens.areTokensRequired()) {
      // If tokens are not required, serve the file directly without validation
      return await serveReportFile(filename);
    }
    
    // Extract token from query parameters
    const token = url.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Access token required',
        message: 'This report requires a valid access token. Please use the signed URL provided.'
      }, { status: 401 });
    }
    
    // Verify the token
    const decodedToken = reportAuthTokens.verifyToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ 
        error: 'Invalid or expired token',
        message: 'The access token is invalid or has expired. Please request a new signed URL.'
      }, { status: 403 });
    }
    
    // Validate token matches the requested report
    if (decodedToken.reportId !== reportId) {
      return NextResponse.json({ 
        error: 'Token mismatch',
        message: 'The access token is not valid for this report.'
      }, { status: 403 });
    }
    
    // Validate token matches the requested file type
    if (decodedToken.reportType !== reportType) {
      return NextResponse.json({ 
        error: 'File type mismatch',
        message: `This token is only valid for ${decodedToken.reportType} files.`
      }, { status: 403 });
    }
    
    // Check permissions (basic read permission check)
    if (!decodedToken.permissions.includes('read')) {
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        message: 'This token does not have read permissions for this report.'
      }, { status: 403 });
    }
    
    // Token is valid, serve the file
    console.log(`✅ Token validated for user ${decodedToken.userId || 'anonymous'} accessing ${reportId}.${reportType}`);
    
    return await serveReportFile(filename);
    
  } catch (error) {
    console.error('❌ Error serving protected report:', error);
    return NextResponse.json({ 
      error: 'Server error',
      message: 'An error occurred while processing your request.'
    }, { status: 500 });
  }
}

/**
 * Serve the report file from the public/reports directory
 */
async function serveReportFile(filename: string): Promise<NextResponse> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'reports', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ 
        error: 'Report not found',
        message: 'The requested report file does not exist.'
      }, { status: 404 });
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    
    // Determine content type
    const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'text/html';
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    
    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    
    // For PDFs, suggest filename for download
    if (filename.endsWith('.pdf')) {
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }
    
    console.log(`📄 Serving report file: ${filename} (${fileBuffer.length} bytes)`);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('❌ Error reading report file:', error);
    return NextResponse.json({ 
      error: 'File read error',
      message: 'Unable to read the report file.'
    }, { status: 500 });
  }
}