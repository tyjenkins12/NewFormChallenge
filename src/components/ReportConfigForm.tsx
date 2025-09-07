'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import TokenSettings from './TokenSettings';
import { 
  ReportConfig, 
  TIKTOK_METRICS, 
  TIKTOK_DIMENSIONS, 
  TIKTOK_LEVELS,
  META_METRICS, 
  META_BREAKDOWNS, 
  META_LEVELS,
  DATE_RANGES,
  CADENCES
} from '@/types';
import { CONFIG_TEMPLATES, getTemplatesByPlatform } from '@/lib/config-templates';
import type { ValidationResult } from '@/lib/data-validator';
import { 
  getValidMetaBreakdowns, 
  getValidTikTokDimensions, 
  getDimensionLabel 
} from '@/lib/level-dimension-mapping';

const formSchema = z.object({
  platform: z.enum(['meta', 'tiktok']),
  metrics: z.array(z.string()).min(1, 'At least one metric is required'),
  level: z.string().min(1, 'Level is required'),
  breakdowns: z.array(z.string()).optional(),
  dimensions: z.array(z.string()).optional(),
  dateRangeEnum: z.enum(['last7', 'last14', 'last30', 'lifetime']),
  cadence: z.enum(['manual', 'hourly', '12hours', 'daily']),
  delivery: z.enum(['email', 'link']),
  email: z.string().email().optional(),
  pdfAttachment: z.boolean().optional(),
  tokenSettings: z.object({
    enabled: z.boolean(),
    expirationHours: z.number().optional(),
    allowRefresh: z.boolean().optional(),
  }).optional(),
}).refine((data) => {
  if (data.delivery === 'email') {
    return data.email && data.email.length > 0;
  }
  return true;
}, {
  message: 'Email is required when delivery method is email',
  path: ['email'],
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  onSubmit: (config: ReportConfig) => void;
  loading?: boolean;
}

export default function ReportConfigForm({ onSubmit, loading }: Props) {
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'tiktok'>('meta');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedBreakdowns, setSelectedBreakdowns] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [tokenSettings, setTokenSettings] = useState({
    enabled: false,
    expirationHours: 168,
    allowRefresh: true
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: 'meta',
      metrics: [],
      level: '',
      breakdowns: [],
      dimensions: [],
      dateRangeEnum: 'last7',
      cadence: 'daily',
      delivery: 'link',
      email: '',
      pdfAttachment: false,
      tokenSettings: {
        enabled: false,
        expirationHours: 168,
        allowRefresh: true
      },
    },
  });

  const handleSubmit = (data: FormData) => {
    const config: ReportConfig = {
      platform: data.platform,
      metrics: data.metrics,
      level: data.level,
      dateRangeEnum: data.dateRangeEnum,
      cadence: data.cadence,
      delivery: data.delivery,
      email: data.email,
      pdfAttachment: data.pdfAttachment,
      tokenSettings: data.tokenSettings,
    };

    if (data.platform === 'meta' && data.breakdowns) {
      config.breakdowns = data.breakdowns;
    } else if (data.platform === 'tiktok' && data.dimensions) {
      config.dimensions = data.dimensions;
    }

    onSubmit(config);
  };

  const validateConfiguration = async () => {
    if (!selectedMetrics.length || !form.getValues('level')) {
      setValidationResult(null);
      return;
    }

    setValidating(true);
    try {
      const config = {
        platform: selectedPlatform,
        metrics: selectedMetrics,
        level: form.getValues('level'),
        dateRangeEnum: form.getValues('dateRangeEnum'),
        breakdowns: selectedPlatform === 'meta' ? selectedBreakdowns : undefined,
        dimensions: selectedPlatform === 'tiktok' ? selectedDimensions : undefined,
      };

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setValidating(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = CONFIG_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const config = template.config;
    
    // Update form values
    if (config.level) form.setValue('level', config.level);
    if (config.dateRangeEnum) form.setValue('dateRangeEnum', config.dateRangeEnum);
    if (config.metrics) {
      setSelectedMetrics(config.metrics);
      form.setValue('metrics', config.metrics);
    }
    if (config.breakdowns) {
      setSelectedBreakdowns(config.breakdowns);
      form.setValue('breakdowns', config.breakdowns);
    }
    if (config.dimensions) {
      setSelectedDimensions(config.dimensions);
      form.setValue('dimensions', config.dimensions);
    }

    setShowTemplates(false);
    // Trigger validation after applying template
    setTimeout(validateConfiguration, 100);
  };

  const handlePlatformChange = (platform: 'meta' | 'tiktok') => {
    setSelectedPlatform(platform);
    setSelectedMetrics([]);
    setSelectedBreakdowns([]);
    setSelectedDimensions([]);
    setValidationResult(null);
    form.setValue('platform', platform);
    form.setValue('metrics', []);
    form.setValue('level', '');
    form.setValue('breakdowns', []);
    form.setValue('dimensions', []);
  };

  const handleLevelChange = (level: string) => {
    form.setValue('level', level);
    
    // Clear incompatible breakdowns/dimensions when level changes
    if (selectedPlatform === 'meta') {
      const validBreakdowns = getValidMetaBreakdowns(level);
      const filteredBreakdowns = selectedBreakdowns.filter(breakdown => 
        validBreakdowns.includes(breakdown)
      );
      if (filteredBreakdowns.length !== selectedBreakdowns.length) {
        setSelectedBreakdowns(filteredBreakdowns);
        form.setValue('breakdowns', filteredBreakdowns);
      }
    } else if (selectedPlatform === 'tiktok') {
      const validDimensions = getValidTikTokDimensions(level);
      const filteredDimensions = selectedDimensions.filter(dimension => 
        validDimensions.includes(dimension)
      );
      
      // Always update the state to force re-render
      setSelectedDimensions(filteredDimensions);
      form.setValue('dimensions', filteredDimensions);
    }
    
    // Trigger validation after level change
    setTimeout(validateConfiguration, 300);
  };

  const handleMetricToggle = (metric: string) => {
    const newMetrics = selectedMetrics.includes(metric)
      ? selectedMetrics.filter(m => m !== metric)
      : [...selectedMetrics, metric];
    setSelectedMetrics(newMetrics);
    form.setValue('metrics', newMetrics);
    // Trigger validation after metric change
    setTimeout(validateConfiguration, 300);
  };

  const handleBreakdownToggle = (breakdown: string) => {
    const newBreakdowns = selectedBreakdowns.includes(breakdown)
      ? selectedBreakdowns.filter(b => b !== breakdown)
      : [...selectedBreakdowns, breakdown];
    setSelectedBreakdowns(newBreakdowns);
    form.setValue('breakdowns', newBreakdowns);
  };

  const handleDimensionToggle = (dimension: string) => {
    const newDimensions = selectedDimensions.includes(dimension)
      ? selectedDimensions.filter(d => d !== dimension)
      : [...selectedDimensions, dimension];
    setSelectedDimensions(newDimensions);
    form.setValue('dimensions', newDimensions);
  };

  const availableMetrics = selectedPlatform === 'meta' ? META_METRICS : TIKTOK_METRICS;
  const availableLevels = selectedPlatform === 'meta' ? META_LEVELS : TIKTOK_LEVELS;
  
  // Get valid breakdowns/dimensions based on selected level
  const currentLevel = form.watch('level');
  const availableBreakdowns = selectedPlatform === 'meta' && currentLevel 
    ? getValidMetaBreakdowns(currentLevel) 
    : [];
  const availableDimensions = selectedPlatform === 'tiktok' && currentLevel 
    ? getValidTikTokDimensions(currentLevel) 
    : [];
  

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Configure Insight Report</CardTitle>
        <CardDescription>
          Set up your recurring ad performance report with custom metrics and delivery preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Platform */}
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select onValueChange={handlePlatformChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Template Selector */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Quick Start Templates</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  {showTemplates ? 'Hide' : 'Show'} Templates
                </Button>
              </div>
              {showTemplates && (
                <div className="grid gap-2">
                  {getTemplatesByPlatform(selectedPlatform).map((template) => (
                    <div key={template.id} className="p-3 border rounded-md hover:bg-white cursor-pointer transition-colors" onClick={() => applyTemplate(template.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                        </div>
                        {template.tags.includes('reliable') && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Reliable</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Level */}
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); handleLevelChange(value); }} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Metrics */}
            <div className="space-y-2">
              <Label>Metrics (select at least 1)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded">
                {availableMetrics.map((metric) => (
                  <div key={metric} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`metric-${metric}`}
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => handleMetricToggle(metric)}
                      className="rounded"
                    />
                    <label htmlFor={`metric-${metric}`} className="text-sm">
                      {metric.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))}
              </div>
              {form.formState.errors.metrics && (
                <p className="text-sm text-red-500">{form.formState.errors.metrics.message}</p>
              )}
            </div>

            {/* Platform-specific dimensions/breakdowns */}
            {selectedPlatform === 'meta' && currentLevel && (
              <div className="space-y-2">
                <Label>Breakdowns (optional)</Label>
                {availableBreakdowns.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                    {availableBreakdowns.map((breakdown) => (
                      <div key={breakdown} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`breakdown-${breakdown}`}
                          checked={selectedBreakdowns.includes(breakdown)}
                          onChange={() => handleBreakdownToggle(breakdown)}
                          className="rounded"
                        />
                        <label htmlFor={`breakdown-${breakdown}`} className="text-sm">
                          {getDimensionLabel(breakdown)}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 p-2 border rounded">
                    Select a level first to see available breakdowns
                  </p>
                )}
              </div>
            )}

            {selectedPlatform === 'tiktok' && currentLevel && (
              <div className="space-y-2">
                <Label>Dimensions (optional)</Label>
                {availableDimensions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                    {availableDimensions.map((dimension) => (
                      <div key={dimension} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`dimension-${dimension}`}
                          checked={selectedDimensions.includes(dimension)}
                          onChange={() => handleDimensionToggle(dimension)}
                          className="rounded"
                        />
                        <label htmlFor={`dimension-${dimension}`} className="text-sm">
                          {getDimensionLabel(dimension)}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 p-2 border rounded">
                    Select a level first to see available dimensions
                  </p>
                )}
              </div>
            )}

            {/* Date Range */}
            <FormField
              control={form.control}
              name="dateRangeEnum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Range</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); setTimeout(validateConfiguration, 300); }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a date range" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DATE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validation Feedback */}
            {(validating || validationResult) && (
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Data Availability Check</Label>
                  {validating && <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>}
                </div>
                
                {validationResult && !validating && (
                  <div className={validationResult.hasData ? "text-green-700 bg-green-50 p-3 rounded" : "text-orange-700 bg-orange-50 p-3 rounded"}>
                    {validationResult.hasData ? (
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        <span>Great! This configuration should return {validationResult.recordCount} data points.</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-orange-500">⚠</span>
                          <span>This configuration will return no data points.</span>
                        </div>
                        {validationResult.metricIssues && (
                          <div className="text-sm mb-3 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="font-medium text-red-800 mb-1">Metric Issues:</p>
                            <p className="text-red-700 mb-2">
                              These metrics are not available: <strong>{validationResult.metricIssues.unavailableMetrics.join(', ')}</strong>
                            </p>
                            <p className="text-red-700">
                              Try these instead: <strong>{validationResult.metricIssues.suggestedMetrics.join(', ')}</strong>
                            </p>
                          </div>
                        )}
                        {validationResult.dimensionIssues && (
                          <div className="text-sm mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="font-medium text-yellow-800 mb-1">Dimension Issues:</p>
                            {validationResult.dimensionIssues.map((issue, index) => (
                              <p key={index} className="text-yellow-700">{issue}</p>
                            ))}
                          </div>
                        )}
                        {validationResult.suggestions && (
                          <div className="text-sm">
                            <p className="mb-1">Or try these alternatives:</p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              {validationResult.suggestions.level && (
                                <li>Switch to &apos;{validationResult.suggestions.level}&apos; level</li>
                              )}
                              {validationResult.suggestions.dateRange && (
                                <li>Use &apos;{validationResult.suggestions.dateRange}&apos; date range</li>
                              )}
                              {validationResult.suggestions.breakdowns && (
                                <li>Try simpler breakdowns like {validationResult.suggestions.breakdowns.join(', ')}</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cadence */}
            <FormField
              control={form.control}
              name="cadence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cadence</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a cadence" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CADENCES.map((cadence) => (
                        <SelectItem key={cadence.value} value={cadence.value}>
                          {cadence.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Delivery */}
            <FormField
              control={form.control}
              name="delivery"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select delivery method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="link">Public Link</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email (conditional) */}
            {form.watch('delivery') === 'email' && (
              <>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* PDF Attachment */}
                <FormField
                  control={form.control}
                  name="pdfAttachment"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Include PDF Attachment</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Attach a PDF version of the report to the email
                          </p>
                        </div>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Token Settings */}
            <TokenSettings
              settings={tokenSettings}
              onChange={(newSettings) => {
                setTokenSettings(newSettings);
                form.setValue('tokenSettings', newSettings);
              }}
              className="mt-6"
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Setting up...' : 'Save & Start Report'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}