/**
 * Utility to get the correct base URL for the application
 */
export function getBaseUrl(): string {
  // 1. Try environment variable first (production)
  if (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_BASE_URL.trim();
  }
  
  // 2. Try server-side environment variables (deployment platforms)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }
  
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  // 3. Client-side (if available)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // 4. Development fallback with port
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

/**
 * Get base URL specifically for server-side use (like in API routes or scheduled tasks)
 * This should be called with request headers when available
 */
export function getServerBaseUrl(headers?: { host?: string; 'x-forwarded-proto'?: string }): string {
  // 1. Try environment variable first
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // 2. Try to construct from request headers
  if (headers?.host) {
    const protocol = headers['x-forwarded-proto'] || 'http';
    return `${protocol}://${headers.host}`;
  }
  
  // 3. Fall back to general getBaseUrl
  return getBaseUrl();
}