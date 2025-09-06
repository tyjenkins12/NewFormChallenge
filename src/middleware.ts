import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle /reports/* paths - redirect to our API route for token validation
  if (pathname.startsWith('/reports/') && pathname.includes('report-')) {
    // Extract filename from path (e.g., /reports/report-abc123.html -> report-abc123.html)
    const filename = pathname.split('/').pop();
    
    if (filename && (filename.endsWith('.html') || filename.endsWith('.pdf'))) {
      // Preserve query parameters (including token)
      const searchParams = request.nextUrl.searchParams;
      
      // Rewrite to our API route
      const newUrl = new URL(`/reports/${filename}`, request.url);
      newUrl.search = searchParams.toString();
      
      console.log(`🔀 Middleware: Rewriting ${pathname} -> /reports/${filename}`);
      return NextResponse.rewrite(newUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match /reports/* paths for HTML and PDF files
    '/reports/:filename*',
  ],
};