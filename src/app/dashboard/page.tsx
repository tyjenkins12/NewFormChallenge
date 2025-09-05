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

interface ReportConfig {
  platform: string;
  metrics: string[];
  level: string;
  dateRange: string;
  cadence: string;
  delivery: string;
  email?: string;
}

const Dashboard = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  
  // Load configuration from localStorage
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
  }, []);

  const lastRun = {
    timestamp: "2024-01-15 14:30:25",
    status: "success",
    duration: "2.3s",
    recordsProcessed: 1247
  };

  const nextRun = {
    scheduled: "2024-01-16 14:30:00",
    countdown: "23h 45m 12s"
  };

  const lastError = {
    code: "API_RATE_LIMIT",
    message: "Rate limit exceeded for Meta API",
    timestamp: "2024-01-14 09:15:32"
  };

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

      setTimeout(() => {
        setIsRunning(false);
        toast({
          title: "Report Generated Successfully",
          description: "Your latest report is now available.",
        });
      }, 3000);
    } catch (error) {
      console.error('Error generating report:', error);
      setIsRunning(false);
      toast({
        title: "Report Generation Failed",
        description: "There was an error generating your report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://analytics-hub.example.com/report/abc123");
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
                  {getStatusIcon(lastRun.status)}
                  Last Run
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(lastRun.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="text-sm font-medium">{lastRun.timestamp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-medium">{lastRun.duration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Records</span>
                  <span className="text-sm font-medium">{lastRun.recordsProcessed.toLocaleString()}</span>
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
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>15%</span>
                  </div>
                  <Progress value={15} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Last Error */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Last Error
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <div className="pt-2">
                  <Badge variant="outline" className="text-xs">
                    Auto-retry in 1h
                  </Badge>
                </div>
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
                    {reportConfig?.dateRange ? `Last ${reportConfig.dateRange} days` : 'Not configured'}
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

          {/* Report Actions - Only show for link delivery */}
          {reportConfig?.delivery === "link" && (
            <Card className="shadow-card mt-2">
              <CardHeader>
                <CardTitle>Latest Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Analytics Report - Jan 15, 2024</p>
                    <p className="text-sm text-muted-foreground">Generated from 1,247 records • 2.3s processing time</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button size="sm" asChild>
                      <a href="https://analytics-hub.example.com/report/abc123" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Report
                      </a>
                    </Button>
                  </div>
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