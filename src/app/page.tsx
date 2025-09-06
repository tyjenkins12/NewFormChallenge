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
import { Play, Save, Eye, Settings, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import TokenSettings from "@/components/TokenSettings";

// Mock data generator for different metrics
const generateMockValue = (metric: string, day: number) => {
  const seed = day * 137; // Simple seed for consistent but varied data
  const random = (Math.sin(seed) + 1) / 2; // 0-1 range
  
  const metricRanges: Record<string, { min: number, max: number, format: (n: number) => string }> = {
    impressions: { min: 8000, max: 25000, format: (n) => Math.round(n).toLocaleString() },
    clicks: { min: 400, max: 1500, format: (n) => Math.round(n).toLocaleString() },
    spend: { min: 150, max: 800, format: (n) => `$${n.toFixed(2)}` },
    conversions: { min: 20, max: 70, format: (n) => Math.round(n).toString() },
    ctr: { min: 2.1, max: 8.5, format: (n) => `${n.toFixed(2)}%` },
    cpc: { min: 0.15, max: 2.50, format: (n) => `$${n.toFixed(2)}` },
    reach: { min: 5000, max: 18000, format: (n) => Math.round(n).toLocaleString() },
    frequency: { min: 1.2, max: 3.8, format: (n) => n.toFixed(2) },
    cost_per_conversion: { min: 8, max: 35, format: (n) => `$${n.toFixed(2)}` },
    conversion_rate: { min: 1.2, max: 6.8, format: (n) => `${n.toFixed(2)}%` },
    actions: { min: 25, max: 180, format: (n) => n.toFixed(2) },
    cost_per_action_type: { min: 0.85, max: 4.25, format: (n) => `$${n.toFixed(2)}` }
  };
  
  const range = metricRanges[metric] || { min: 100, max: 1000, format: (n) => n.toString() };
  return range.min + (range.max - range.min) * random;
};

// Generate mock data based on selected metrics
const generateMockData = (selectedMetrics: string[]) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  return days.map((day, index) => {
    const dayData: Record<string, any> = { name: day };
    
    selectedMetrics.forEach(metric => {
      dayData[metric] = generateMockValue(metric, index);
    });
    
    return dayData;
  });
};

// Get metric display info
const getMetricDisplay = (metric: string) => {
  const displays: Record<string, { label: string, format: (n: number) => string, color: string }> = {
    impressions: { label: "Impressions", format: (n) => Math.round(n).toLocaleString(), color: "text-chart-1" },
    clicks: { label: "Clicks", format: (n) => Math.round(n).toLocaleString(), color: "text-chart-2" },
    spend: { label: "Spend", format: (n) => `$${n.toFixed(2)}`, color: "text-chart-3" },
    conversions: { label: "Conversions", format: (n) => Math.round(n).toString(), color: "text-chart-4" },
    ctr: { label: "CTR", format: (n) => `${n.toFixed(2)}%`, color: "text-chart-1" },
    cpc: { label: "CPC", format: (n) => `$${n.toFixed(2)}`, color: "text-chart-2" },
    reach: { label: "Reach", format: (n) => Math.round(n).toLocaleString(), color: "text-chart-3" },
    frequency: { label: "Frequency", format: (n) => n.toFixed(2), color: "text-chart-4" },
    cost_per_conversion: { label: "Cost/Conv", format: (n) => `$${n.toFixed(2)}`, color: "text-chart-1" },
    conversion_rate: { label: "Conv Rate", format: (n) => `${n.toFixed(2)}%`, color: "text-chart-2" },
    actions: { label: "Actions", format: (n) => n.toFixed(2), color: "text-chart-3" },
    cost_per_action_type: { label: "Cost/Action", format: (n) => `$${n.toFixed(2)}`, color: "text-chart-4" }
  };
  
  return displays[metric] || { label: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), format: (n) => n.toString(), color: "text-chart-1" };
};

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
  CADENCES,
  CRON_PRESETS
} from '@/types';
import { validateCronExpression, describeCronExpression } from '@/lib/utils/cron-utils';

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
    cronExpression: "", // Always initialize as empty string, never undefined
    delivery: "",
    email: "",
    pdfAttachment: false,
    breakdowns: [] as string[], // For Meta
    dimensions: [] as string[], // For TikTok
    timeIncrement: "7", // Default for Meta
    reportType: "BASIC" as "BASIC" | "AUDIENCE", // Default for TikTok
  });
  
  const [demoMode, setDemoMode] = useState({
    enabled: false,
    accelerated: false,
  });

  const [tokenSettings, setTokenSettings] = useState({
    enabled: false,
    expirationHours: 168,
    allowRefresh: true,
  });

  const [isValid, setIsValid] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Load or initialize configuration on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const initializeConfiguration = async () => {
      // Check if this is a fresh server session
      const sessionId = sessionStorage.getItem('serverSessionId');
      const newSessionId = Date.now().toString();
      
      if (!sessionId) {
        // New session - clear everything once
        console.log('🧹 New server session detected - clearing all configuration');
        localStorage.removeItem('reportConfig');
        sessionStorage.setItem('serverSessionId', newSessionId);
        
        // Clear server-side configuration
        try {
          await fetch('/api/scheduler/clear', {
            method: 'POST',
          });
          console.log('🗂️ Server configuration cleared for new session');
        } catch (error) {
          console.error('Failed to clear server configuration:', error);
        }
        
        console.log('✅ Fresh session initialized');
      } else {
        console.log('📂 Existing session - loading saved configuration');
      }
      
      // Load existing configuration if available
      try {
        const stored = localStorage.getItem('reportConfig');
        if (stored) {
          const savedData = JSON.parse(stored);
          if (savedData.config) {
            // Ensure cronExpression is always a string to avoid controlled/uncontrolled input issues
            const configWithDefaults = {
              ...savedData.config,
              cronExpression: savedData.config.cronExpression || ""
            };
            setConfig(configWithDefaults);
            console.log('✅ Loaded saved configuration');
          }
          if (savedData.demoMode) {
            setDemoMode(savedData.demoMode);
          }
          if (savedData.tokenSettings) {
            setTokenSettings(savedData.tokenSettings);
          }
        } else {
          console.log('📋 No saved configuration found');
        }
      } catch (error) {
        console.error('Error loading saved configuration:', error);
      }
    };
    
    initializeConfiguration();
  }, []);

  const handleSave = () => {
    console.log("Saving configuration:", config, demoMode, tokenSettings);
    const configData = { config, demoMode, tokenSettings, savedAt: new Date().toISOString() };
    localStorage.setItem('reportConfig', JSON.stringify(configData));
    toast({
      title: "Configuration Saved",
      description: "Your report configuration has been saved successfully.",
    });
  };

  const handleSaveAndStart = async () => {
    console.log("Saving and starting configuration:", config, demoMode);
    
    try {
      setIsGeneratingReport(true);
      
      // Show different messages for manual vs scheduled cadences
      const isManual = config.cadence === 'manual';
      
      if (isManual) {
        toast({
          title: "Generating Report",
          description: "Creating your report now. This may take a few minutes...",
        });
      } else {
        toast({
          title: "Starting Report Schedule",
          description: `Scheduling ${config.cadence} reports. Redirecting to dashboard...`,
        });
      }
      
      // Save to localStorage for UI persistence
      const configData = { config, demoMode, tokenSettings, savedAt: new Date().toISOString(), started: true };
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
          cronExpression: config.cronExpression,
          delivery: config.delivery,
          email: config.email,
          timeIncrement: config.timeIncrement,
          reportType: config.reportType,
          pdfAttachment: config.pdfAttachment,
          tokenSettings: tokenSettings,
          demoMode: demoMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start scheduler');
      }

      if (isManual) {
        toast({
          title: "Report Generated Successfully",
          description: "Your report has been created and is ready to view. Redirecting to dashboard...",
        });
      } else {
        toast({
          title: "Report Schedule Started",
          description: "Your reports are now scheduled and running. Redirecting to dashboard...",
        });
      }
      
      // Navigate to dashboard after a short delay to show the toast
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Failed to save and start:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start report configuration",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
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
    const cronExpression = config.cronExpression || "";
    const cronValid = config.cadence !== "custom" || (cronExpression && validateCronExpression(cronExpression).isValid);
    const isConfigValid = !!(required && emailValid && cronValid);
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
                  <div className="grid grid-cols-3 gap-2">
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
                  <div className="grid grid-cols-3 gap-2">
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
                  <div className="grid grid-cols-3 gap-2">
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
                <Select value={config.cadence} onValueChange={(value) => setConfig(prev => ({ ...prev, cadence: value, cronExpression: value !== 'custom' ? '' : prev.cronExpression }))}>
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

              {/* Custom Cron Expression */}
              {config.cadence === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cronExpression">Cron Expression *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Use standard cron format: minute hour day month day-of-week
                    </p>
                  </div>
                  
                  <Input
                    id="cronExpression"
                    value={config.cronExpression || ""} // Ensure always a string
                    onChange={(e) => setConfig(prev => ({ ...prev, cronExpression: e.target.value }))}
                    placeholder="0 9 * * 1 (Every Monday at 9 AM)"
                    className={(() => {
                      const expression = config.cronExpression || "";
                      if (!expression) return '';
                      const validation = validateCronExpression(expression);
                      return validation.isValid ? 'border-green-500' : 'border-red-500';
                    })()}
                  />
                  
                  {config.cronExpression && (() => {
                    const expression = config.cronExpression || "";
                    const validation = validateCronExpression(expression);
                    if (validation.isValid) {
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            {describeCronExpression(expression)}
                          </p>
                          {validation.nextRunDates && validation.nextRunDates.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <p>Next runs:</p>
                              <ul className="list-disc list-inside ml-2">
                                {validation.nextRunDates.slice(0, 3).map((date, i) => (
                                  <li key={i}>{date.toLocaleString()}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-sm text-red-600">
                          ❌ {validation.error}
                        </p>
                      );
                    }
                  })()}

                  {/* Cron Presets */}
                  <div className="space-y-2">
                    <Label>Quick Presets</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {CRON_PRESETS.map((preset, index) => (
                        <button
                          key={index}
                          type="button"
                          className="text-left p-2 text-sm rounded border hover:bg-accent transition-colors"
                          onClick={() => setConfig(prev => ({ ...prev, cronExpression: preset.expression }))}
                        >
                          <div className="font-medium">{preset.label}</div>
                          <div className="text-xs text-muted-foreground">{preset.expression} - {preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                <>
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
                  
                  {/* PDF Attachment Option */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="pdfAttachment">Include PDF Attachment</Label>
                      <p className="text-sm text-muted-foreground">Attach a PDF version of the report to the email</p>
                    </div>
                    <Switch
                      id="pdfAttachment"
                      checked={config.pdfAttachment}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, pdfAttachment: checked }))}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Token Security Settings */}
          <TokenSettings
            settings={tokenSettings}
            onChange={setTokenSettings}
            className="shadow-card"
          />

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
                  }))}
                />
              </div>
              
              {demoMode.enabled && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Accelerated Schedule</Label>
                      <p className="text-sm text-muted-foreground">Hourly = 1min, Daily = 2min for testing</p>
                    </div>
                    <Switch
                      checked={demoMode.accelerated}
                      onCheckedChange={(checked) => setDemoMode(prev => ({ ...prev, accelerated: checked }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" disabled={!isValid} onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button disabled={!isValid || isGeneratingReport} onClick={handleSaveAndStart}>
              {isGeneratingReport ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {config.cadence === 'manual' ? 'Generating Report...' : 'Starting Schedule...'}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Save & Start
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="w-[480px] border-l border-border bg-gradient-card p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Eye className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">Live Preview</h2>
          </div>

          {config.platform && config.metrics.length > 0 ? (() => {
            // Generate dynamic mock data based on selected metrics
            const mockData = generateMockData(config.metrics);
            
            // Calculate totals for ALL selected metrics (no limit)
            const totals = config.metrics.map(metric => {
              const total = mockData.reduce((sum, day) => sum + day[metric], 0);
              const display = getMetricDisplay(metric);
              return {
                metric,
                total,
                display
              };
            });

            return (
              <div className="space-y-6">
                {/* Dynamic KPI Cards - Auto-fitting Grid */}
                <div className={`grid gap-3 ${
                  totals.length === 1 ? 'grid-cols-1' :
                  totals.length === 2 ? 'grid-cols-2' :
                  totals.length === 3 ? 'grid-cols-3' :
                  totals.length === 4 ? 'grid-cols-2' :
                  totals.length >= 5 ? 'grid-cols-3' : 'grid-cols-1'
                }`}>
                  {totals.map(({ metric, total, display }, index) => (
                    <Card key={metric} className="p-3">
                      <div className={`text-2xl font-bold ${display.color}`}>
                        {display.format(total)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total {display.label}</div>
                    </Card>
                  ))}
                </div>

                {/* Dynamic Chart */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium mb-3">Performance Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={mockData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          const display = getMetricDisplay(name);
                          return [display.format(Number(value)), display.label];
                        }}
                      />
                      {config.metrics.slice(0, 3).map((metric, index) => { // Show first 3 metrics in chart
                        const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];
                        return (
                          <Line 
                            key={metric}
                            type="monotone" 
                            dataKey={metric} 
                            stroke={colors[index]} 
                            strokeWidth={2}
                            name={getMetricDisplay(metric).label}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  {config.metrics.length === 0 && (
                    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                      Select metrics to see chart
                    </div>
                  )}
                </Card>

                {/* AI Summary */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium mb-2">AI Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    Performance shows strong engagement with Friday being the peak day. 
                    CTR is above industry average at 6.5%. Consider increasing budget 
                    allocation for weekends based on conversion patterns.
                  </p>
                </Card>
              </div>
            );
          })() : (
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
