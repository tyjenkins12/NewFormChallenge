'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Clock, Key, Info } from 'lucide-react';

interface TokenSettingsProps {
  settings: {
    enabled: boolean;
    expirationHours?: number;
    allowRefresh?: boolean;
  };
  onChange: (settings: { enabled: boolean; expirationHours?: number; allowRefresh?: boolean }) => void;
  className?: string;
}

export default function TokenSettings({ settings, onChange, className }: TokenSettingsProps) {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...settings,
      enabled,
      // Set defaults when enabling
      expirationHours: enabled ? (settings.expirationHours || 168) : settings.expirationHours,
      allowRefresh: enabled ? (settings.allowRefresh ?? true) : settings.allowRefresh
    });
  };

  const handleExpirationChange = (hours: string) => {
    onChange({
      ...settings,
      expirationHours: parseInt(hours)
    });
  };

  const handleRefreshChange = (allowRefresh: boolean) => {
    onChange({
      ...settings,
      allowRefresh
    });
  };

  const expirationOptions = [
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '24', label: '24 hours' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
    { value: '720', label: '1 month' }
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security & Access Settings
        </CardTitle>
        <CardDescription>
          Configure secure access tokens for report links. When enabled, all report links will require authentication tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Token Security */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="token-enabled" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Enable Secure Access Tokens
            </Label>
            <p className="text-sm text-muted-foreground">
              Require authentication tokens to access report links
            </p>
          </div>
          <Switch
            id="token-enabled"
            checked={settings.enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        {/* Token Expiration */}
        {settings.enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="token-expiration" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Token Expiration Time
              </Label>
              <Select 
                value={settings.expirationHours?.toString() || '168'}
                onValueChange={handleExpirationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration time" />
                </SelectTrigger>
                <SelectContent>
                  {expirationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How long report links remain valid after generation
              </p>
            </div>

            {/* Allow Token Refresh */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="token-refresh">Allow Token Refresh</Label>
                <p className="text-sm text-muted-foreground">
                  Allow generating new tokens for expired reports
                </p>
              </div>
              <Switch
                id="token-refresh"
                checked={settings.allowRefresh ?? true}
                onCheckedChange={handleRefreshChange}
              />
            </div>

            {/* Security Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">
                    Security Benefits
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Report links are time-limited and expire automatically</li>
                    <li>• Each token is unique and tied to specific reports</li>
                    <li>• Unauthorized access attempts are blocked and logged</li>
                    <li>• Email recipients get secure, trackable access links</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Disabled State Info */}
        {!settings.enabled && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-gray-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  Public Access Mode
                </p>
                <p className="text-sm text-gray-700">
                  Report links will be publicly accessible without authentication. 
                  Anyone with the link can view reports.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}