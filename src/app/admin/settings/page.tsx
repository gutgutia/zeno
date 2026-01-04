'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface PlanPricing {
  monthly_cents: number;
  annual_cents: number;
}

interface PlanCredits {
  credits_per_month: number;
  is_one_time: boolean;
}

interface GlobalSettings {
  plan_pricing: {
    free: PlanPricing;
    starter: PlanPricing;
    pro: PlanPricing;
    enterprise: PlanPricing;
  };
  plan_credits: {
    free: PlanCredits;
    starter: PlanCredits;
    pro: PlanCredits;
    enterprise: PlanCredits;
  };
  signup_bonus_credits: {
    amount: number;
  };
  feature_flags: {
    maintenance_mode: boolean;
    new_signups_enabled: boolean;
    google_sheets_enabled: boolean;
  };
}

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSetting(key: string, value: unknown) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) throw new Error('Failed to save setting');
      toast.success('Setting saved');
      fetchSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Global Settings</h1>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Global Settings</h1>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
          <p className="text-[var(--color-gray-500)]">Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Global Settings</h1>

      {/* Plan Pricing */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Plan Pricing</h2>
        <p className="text-sm text-[var(--color-gray-500)] mb-4">
          Set monthly and annual pricing for each plan (in cents)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['free', 'starter', 'pro', 'enterprise'] as const).map((plan) => (
            <div key={plan} className="border border-[var(--color-gray-200)] rounded-lg p-4">
              <h3 className="font-medium text-[var(--color-gray-900)] capitalize mb-3">{plan}</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Monthly (cents)</Label>
                  <Input
                    type="number"
                    value={settings.plan_pricing[plan].monthly_cents}
                    onChange={(e) => {
                      const newPricing = {
                        ...settings.plan_pricing,
                        [plan]: {
                          ...settings.plan_pricing[plan],
                          monthly_cents: parseInt(e.target.value) || 0,
                        },
                      };
                      setSettings({ ...settings, plan_pricing: newPricing });
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Annual (cents)</Label>
                  <Input
                    type="number"
                    value={settings.plan_pricing[plan].annual_cents}
                    onChange={(e) => {
                      const newPricing = {
                        ...settings.plan_pricing,
                        [plan]: {
                          ...settings.plan_pricing[plan],
                          annual_cents: parseInt(e.target.value) || 0,
                        },
                      };
                      setSettings({ ...settings, plan_pricing: newPricing });
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => saveSetting('plan_pricing', settings.plan_pricing)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </div>
      </div>

      {/* Plan Credits */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Plan Credits</h2>
        <p className="text-sm text-[var(--color-gray-500)] mb-4">
          Set monthly credit allocation for each plan
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['free', 'starter', 'pro', 'enterprise'] as const).map((plan) => (
            <div key={plan} className="border border-[var(--color-gray-200)] rounded-lg p-4">
              <h3 className="font-medium text-[var(--color-gray-900)] capitalize mb-3">{plan}</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Credits per month</Label>
                  <Input
                    type="number"
                    value={settings.plan_credits[plan].credits_per_month}
                    onChange={(e) => {
                      const newCredits = {
                        ...settings.plan_credits,
                        [plan]: {
                          ...settings.plan_credits[plan],
                          credits_per_month: parseInt(e.target.value) || 0,
                        },
                      };
                      setSettings({ ...settings, plan_credits: newCredits });
                    }}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${plan}-one-time`}
                    checked={settings.plan_credits[plan].is_one_time}
                    onChange={(e) => {
                      const newCredits = {
                        ...settings.plan_credits,
                        [plan]: {
                          ...settings.plan_credits[plan],
                          is_one_time: e.target.checked,
                        },
                      };
                      setSettings({ ...settings, plan_credits: newCredits });
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`${plan}-one-time`} className="text-xs">
                    One-time only
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => saveSetting('plan_credits', settings.plan_credits)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Credits'}
          </Button>
        </div>
      </div>

      {/* Signup Bonus */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Signup Bonus</h2>
        <p className="text-sm text-[var(--color-gray-500)] mb-4">
          Credits given to new users when they sign up
        </p>
        <div className="max-w-xs">
          <Label>Bonus Credits</Label>
          <Input
            type="number"
            value={settings.signup_bonus_credits.amount}
            onChange={(e) => {
              setSettings({
                ...settings,
                signup_bonus_credits: {
                  amount: parseInt(e.target.value) || 0,
                },
              });
            }}
            className="mt-1"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => saveSetting('signup_bonus_credits', settings.signup_bonus_credits)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Bonus'}
          </Button>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Feature Flags</h2>
        <p className="text-sm text-[var(--color-gray-500)] mb-4">
          Global feature toggles
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--color-gray-50)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--color-gray-900)]">Maintenance Mode</p>
              <p className="text-sm text-[var(--color-gray-500)]">Disable access for non-admin users</p>
            </div>
            <input
              type="checkbox"
              checked={settings.feature_flags.maintenance_mode}
              onChange={(e) => {
                const newFlags = {
                  ...settings.feature_flags,
                  maintenance_mode: e.target.checked,
                };
                setSettings({ ...settings, feature_flags: newFlags });
                saveSetting('feature_flags', newFlags);
              }}
              className="rounded border-gray-300 h-5 w-5"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--color-gray-50)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--color-gray-900)]">New Signups Enabled</p>
              <p className="text-sm text-[var(--color-gray-500)]">Allow new user registrations</p>
            </div>
            <input
              type="checkbox"
              checked={settings.feature_flags.new_signups_enabled}
              onChange={(e) => {
                const newFlags = {
                  ...settings.feature_flags,
                  new_signups_enabled: e.target.checked,
                };
                setSettings({ ...settings, feature_flags: newFlags });
                saveSetting('feature_flags', newFlags);
              }}
              className="rounded border-gray-300 h-5 w-5"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--color-gray-50)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--color-gray-900)]">Google Sheets Integration</p>
              <p className="text-sm text-[var(--color-gray-500)]">Enable Google Sheets data source</p>
            </div>
            <input
              type="checkbox"
              checked={settings.feature_flags.google_sheets_enabled}
              onChange={(e) => {
                const newFlags = {
                  ...settings.feature_flags,
                  google_sheets_enabled: e.target.checked,
                };
                setSettings({ ...settings, feature_flags: newFlags });
                saveSetting('feature_flags', newFlags);
              }}
              className="rounded border-gray-300 h-5 w-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
