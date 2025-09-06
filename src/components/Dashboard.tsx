'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, ExternalLink, AlertCircle, CheckCircle, Loader2, Shield, Key, RefreshCw } from 'lucide-react';
import { SchedulerStatus, ReportRun, ReportConfig } from '@/types';

interface Props {
  onRunNow: () => void;
  onReset: () => void;
}

export default function Dashboard({ onRunNow, onReset }: Props) {
  const [status, setStatus] = useState<SchedulerStatus>({ isRunning: false });
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (status.nextRun) {
        const now = new Date();
        const next = new Date(status.nextRun);
        const diff = next.getTime() - now.getTime();
        
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setCountdown('Running soon...');
        }
      } else {
        setCountdown('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status.nextRun]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/scheduler/status');
      const data = await response.json();
      setStatus(data.status);
      setRuns(data.runs);
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const handleRunNow = async () => {
    setLoading(true);
    try {
      await onRunNow();
      setTimeout(fetchStatus, 1000); // Refresh after a delay
    } finally {
      setLoading(false);
    }
  };

  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduler Status
              </CardTitle>
              <CardDescription>
                {config ? `${config.platform.toUpperCase()} report scheduled ${config.cadence === 'manual' ? 'manually' : config.cadence}` : 'No report configured'}
              </CardDescription>
            </div>
            <Badge variant={status.isRunning ? 'default' : 'secondary'}>
              {status.isRunning ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Last Run</p>
              <p className="font-semibold">
                {status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Run</p>
              <p className="font-semibold">
                {config?.cadence === 'manual' ? 'Manual only' : (countdown || 'Not scheduled')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                {status.lastError ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">Error</span>
                  </>
                ) : lastRun?.status === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Success</span>
                  </>
                ) : lastRun?.status === 'running' ? (
                  <>
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="text-blue-500">Running</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>

          {status.lastError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Last Error:</strong> {status.lastError}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button 
              onClick={handleRunNow} 
              disabled={loading || !config}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Now
            </Button>
            
            {status.reportPath && config?.delivery === 'link' && (
              <Button 
                variant="outline"
                onClick={() => window.open(status.reportPath, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Latest Report
              </Button>
            )}

            <Button 
              variant="outline"
              onClick={onReset}
              className="ml-auto"
            >
              New Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Card */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Platform</p>
                <p className="font-semibold">{config.platform.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Level</p>
                <p className="font-semibold">{config.level}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Metrics</p>
                <p className="font-semibold">{config.metrics.join(', ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date Range</p>
                <p className="font-semibold">{config.dateRangeEnum}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cadence</p>
                <p className="font-semibold">{config.cadence}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivery</p>
                <p className="font-semibold">{config.delivery} {config.email ? `(${config.email})` : ''}</p>
              </div>
              {config.tokenSettings && (
                <>
                  <div>
                    <p className="text-muted-foreground">Security</p>
                    <p className="font-semibold">
                      {config.tokenSettings.enabled ? 'Secure tokens enabled' : 'Public access'}
                    </p>
                  </div>
                  {config.tokenSettings.enabled && (
                    <div>
                      <p className="text-muted-foreground">Token Expiration</p>
                      <p className="font-semibold">
                        {config.tokenSettings.expirationHours}h
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token Management */}
      {config && config.tokenSettings?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Token Security Status
            </CardTitle>
            <CardDescription>
              Secure access tokens are active for this report configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Security Mode</p>
                <div className="flex items-center gap-2 mt-1">
                  <Key className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-green-700">Active</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Token Lifetime</p>
                <p className="font-semibold">
                  {config.tokenSettings.expirationHours} hours
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Refresh Allowed</p>
                <p className="font-semibold">
                  {config.tokenSettings.allowRefresh ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Security Features Active
                  </p>
                  <p className="text-sm text-green-700">
                    All report links use time-limited authentication tokens. 
                    Email recipients get secure, expiring access links.
                  </p>
                </div>
              </div>
            </div>

            {lastRun && lastRun.status === 'success' && (lastRun.reportUrl || status.reportPath) && (
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="outline"
                  onClick={() => window.open(lastRun.reportUrl || status.reportPath, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Secure Link
                </Button>
                {config.tokenSettings.allowRefresh && (
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      // TODO: Implement token refresh functionality
                      console.log('Token refresh requested');
                    }}
                    className="flex items-center gap-2"
                    disabled
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Token
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Runs */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Last {Math.min(runs.length, 10)} report executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {runs.slice(-10).reverse().map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {run.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : run.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium">
                        {new Date(run.timestamp).toLocaleString()}
                      </p>
                      {run.error && (
                        <p className="text-xs text-red-500">{run.error}</p>
                      )}
                    </div>
                  </div>
                  {((run as any).signedUrl || run.reportUrl) && run.status === 'success' && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open((run as any).signedUrl || run.reportUrl, '_blank')}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                      {(run as any).signedUrl && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-2 w-2 mr-1" />
                          Secure
                        </Badge>
                      )}
                      {(run as any).signedPdfUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open((run as any).signedPdfUrl, '_blank')}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          PDF
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}