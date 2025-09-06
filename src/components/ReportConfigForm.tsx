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

  const handlePlatformChange = (platform: 'meta' | 'tiktok') => {
    setSelectedPlatform(platform);
    setSelectedMetrics([]);
    setSelectedBreakdowns([]);
    setSelectedDimensions([]);
    form.setValue('platform', platform);
    form.setValue('metrics', []);
    form.setValue('level', '');
    form.setValue('breakdowns', []);
    form.setValue('dimensions', []);
  };

  const handleMetricToggle = (metric: string) => {
    const newMetrics = selectedMetrics.includes(metric)
      ? selectedMetrics.filter(m => m !== metric)
      : [...selectedMetrics, metric];
    setSelectedMetrics(newMetrics);
    form.setValue('metrics', newMetrics);
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

            {/* Level */}
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
            {selectedPlatform === 'meta' && (
              <div className="space-y-2">
                <Label>Breakdowns (optional)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                  {META_BREAKDOWNS.map((breakdown) => (
                    <div key={breakdown} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`breakdown-${breakdown}`}
                        checked={selectedBreakdowns.includes(breakdown)}
                        onChange={() => handleBreakdownToggle(breakdown)}
                        className="rounded"
                      />
                      <label htmlFor={`breakdown-${breakdown}`} className="text-sm">
                        {breakdown.replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPlatform === 'tiktok' && (
              <div className="space-y-2">
                <Label>Dimensions (optional)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                  {TIKTOK_DIMENSIONS.map((dimension) => (
                    <div key={dimension} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`dimension-${dimension}`}
                        checked={selectedDimensions.includes(dimension)}
                        onChange={() => handleDimensionToggle(dimension)}
                        className="rounded"
                      />
                      <label htmlFor={`dimension-${dimension}`} className="text-sm">
                        {dimension.replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <FormField
              control={form.control}
              name="dateRangeEnum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Range</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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