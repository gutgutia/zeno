'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Workspace, BrandingConfig } from '@/types/database';

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'inter', label: 'Inter' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'space-grotesk', label: 'Space Grotesk' },
] as const;

const DEFAULT_CHART_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

interface ExtractedBranding extends BrandingConfig {
  chartColors?: string[];
}

export default function BrandingSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Brand extraction state
  const [extractUrl, setExtractUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedBranding, setExtractedBranding] = useState<ExtractedBranding | null>(null);

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [accentColor, setAccentColor] = useState('#22c55e');
  const [backgroundColor, setBackgroundColor] = useState('#f8fafc');
  const [chartColors, setChartColors] = useState<string[]>(DEFAULT_CHART_COLORS);
  const [fontFamily, setFontFamily] = useState<BrandingConfig['fontFamily']>('system');
  const [styleGuide, setStyleGuide] = useState('');

  // Fetch workspace data
  useEffect(() => {
    async function fetchWorkspace() {
      try {
        const response = await fetch('/api/workspaces');
        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }
        const data = await response.json();
        const workspaces = data.workspaces as Workspace[];

        // Get the first personal workspace
        const personalWorkspace = workspaces.find((w) => w.type === 'personal');
        if (personalWorkspace) {
          setWorkspace(personalWorkspace);
          // Populate form with existing branding
          const branding = personalWorkspace.branding;
          if (branding) {
            setCompanyName(branding.companyName || '');
            setLogoUrl(branding.logoUrl || '');
            setPrimaryColor(branding.colors?.primary || '#6366f1');
            setSecondaryColor(branding.colors?.secondary || '#64748b');
            setAccentColor(branding.colors?.accent || '#22c55e');
            setBackgroundColor(branding.colors?.background || '#f8fafc');
            setChartColors(branding.chartColors || DEFAULT_CHART_COLORS);
            setFontFamily(branding.fontFamily || 'system');
            setStyleGuide(branding.styleGuide || '');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkspace();
  }, []);

  const handleExtractBrand = async () => {
    if (!extractUrl.trim()) {
      setExtractError('Please enter a website URL');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractedBranding(null);

    try {
      const response = await fetch('/api/branding/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extractUrl }),
      });

      const data = await response.json();

      if (!data.success) {
        setExtractError(data.error || 'Failed to extract brand');
        return;
      }

      setExtractedBranding(data.branding);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract brand');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyExtracted = () => {
    if (!extractedBranding) return;

    if (extractedBranding.companyName) setCompanyName(extractedBranding.companyName);
    // Note: We intentionally don't apply logoUrl from extraction
    // Users should upload their logo directly for reliability
    if (extractedBranding.colors?.primary) setPrimaryColor(extractedBranding.colors.primary);
    if (extractedBranding.colors?.secondary) setSecondaryColor(extractedBranding.colors.secondary);
    if (extractedBranding.colors?.accent) setAccentColor(extractedBranding.colors.accent);
    if (extractedBranding.colors?.background) setBackgroundColor(extractedBranding.colors.background);
    if (extractedBranding.chartColors) setChartColors(extractedBranding.chartColors);
    if (extractedBranding.fontFamily) setFontFamily(extractedBranding.fontFamily);
    if (extractedBranding.styleGuide) setStyleGuide(extractedBranding.styleGuide);

    // Clear extracted preview
    setExtractedBranding(null);
    setExtractUrl('');
  };

  const handleSave = async () => {
    if (!workspace) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const branding: BrandingConfig = {
        companyName: companyName || undefined,
        logoUrl: logoUrl || undefined,
        colors: {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
          background: backgroundColor,
        },
        chartColors,
        fontFamily,
        styleGuide: styleGuide || undefined,
      };

      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding }),
      });

      if (!response.ok) {
        throw new Error('Failed to save branding settings');
      }

      const data = await response.json();
      setWorkspace(data.workspace);
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChartColorChange = (index: number, color: string) => {
    const newColors = [...chartColors];
    newColors[index] = color;
    setChartColors(newColors);
  };

  const addChartColor = () => {
    if (chartColors.length < 12) {
      setChartColors([...chartColors, '#6366f1']);
    }
  };

  const removeChartColor = (index: number) => {
    if (chartColors.length > 2) {
      setChartColors(chartColors.filter((_, i) => i !== index));
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setLogoError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/branding/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      setLogoUrl(data.logoUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      // Reset the input so the same file can be selected again
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    setLogoError(null);

    try {
      const response = await fetch('/api/branding/logo', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove logo');
      }

      setLogoUrl('');
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-gray-500)]">No workspace found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Branding Settings
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Customize how your dashboards look and feel
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Settings saved successfully!
        </div>
      )}

      {/* Extract from Website */}
      <Card className="border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-Extract Brand
          </CardTitle>
          <CardDescription>
            Enter your company website and we&apos;ll automatically extract your brand colors, fonts, and style
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={extractUrl}
              onChange={(e) => setExtractUrl(e.target.value)}
              placeholder="stripe.com or https://stripe.com"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleExtractBrand()}
            />
            <Button
              onClick={handleExtractBrand}
              disabled={isExtracting || !extractUrl.trim()}
            >
              {isExtracting ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                'Extract Brand'
              )}
            </Button>
          </div>

          {extractError && (
            <p className="text-sm text-red-600">{extractError}</p>
          )}

          {/* Extracted Preview */}
          {extractedBranding && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-[var(--color-gray-200)]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-[var(--color-gray-900)]">Extracted Brand</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExtractedBranding(null)}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={handleApplyExtracted}>
                    Apply to Form
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {extractedBranding.companyName && (
                  <div>
                    <p className="text-xs text-[var(--color-gray-500)] mb-1">Company</p>
                    <p className="text-sm font-medium">{extractedBranding.companyName}</p>
                  </div>
                )}
                {extractedBranding.fontFamily && (
                  <div>
                    <p className="text-xs text-[var(--color-gray-500)] mb-1">Font</p>
                    <p className="text-sm font-medium capitalize">{extractedBranding.fontFamily}</p>
                  </div>
                )}
              </div>

              {/* Color Preview */}
              <div className="mb-4">
                <p className="text-xs text-[var(--color-gray-500)] mb-2">Brand Colors</p>
                <div className="flex gap-2">
                  {extractedBranding.colors?.primary && (
                    <div className="text-center">
                      <div
                        className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)]"
                        style={{ backgroundColor: extractedBranding.colors.primary }}
                      />
                      <p className="text-xs text-[var(--color-gray-500)] mt-1">Primary</p>
                    </div>
                  )}
                  {extractedBranding.colors?.secondary && (
                    <div className="text-center">
                      <div
                        className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)]"
                        style={{ backgroundColor: extractedBranding.colors.secondary }}
                      />
                      <p className="text-xs text-[var(--color-gray-500)] mt-1">Secondary</p>
                    </div>
                  )}
                  {extractedBranding.colors?.accent && (
                    <div className="text-center">
                      <div
                        className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)]"
                        style={{ backgroundColor: extractedBranding.colors.accent }}
                      />
                      <p className="text-xs text-[var(--color-gray-500)] mt-1">Accent</p>
                    </div>
                  )}
                  {extractedBranding.colors?.background && (
                    <div className="text-center">
                      <div
                        className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)]"
                        style={{ backgroundColor: extractedBranding.colors.background }}
                      />
                      <p className="text-xs text-[var(--color-gray-500)] mt-1">Background</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart Colors Preview */}
              {extractedBranding.chartColors && extractedBranding.chartColors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--color-gray-500)] mb-2">Chart Palette</p>
                  <div className="flex gap-1">
                    {extractedBranding.chartColors.map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded border border-[var(--color-gray-200)]"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Style Guide Preview */}
              {extractedBranding.styleGuide && (
                <div>
                  <p className="text-xs text-[var(--color-gray-500)] mb-1">Style Guide</p>
                  <p className="text-sm text-[var(--color-gray-700)] italic">
                    &ldquo;{extractedBranding.styleGuide}&rdquo;
                  </p>
                </div>
              )}

              {/* Logo Note */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> Logo should be uploaded separately for reliability.
                  Use the &quot;Upload Logo&quot; button in the Company Identity section below.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Company Identity</CardTitle>
          <CardDescription>
            Your company name and logo will appear on published dashboards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-4">
              {/* Logo Preview */}
              <div className="w-32 h-20 border-2 border-dashed border-[var(--color-gray-200)] rounded-lg flex items-center justify-center bg-[var(--color-gray-50)] overflow-hidden">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Company logo"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).alt = 'Failed to load';
                    }}
                  />
                ) : (
                  <div className="text-center text-[var(--color-gray-400)]">
                    <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload Logo
                      </>
                    )}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-[var(--color-gray-500)]">
                  PNG, JPG, GIF, WebP, or SVG. Max 2MB. Recommended: 200x50px
                </p>
                {logoError && (
                  <p className="text-xs text-red-600">{logoError}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>
            Define your color palette for UI elements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--color-gray-200)] cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="secondaryColor"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--color-gray-200)] cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accentColor"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--color-gray-200)] cursor-pointer"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="backgroundColor"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--color-gray-200)] cursor-pointer"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Chart Colors</CardTitle>
          <CardDescription>
            Color palette for chart series and data visualizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {chartColors.map((color, index) => (
                <div key={index} className="flex items-center gap-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleChartColorChange(index, e.target.value)}
                    className="w-10 h-10 rounded border border-[var(--color-gray-200)] cursor-pointer"
                    title={`Chart color ${index + 1}`}
                  />
                  {chartColors.length > 2 && (
                    <button
                      onClick={() => removeChartColor(index)}
                      className="w-6 h-6 flex items-center justify-center text-[var(--color-gray-400)] hover:text-[var(--color-error)] transition-colors"
                      title="Remove color"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {chartColors.length < 12 && (
              <Button variant="outline" size="sm" onClick={addChartColor}>
                + Add Color
              </Button>
            )}
            <p className="text-xs text-[var(--color-gray-500)]">
              These colors will be used in charts and graphs. Aim for 4-8 distinct colors.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>
            Choose a font family for your dashboards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="fontFamily">Font Family</Label>
            <select
              id="fontFamily"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as BrandingConfig['fontFamily'])}
              className="w-full md:w-64 px-3 py-2 border border-[var(--color-gray-200)] rounded-lg bg-white text-[var(--color-gray-900)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            >
              {FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Style Guide */}
      <Card>
        <CardHeader>
          <CardTitle>AI Style Guide</CardTitle>
          <CardDescription>
            Provide free-form guidance for the AI when generating dashboards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="styleGuide">Style Instructions</Label>
            <Textarea
              id="styleGuide"
              value={styleGuide}
              onChange={(e) => setStyleGuide(e.target.value)}
              placeholder="E.g., Use professional, corporate language. Prefer clean, minimalist chart designs. Highlight key metrics prominently. Use percentage formats for growth indicators..."
              rows={4}
            />
            <p className="text-xs text-[var(--color-gray-500)]">
              This text will be passed to the AI when generating chart titles, descriptions, and configurations.
              Be specific about your preferences for chart styles, language tone, and data presentation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
