import { NextRequest, NextResponse } from 'next/server';
import { reportAuthTokens } from '@/lib/auth-tokens';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const url = new URL(request.url);
    
    // Extract report ID and type from filename (e.g., "report-abc123.html" -> id: "abc123", type: "html")
    const match = filename.match(/^report-(.+)\.(html|pdf)$/);
    if (!match) {
      return NextResponse.json({ error: 'Invalid report filename' }, { status: 400 });
    }
    
    const [, reportId, reportType] = match;
    
    // Extract token from query parameters
    const token = url.searchParams.get('token');
    
    // New approach: If a token is provided, always validate it
    // If no token is provided, check if tokens are globally required
    if (token) {
      // Token provided - validate it regardless of global settings
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
      
      // Check permissions
      if (!decodedToken.permissions.includes('read')) {
        return NextResponse.json({ 
          error: 'Insufficient permissions',
          message: 'This token does not have read permissions for this report.'
        }, { status: 403 });
      }
      
      // Token is valid, serve the file
      console.log(`✅ Token validated for user ${decodedToken.userId || 'anonymous'} accessing ${reportId}.${reportType}`);
      return await serveReportFile(filename);
    }
    
    // No token provided - check if tokens are required for this specific report
    // First check global settings (might be temporarily set during report generation)
    const globalTokensRequired = reportAuthTokens.areTokensRequired();
    
    // Then check database for this specific report's token settings
    let reportTokensRequired = false;
    try {
      console.log(`🔍 Looking up report in DB with ID: ${reportId}`);
      
      // Try to find the report in database by matching the reportId
      const report = await db.report.findFirst({
        where: { 
          OR: [
            { slug: `report-${reportId}` }, // Try slug format
            { id: reportId } // Try direct ID match
          ]
        },
        include: { 
          config: {
            select: { tokenSettings: true, id: true, name: true }
          }
        }
      });
      
      console.log(`🔍 Database query result:`, report ? {
        id: report.id,
        slug: report.slug,
        configId: report.config?.id,
        configName: report.config?.name,
        tokenSettings: report.config?.tokenSettings
      } : 'No report found');
      
      if (report?.config?.tokenSettings) {
        reportTokensRequired = (report.config.tokenSettings as any)?.enabled || false;
        console.log(`🔍 Found report in DB: tokenSettings=${JSON.stringify(report.config.tokenSettings)}, enabled=${reportTokensRequired}`);
      } else if (report) {
        console.log(`🔍 Found report but no tokenSettings in config`);
      } else {
        console.log(`🔍 No report found in database for ID: ${reportId}`);
      }
    } catch (dbError) {
      console.warn(`⚠️ Could not check database for report ${reportId}:`, dbError);
    }
    
    const tokensRequired = globalTokensRequired || reportTokensRequired;
    console.log(`🔍 Debug - Token check for ${filename}: global=${globalTokensRequired}, report=${reportTokensRequired}, final=${tokensRequired}`);
    
    if (tokensRequired) {
      console.log(`🚫 Access denied - tokens required but none provided for ${filename}`);
      return NextResponse.json({ 
        error: 'Access token required',
        message: 'This report requires a valid access token. Please use the signed URL provided.'
      }, { status: 401 });
    }
    
    // No token provided and tokens not required - serve directly
    console.log(`✅ Serving ${filename} without token validation (tokens not required)`);
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
 * Serve the report file from the private/reports directory
 */
async function serveReportFile(filename: string): Promise<NextResponse> {
  try {
    const filePath = path.join(process.cwd(), 'private', 'reports', filename);
    
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
    
    // For PDFs, force download instead of inline display
    if (filename.endsWith('.pdf')) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
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