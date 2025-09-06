import jwt from 'jsonwebtoken';

export interface ReportToken {
  reportId: string;
  reportType: 'html' | 'pdf';
  expiresAt: number;
  permissions: string[];
  userId?: string;
  iat: number; // JWT issued at
  exp: number; // JWT expires at
}

export interface TokenConfig {
  defaultExpirationHours: number;
  allowTokenRefresh: boolean;
  requireTokens: boolean;
  maxTokensPerReport: number;
}

export class ReportAuthTokens {
  private jwtSecret: string;
  private config: TokenConfig;

  constructor(config?: Partial<TokenConfig>) {
    // Get JWT secret from environment
    this.jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-for-dev';
    
    if (this.jwtSecret === 'fallback-secret-for-dev' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required in production');
    }

    // Default configuration
    this.config = {
      defaultExpirationHours: 168, // 7 days
      allowTokenRefresh: true,
      requireTokens: false, // Feature can be disabled
      maxTokensPerReport: 10,
      ...config
    };
  }

  /**
   * Generate a signed JWT token for report access
   */
  generateToken(params: {
    reportId: string;
    reportType: 'html' | 'pdf';
    expirationHours?: number;
    permissions?: string[];
    userId?: string;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const expirationHours = params.expirationHours || this.config.defaultExpirationHours;
    const expiresAt = now + (expirationHours * 3600);

    const payload: Omit<ReportToken, 'iat' | 'exp'> = {
      reportId: params.reportId,
      reportType: params.reportType,
      expiresAt,
      permissions: params.permissions || ['read'],
      userId: params.userId
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: `${expirationHours}h`,
      issuer: 'scheduled-insight-reports',
      audience: 'report-access',
      jwtid: `${params.reportId}-${Date.now()}-${Math.random().toString(36).substring(7)}` // Ensure unique tokens
    });
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): ReportToken | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'scheduled-insight-reports',
        audience: 'report-access'
      }) as ReportToken;

      // Additional validation
      const now = Math.floor(Date.now() / 1000);
      if (decoded.expiresAt < now) {
        console.warn('Token has expired based on custom expiresAt field');
        return null;
      }

      return decoded;
    } catch (error) {
      console.warn('Token verification failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Generate a signed URL for a report
   */
  generateSignedUrl(params: {
    reportId: string;
    reportType: 'html' | 'pdf';
    baseUrl?: string;
    expirationHours?: number;
    permissions?: string[];
    userId?: string;
  }): string {
    const token = this.generateToken(params);
    const baseUrl = params.baseUrl || '';
    const fileExtension = params.reportType;
    
    return `${baseUrl}/reports/report-${params.reportId}.${fileExtension}?token=${token}`;
  }

  /**
   * Extract token from URL or request
   */
  extractTokenFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  }

  /**
   * Check if tokens are required (feature enabled)
   */
  areTokensRequired(): boolean {
    return this.config.requireTokens;
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TokenConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Refresh a token (generate new one with same permissions)
   */
  refreshToken(oldToken: string): string | null {
    if (!this.config.allowTokenRefresh) {
      return null;
    }

    const decoded = this.verifyToken(oldToken);
    if (!decoded) {
      return null;
    }

    return this.generateToken({
      reportId: decoded.reportId,
      reportType: decoded.reportType,
      permissions: decoded.permissions,
      userId: decoded.userId
    });
  }
}

// Default instance
export const reportAuthTokens = new ReportAuthTokens();