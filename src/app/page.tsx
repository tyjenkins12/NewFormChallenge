"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Play, Save, Eye, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Mock data for preview
const mockData = [
  { name: "Mon", impressions: 12500, clicks: 850, conversions: 42 },
  { name: "Tue", impressions: 15200, clicks: 1020, conversions: 38 },
  { name: "Wed", impressions: 18600, clicks: 1250, conversions: 55 },
  { name: "Thu", impressions: 14800, clicks: 980, conversions: 47 },
  { name: "Fri", impressions: 21200, clicks: 1380, conversions: 62 },
  { name: "Sat", impressions: 19800, clicks: 1150, conversions: 48 },
  { name: "Sun", impressions: 16400, clicks: 920, conversions: 39 },
];

const platforms = [
  { value: "meta", label: "Meta (Facebook & Instagram)" },
  { value: "tiktok", label: "TikTok" },
];

// Import from types to ensure consistency with API
import { 
  META_METRICS, 
  META_BREAKDOWNS, 
  META_LEVELS,
  TIKTOK_METRICS, 
  TIKTOK_DIMENSIONS, 
  TIKTOK_LEVELS,
  DATE_RANGES,
  CADENCES
} from '@/types';

const metaMetrics = META_METRICS.map(metric => ({ 
  id: metric, 
  label: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
}));

const tiktokMetrics = TIKTOK_METRICS.map(metric => ({ 
  id: metric, 
  label: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
}));

export default function Configure() {
  const { toast } = useToast();
  const router = useRouter();
  const [config, setConfig] = useState({
    platform: "",
    metrics: [] as string[],
    level: "",
    dateRangeEnum: "", // Changed from dateRange
    cadence: "",
    delivery: "",
    email: "",
    breakdowns: [] as string[], // For Meta
    dimensions: [] as string[], // For TikTok
    timeIncrement: "7", // Default for Meta
    reportType: "BASIC" as "BASIC" | "AUDIENCE", // Default for TikTok
  });
  
  const [demoMode, setDemoMode] = useState({
    enabled: false,
    accelerated: false,
    simulateFailure: false,
    bypassCache: false,
  });

  const [isValid, setIsValid] = useState(false);

  // Load saved configuration on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('reportConfig');
      if (stored) {
        const savedData = JSON.parse(stored);
        if (savedData.config) {
          setConfig(savedData.config);
        }
        if (savedData.demoMode) {
          setDemoMode(savedData.demoMode);
        }
      }
    } catch (error) {
      console.error('Error loading saved configuration:', error);
    }
  }, []);

  const handleSave = () => {
    console.log("Saving configuration:", config, demoMode);
    const configData = { config, demoMode, savedAt: new Date().toISOString() };
    localStorage.setItem('reportConfig', JSON.stringify(configData));
    toast({
      title: "Configuration Saved",
      description: "Your report configuration has been saved successfully.",
    });
  };

  const handleSaveAndStart = async () => {
    console.log("Saving and starting configuration:", config, demoMode);
    
    try {
      // Save to localStorage for UI persistence
      const configData = { config, demoMode, savedAt: new Date().toISOString(), started: true };
      localStorage.setItem('reportConfig', JSON.stringify(configData));

      // Send to scheduler API
      const response = await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: config.platform,
          metrics: config.metrics,
          level: config.level,
          breakdowns: config.breakdowns,
          dimensions: config.dimensions,
          dateRangeEnum: config.dateRangeEnum,
          cadence: config.cadence,
          delivery: config.delivery,
          email: config.email,
          timeIncrement: config.timeIncrement,
          reportType: config.reportType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start scheduler');
      }

      toast({
        title: "Configuration Saved & Started",
        description: "Your report is now configured and running. Redirecting to dashboard...",
      });
      
      // Navigate to dashboard after a short delay to show the toast
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Failed to save and start:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start report configuration",
        variant: "destructive",
      });
    }
  };

  const getAvailableMetrics = () => {
    return config.platform === "meta" ? metaMetrics : tiktokMetrics;
  };

  const getLevelOptions = () => {
    if (config.platform === "meta") {
      return META_LEVELS.map(level => ({
        value: level,
        label: level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }));
    }
    return TIKTOK_LEVELS.map(level => ({
      value: level,
      label: level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  };

  const handleMetricToggle = (metricId: string, checked: boolean | string) => {
    const isChecked = checked === true;
    setConfig(prev => ({
      ...prev,
      metrics: isChecked 
        ? [...prev.metrics, metricId]
        : prev.metrics.filter(m => m !== metricId)
    }));
  };

  const validateConfig = useCallback(() => {
    const required = config.platform && config.metrics.length > 0 && config.level && config.dateRangeEnum && config.cadence && config.delivery;
    const emailValid = config.delivery !== "email" || config.email;
    const isConfigValid = !!(required && emailValid);
    setIsValid(isConfigValid);
  }, [config]);

  // Validate whenever config changes
  useEffect(() => {
    validateConfig();
  }, [validateConfig]);

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Configuration Form */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configure Report</h1>
              <p className="text-muted-foreground">Set up your analytics report parameters</p>
            </div>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label htmlFor="platform">Platform *</Label>
                <Select value={config.platform} onValueChange={(value) => setConfig(prev => ({ 
                  ...prev, 
                  platform: value, 
                  metrics: [], 
                  level: "",
                  breakdowns: [],
                  dimensions: []
                }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(platform => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metrics Selection */}
              {config.platform && (
                <div className="space-y-3">
                  <Label>Metrics *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {getAvailableMetrics().map(metric => (
                      <div key={metric.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={metric.id}
                          checked={config.metrics.includes(metric.id)}
                          onCheckedChange={(checked) => handleMetricToggle(metric.id, checked as boolean)}
                        />
                        <Label htmlFor={metric.id} className="text-sm">{metric.label}</Label>
                      </div>
                    ))}
                  </div>
                  {config.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {config.metrics.map(metricId => {
                        const metric = getAvailableMetrics().find(m => m.id === metricId);
                        return metric ? (
                          <Badge key={metricId} variant="secondary">{metric.label}</Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Level Selection */}
              {config.platform && (
                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Select value={config.level} onValueChange={(value) => setConfig(prev => ({ ...prev, level: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reporting level" />
                    </SelectTrigger>
                    <SelectContent>
                      {getLevelOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Meta Breakdowns */}
              {config.platform === "meta" && (
                <div className="space-y-3">
                  <Label>Breakdowns (optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {META_BREAKDOWNS.map(breakdown => (
                      <div key={breakdown} className="flex items-center space-x-2">
                        <Checkbox
                          id={breakdown}
                          checked={config.breakdowns.includes(breakdown)}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setConfig(prev => ({
                              ...prev,
                              breakdowns: isChecked 
                                ? [...prev.breakdowns, breakdown]
                                : prev.breakdowns.filter(b => b !== breakdown)
                            }));
                          }}
                        />
                        <Label htmlFor={breakdown} className="text-sm">
                          {breakdown.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TikTok Dimensions */}
              {config.platform === "tiktok" && (
                <div className="space-y-3">
                  <Label>Dimensions (optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {TIKTOK_DIMENSIONS.map(dimension => (
                      <div key={dimension} className="flex items-center space-x-2">
                        <Checkbox
                          id={dimension}
                          checked={config.dimensions.includes(dimension)}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setConfig(prev => ({
                              ...prev,
                              dimensions: isChecked 
                                ? [...prev.dimensions, dimension]
                                : prev.dimensions.filter(d => d !== dimension)
                            }));
                          }}
                        />
                        <Label htmlFor={dimension} className="text-sm">
                          {dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div className="space-y-2">
                <Label htmlFor="dateRange">Date Range *</Label>
                <Select value={config.dateRangeEnum} onValueChange={(value) => setConfig(prev => ({ ...prev, dateRangeEnum: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cadence */}
              <div className="space-y-2">
                <Label htmlFor="cadence">Cadence *</Label>
                <Select value={config.cadence} onValueChange={(value) => setConfig(prev => ({ ...prev, cadence: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCES.map(cadence => (
                      <SelectItem key={cadence.value} value={cadence.value}>
                        {cadence.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery Method */}
              <div className="space-y-2">
                <Label htmlFor="delivery">Delivery *</Label>
                <Select value={config.delivery} onValueChange={(value) => setConfig(prev => ({ ...prev, delivery: value, email: value === "email" ? prev.email : "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="link">Public Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email Input */}
              {config.delivery === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    type="email"
                    id="email"
                    value={config.email}
                    onChange={(e) => setConfig(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Demo Mode Toggles */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Demo Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Demo Mode</Label>
                </div>
                <Switch
                  checked={demoMode.enabled}
                  onCheckedChange={(checked) => setDemoMode(prev => ({ 
                    ...prev, 
                    enabled: checked,
                    // Reset sub-options when disabling demo mode
                    accelerated: checked ? prev.accelerated : false,
                    simulateFailure: checked ? prev.simulateFailure : false,
                    bypassCache: checked ? prev.bypassCache : false,
                  }))}
                />
              </div>
              
              {demoMode.enabled && (
                <>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Accelerated Schedule</Label>
                        <p className="text-sm text-muted-foreground">Hourly = 30s, Daily = 120s</p>
                      </div>
                      <Switch
                        checked={demoMode.accelerated}
                        onCheckedChange={(checked) => setDemoMode(prev => ({ ...prev, accelerated: checked }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Simulate LLM Failure</Label>
                      <p className="text-sm text-muted-foreground">Test error handling</p>
                    </div>
                    <Switch
                      checked={demoMode.simulateFailure}
                      onCheckedChange={(checked) => setDemoMode(prev => ({ ...prev, simulateFailure: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Bypass Cache</Label>
                      <p className="text-sm text-muted-foreground">Force real API calls</p>
                    </div>
                    <Switch
                      checked={demoMode.bypassCache}
                      onCheckedChange={(checked) => setDemoMode(prev => ({ ...prev, bypassCache: checked }))}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" disabled={!isValid} onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button disabled={!isValid} onClick={handleSaveAndStart}>
              <Play className="h-4 w-4 mr-2" />
              Save & Start
            </Button>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="w-96 border-l border-border bg-gradient-card p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Eye className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">Live Preview</h2>
          </div>

          {config.platform && config.metrics.length > 0 ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <div className="text-2xl font-bold text-chart-1">125.4K</div>
                  <div className="text-xs text-muted-foreground">Total Impressions</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-chart-2">8.2K</div>
                  <div className="text-xs text-muted-foreground">Total Clicks</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-chart-3">6.5%</div>
                  <div className="text-xs text-muted-foreground">CTR</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-chart-4">331</div>
                  <div className="text-xs text-muted-foreground">Conversions</div>
                </Card>
              </div>

              {/* Sample Chart */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Performance Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="impressions" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                    <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Summary */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-2">AI Summary</h3>
                <p className="text-sm text-muted-foreground">
                  Performance shows strong engagement with Friday being the peak day. 
                  CTR is above industry average at 6.5%. Consider increasing budget 
                  allocation for weekends based on conversion patterns.
                </p>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Configure your report settings to see a live preview
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
