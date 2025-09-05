'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, ExternalLink, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
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
            </div>
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
                  {run.reportUrl && run.status === 'success' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(run.reportUrl, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
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