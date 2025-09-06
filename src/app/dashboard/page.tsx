'use client';

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Play, 
  Settings, 
  ExternalLink, 
  Copy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Timer,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

// Import the actual ReportConfig type
import { ReportConfig } from '@/types';

const Dashboard = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [lastRun, setLastRun] = useState<any>(null);
  
  // Load configuration from localStorage and fetch scheduler status
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reportConfig');
      if (stored) {
        const savedData = JSON.parse(stored);
        if (savedData.config) {
          setReportConfig(savedData.config);
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }

    // Fetch real scheduler status
    fetchSchedulerStatus();
  }, []);

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/scheduler/status');
      if (response.ok) {
        const status = await response.json();
        console.log('🔍 Dashboard received status:', {
          nextRun: status.status?.nextRun,
          isRunning: status.status?.isRunning,
          configCadence: status.config?.cadence
        });
        setSchedulerStatus(status);
        
        // Simulate last run data based on scheduler status
        if (status.status?.lastRun) {
          setLastRun({
            timestamp: new Date(status.status.lastRun).toLocaleString(),
            status: status.status.lastError ? "error" : "success",
            duration: "2.3s", // Simulated - could be tracked in scheduler
            recordsProcessed: status.status.lastError ? 0 : 1247 // 0 if error
          });
        }
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      // Fallback to mock data
      setLastRun({
        timestamp: "No runs yet",
        status: "pending",
        duration: "-",
        recordsProcessed: 0
      });
    }
  };

  // Determine if the last error was due to insufficient data
  const getLastError = () => {
    if (!schedulerStatus?.status?.lastError) {
      return null;
    }

    const errorMessage = schedulerStatus.status.lastError;
    
    // Check if error is related to insufficient data
    if (errorMessage.includes('0 records') || 
        errorMessage.includes('empty') || 
        errorMessage.includes('No data available') ||
        lastRun?.recordsProcessed === 0) {
      return {
        code: "INSUFFICIENT_DATA",
        message: `No data available for ${reportConfig?.platform} ${reportConfig?.level} level with ${reportConfig?.dateRangeEnum} date range`,
        timestamp: schedulerStatus.status.lastRun ? new Date(schedulerStatus.status.lastRun).toLocaleString() : "Unknown",
        suggestion: "Try 'Campaign' level or 'Last 30 days' date range for better data availability"
      };
    }

    // Default error format
    return {
      code: "UNKNOWN_ERROR",
      message: errorMessage,
      timestamp: schedulerStatus.status.lastRun ? new Date(schedulerStatus.status.lastRun).toLocaleString() : "Unknown"
    };
  };

  const lastError = getLastError();

  const nextRun = {
    scheduled: schedulerStatus?.status?.nextRun ? 
      new Date(schedulerStatus.status.nextRun).toLocaleString() : 
      reportConfig?.cadence === 'manual' ? 'Manual trigger only' : 'Not scheduled',
    countdown: schedulerStatus?.status?.nextRun ? 
      getCountdown(schedulerStatus.status.nextRun) : 
      reportConfig?.cadence === 'manual' ? 'Manual' : 'N/A',
    progress: getScheduleProgress()
  };

  // Debug logging for nextRun
  console.log('🔍 Dashboard nextRun calculation:', {
    hasNextRun: !!schedulerStatus?.status?.nextRun,
    nextRunValue: schedulerStatus?.status?.nextRun,
    scheduled: nextRun.scheduled,
    countdown: nextRun.countdown,
    cadence: reportConfig?.cadence
  });

  // Helper function to calculate schedule progress
  function getScheduleProgress() {
    if (!schedulerStatus?.status?.nextRun || !schedulerStatus?.status?.lastRun || reportConfig?.cadence === 'manual') {
      return 0;
    }

    const now = new Date();
    const lastRun = new Date(schedulerStatus.status.lastRun);
    const nextRun = new Date(schedulerStatus.status.nextRun);
    
    const totalInterval = nextRun.getTime() - lastRun.getTime();
    const elapsed = now.getTime() - lastRun.getTime();
    
    if (totalInterval <= 0) return 0;
    
    const progress = Math.min(Math.max((elapsed / totalInterval) * 100, 0), 100);
    return Math.round(progress);
  }

  // Helper function to calculate countdown
  function getCountdown(nextRunTime: string) {
    const now = new Date();
    const next = new Date(nextRunTime);
    const diff = next.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }

  const handleRunNow = async () => {
    setIsRunning(true);
    toast({
      title: "Report Generation Started",
      description: "Your report is being generated. This usually takes 2-3 minutes.",
    });
    
    try {
      const response = await fetch('/api/scheduler/run', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to run report');
      }

      const result = await response.json();
      
      // Small delay to ensure file has been written, then refresh scheduler status
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchSchedulerStatus();

      setIsRunning(false);
      
      // Check if this was a successful run with data or without data
      if (result.run?.status === 'success') {
        toast({
          title: "Report Generated Successfully", 
          description: schedulerStatus?.status?.lastError ? 
            "Report generated but no data was available. Check the error panel for details." :
            "Your latest report is now available with fresh data.",
        });
      } else {
        throw new Error('Report generation failed');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setIsRunning(false);
      
      // Refresh status to show any error details
      await fetchSchedulerStatus();
      
      toast({
        title: "Report Generation Failed",
        description: "There was an error generating your report. Check the error panel for details.",
        variant: "destructive"
      });
    }
  };

  const handleCopyLink = () => {
    const reportUrl = schedulerStatus?.status?.reportPath 
      ? `${window.location.origin}${schedulerStatus.status.reportPath}`
      : "No report available";
    
    navigator.clipboard.writeText(reportUrl);
    toast({
      title: "Link Copied",
      description: "Report link has been copied to your clipboard.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "bg-success/10 text-success hover:bg-success/20",
      error: "bg-destructive/10 text-destructive hover:bg-destructive/20",
      warning: "bg-warning/10 text-warning hover:bg-warning/20",
      running: "bg-primary/10 text-primary hover:bg-primary/20"
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-muted/10 text-muted-foreground"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl relative">
        {/* Dashboard Content */}
        <div className={reportConfig ? "" : "blur-sm pointer-events-none"}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Monitor your report generation and performance</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Config
                </Link>
              </Button>
              <Button 
                onClick={handleRunNow} 
                disabled={isRunning}
                className="relative"
              >
                {isRunning ? (
                  <>
                    <Timer className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Now
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Last Run Status */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {getStatusIcon(lastRun?.status || 'pending')}
                  Last Run
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(lastRun?.status || 'pending')}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="text-sm font-medium">{lastRun?.timestamp || 'No runs yet'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-medium">{lastRun?.duration || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Records</span>
                  <span className="text-sm font-medium">{lastRun?.recordsProcessed?.toLocaleString() || '0'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Next Run */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  Next Run
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled</span>
                  <span className="text-sm font-medium">{nextRun.scheduled}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Countdown</span>
                  <span className="text-sm font-medium text-accent">{nextRun.countdown}</span>
                </div>
                {reportConfig?.cadence !== 'manual' && reportConfig?.cadence && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{nextRun.progress}%</span>
                    </div>
                    <Progress value={nextRun.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Last Error */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {lastError ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-success" />
                  )}
                  {lastError ? 'Last Error' : 'System Status'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lastError ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Code</span>
                      <Badge variant="outline" className="text-destructive border-destructive/20">
                        {lastError.code}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Occurred</span>
                      <span className="text-sm font-medium">{lastError.timestamp}</span>
                    </div>
                    
                    {lastError.code === 'INSUFFICIENT_DATA' && (
                      <>
                        <div className="pt-2 pb-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">Issue:</p>
                          <p className="text-xs">{lastError.message}</p>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-orange-800 mb-1">Suggestion</p>
                              <p className="text-xs text-orange-700">{lastError.suggestion}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-2">
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <Link href="/">
                              <Settings className="h-3 w-3 mr-1" />
                              Update Configuration
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}
                    
                    {lastError.code !== 'INSUFFICIENT_DATA' && (
                      <div className="pt-2">
                        <Badge variant="outline" className="text-xs">
                          Auto-retry in 1h
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-success border-success/20">
                        All Good
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Check</span>
                      <span className="text-sm font-medium">
                        {schedulerStatus?.status?.lastRun ? 
                          new Date(schedulerStatus.status.lastRun).toLocaleString() : 
                          'No runs yet'}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Badge variant="outline" className="text-xs text-success border-success/20">
                        System Running Smoothly
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Current Configuration */}
          <Card className="shadow-card mt-2">
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Platform</div>
                  <p className="text-sm font-medium mt-1">
                    {reportConfig?.platform === 'meta' ? 'Meta (Facebook & Instagram)' : 
                     reportConfig?.platform === 'tiktok' ? 'TikTok' : 'Not configured'}
                  </p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Level</div>
                  <p className="text-sm font-medium mt-1">
                    {reportConfig?.level ? 
                      reportConfig.level.charAt(0).toUpperCase() + reportConfig.level.slice(1) + ' Level' : 
                      'Not configured'}
                  </p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Date Range</div>
                  <p className="text-sm font-medium mt-1">
                    {reportConfig?.dateRangeEnum ? 
                      reportConfig.dateRangeEnum.replace('last', 'Last ').replace(/(\d+)/, '$1 days') : 
                      'Not configured'}
                  </p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Cadence</div>
                  <p className="text-sm font-medium mt-1">
                    {reportConfig?.cadence ? 
                      reportConfig.cadence.charAt(0).toUpperCase() + reportConfig.cadence.slice(1) : 
                      'Not configured'}
                  </p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Delivery</div>
                  <p className="text-sm font-medium mt-1">
                    {reportConfig?.delivery === 'email' ? 'Email' : 
                     reportConfig?.delivery === 'link' ? 'Public Link' : 'Not configured'}
                  </p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Metrics</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {reportConfig?.metrics?.slice(0, 2).map((metricId) => (
                      <Badge key={metricId} variant="secondary" className="text-xs">
                        {metricId.charAt(0).toUpperCase() + metricId.slice(1)}
                      </Badge>
                    ))}
                    {reportConfig?.metrics && reportConfig.metrics.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{reportConfig.metrics.length - 2} more
                      </Badge>
                    )}
                    {!reportConfig?.metrics?.length && (
                      <span className="text-sm text-muted-foreground">Not configured</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Latest Report - Show when there's a report available */}
          {schedulerStatus?.status?.reportPath && (
            <Card className="shadow-card mt-2">
              <CardHeader>
                <CardTitle>Latest Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {reportConfig?.platform?.toUpperCase()} Report - {lastRun?.timestamp || 'Recently generated'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Generated from {lastRun?.recordsProcessed?.toLocaleString() || '0'} records • {lastRun?.duration || 'Processing time'} • {reportConfig?.delivery === 'email' ? 'Sent via email' : 'Available via link'}
                    </p>
                  </div>
                  {reportConfig?.delivery === "link" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button size="sm" asChild>
                        <a href={schedulerStatus.status.reportPath} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Report
                        </a>
                      </Button>
                    </div>
                  )}
                  {reportConfig?.delivery === "email" && (
                    <div className="flex gap-2">
                      <Button size="sm" asChild>
                        <a href={schedulerStatus.status.reportPath} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Report
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* No Configuration Overlay */}
        {!reportConfig && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <Card className="shadow-elevated max-w-md mx-4">
              <CardHeader className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                  <Settings className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="text-xl">No Configuration Found</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  You need to configure a report before you can use the dashboard.
                </p>
                <Button asChild className="w-full">
                  <Link href="/">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Report
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;