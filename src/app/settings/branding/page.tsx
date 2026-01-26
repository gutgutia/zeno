'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { usePlan } from '@/lib/hooks';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { toast } from 'sonner';
import type { BrandingConfig, OrganizationWithRole, CustomDomainStatus } from '@/types/database';

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

interface DomainConfig {
  custom_domain: string | null;
  custom_domain_status: CustomDomainStatus | null;
  custom_domain_verified_at: string | null;
  custom_domain_error: string | null;
  subdomain: string | null;
  cname_target: string;
}

export default function BrandingSettingsPage() {
  const { features, isLoading: isPlanLoading } = usePlan();
  const canCustomizeBranding = features.custom_branding;

  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
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

  // Form state - Company Identity
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Form state - Dashboard styling
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [accentColor, setAccentColor] = useState('#22c55e');
  const [backgroundColor, setBackgroundColor] = useState('#f8fafc');
  const [chartColors, setChartColors] = useState<string[]>(DEFAULT_CHART_COLORS);
  const [fontFamily, setFontFamily] = useState<BrandingConfig['fontFamily']>('system');
  const [styleGuide, setStyleGuide] = useState('');

  // White-label settings (shell/chrome, separate from dashboard branding)
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');

  // AI Generation settings
  const [applyBrandingToDashboards, setApplyBrandingToDashboards] = useState(true);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Custom domain state
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Fetch organization data
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch('/api/organizations');
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        const data = await response.json();
        const orgs = data.organizations || [];

        // Get the user's owned organization (primary org)
        const ownedOrg = orgs.find((org: OrganizationWithRole) => org.role === 'owner');
        const selectedOrg = ownedOrg || orgs[0];

        if (selectedOrg) {
          setOrganization(selectedOrg);
          // Populate form with existing branding
          const branding = selectedOrg.branding as BrandingConfig | null;
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
          // Populate white-label settings
          setWhiteLabelEnabled(selectedOrg.white_label_enabled || false);
          setFaviconUrl(selectedOrg.favicon_url || '');
          setEmailSenderName(selectedOrg.email_sender_name || '');
          // Populate AI generation settings (default to true if not set)
          setApplyBrandingToDashboards(selectedOrg.apply_branding_to_dashboards ?? true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganization();
  }, []);

  // Fetch domain config when organization is loaded
  const fetchDomainConfig = useCallback(async () => {
    if (!organization?.id) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/domain`);
      if (response.ok) {
        const data = await response.json();
        setDomainConfig(data);
        setNewDomain(data.custom_domain || '');
      }
    } catch (error) {
      console.error('Failed to fetch domain config:', error);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchDomainConfig();
  }, [fetchDomainConfig]);

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
    if (!organization) return;

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

      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding,
          // White-label settings
          white_label_enabled: whiteLabelEnabled,
          favicon_url: faviconUrl || null,
          email_sender_name: emailSenderName || null,
          // AI Generation settings
          apply_branding_to_dashboards: applyBrandingToDashboards,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save branding settings');
      }

      const updatedOrg = await response.json();
      setOrganization({ ...organization, ...updatedOrg });
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

  const handleFaviconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFavicon(true);
    setFaviconError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'favicon');

      const response = await fetch('/api/branding/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload favicon');
      }

      setFaviconUrl(data.logoUrl);
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Failed to upload favicon');
    } finally {
      setIsUploadingFavicon(false);
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFavicon = () => {
    setFaviconUrl('');
  };

  // Domain handlers
  const handleSaveDomain = async () => {
    if (!organization?.id || !newDomain.trim()) return;

    setIsSavingDomain(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to save domain');
        return;
      }

      toast.success('Domain saved! Configure your DNS and click Verify.');
      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to save domain:', error);
      toast.error('Failed to save domain');
    } finally {
      setIsSavingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!organization?.id) return;

    setIsVerifying(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/domain`, {
        method: 'PUT',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Verification failed');
        await fetchDomainConfig();
        return;
      }

      if (data.status === 'verified') {
        toast.success('Domain verified and active!');
      } else if (data.status === 'verifying') {
        toast.info('SSL certificate is being provisioned. This may take a few minutes.');
      }

      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to verify domain:', error);
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!organization?.id) return;

    if (!confirm('Are you sure you want to remove this custom domain?')) {
      return;
    }

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/domain`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove domain');
        return;
      }

      toast.success('Domain removed');
      setNewDomain('');
      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to remove domain:', error);
      toast.error('Failed to remove domain');
    } finally {
      setIsRemoving(false);
    }
  };

  const getStatusBadge = (status: CustomDomainStatus | null) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Verified
          </span>
        );
      case 'verifying':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Verifying...
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending DNS
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading || isPlanLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-gray-500)]">No organization found.</p>
      </div>
    );
  }

  // Show upgrade prompt if user doesn't have branding feature
  if (!canCustomizeBranding) {
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

        <UpgradePrompt
          title="Custom Branding"
          description="Upload your logo, set brand colors, choose fonts, and create a consistent visual identity for your dashboards. Make every dashboard look like it came from your company."
          requiredPlan="pro"
        />

        {/* Preview of what branding looks like */}
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
          <h3 className="text-sm font-medium text-[var(--color-gray-500)] mb-4">What you&apos;ll get with Pro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--color-gray-900)]">Company Logo</p>
                <p className="text-sm text-[var(--color-gray-500)]">Display your logo on all dashboards</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--color-gray-900)]">Brand Colors</p>
                <p className="text-sm text-[var(--color-gray-500)]">Custom color palette for charts and UI</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--color-gray-900)]">Custom Fonts</p>
                <p className="text-sm text-[var(--color-gray-500)]">Choose your preferred typography</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--color-gray-900)]">AI Brand Extraction</p>
                <p className="text-sm text-[var(--color-gray-500)]">Auto-extract colors from your website</p>
              </div>
            </div>
          </div>
        </div>
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

      {/* ============================================ */}
      {/* SECTION 1: Company Identity */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/* SECTION 2: Dashboard Styling */}
      {/* ============================================ */}
      <div className="space-y-6">
        <div className="border-b border-[var(--color-gray-200)] pb-2">
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">Dashboard Styling</h2>
          <p className="text-sm text-[var(--color-gray-500)]">Customize the visual appearance of your dashboard content</p>
        </div>

        {/* Apply Branding Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--color-gray-900)]">Apply Branding to Dashboards</p>
                <p className="text-sm text-[var(--color-gray-500)]">
                  When enabled, the AI will use your brand colors, fonts, and style guide when generating new dashboards.
                  Turn off to let the AI choose its own styling.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={applyBrandingToDashboards}
                onClick={() => setApplyBrandingToDashboards(!applyBrandingToDashboards)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  applyBrandingToDashboards ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-300)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    applyBrandingToDashboards ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

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
                    Use the &quot;Upload Logo&quot; button in the Company Identity section above.
                  </p>
                </div>
              </div>
            )}
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
      </div>

      {/* ============================================ */}
      {/* SECTION 3: White Label */}
      {/* ============================================ */}
      <Card className="border-2 border-[var(--color-gray-300)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-gray-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            White Label
          </CardTitle>
          <CardDescription>
            Remove Zeno branding from shared dashboards and customize the viewer experience.
            This affects the page shell (footer, page titles, emails) - not the dashboard content itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-gray-50)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--color-gray-900)]">Enable White Label</p>
              <p className="text-sm text-[var(--color-gray-500)]">
                Remove &quot;Powered by Zeno&quot; and use your own branding
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={whiteLabelEnabled}
              onClick={() => setWhiteLabelEnabled(!whiteLabelEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                whiteLabelEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-300)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  whiteLabelEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* White Label Options (shown when enabled) */}
          {whiteLabelEnabled && (
            <div className="space-y-6 pt-2">
              {/* Favicon */}
              <div className="space-y-2">
                <Label>Custom Favicon</Label>
                <p className="text-xs text-[var(--color-gray-500)] mb-2">
                  Displayed in browser tabs when viewers access shared dashboards
                </p>
                <div className="flex items-center gap-4">
                  {/* Favicon Preview */}
                  <div className="w-12 h-12 border-2 border-dashed border-[var(--color-gray-200)] rounded-lg flex items-center justify-center bg-[var(--color-gray-50)] overflow-hidden">
                    {faviconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={faviconUrl}
                        alt="Favicon"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <svg className="w-6 h-6 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/png,image/x-icon,image/svg+xml"
                      onChange={handleFaviconUpload}
                      className="hidden"
                      id="favicon-upload"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={isUploadingFavicon}
                      >
                        {isUploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                      </Button>
                      {faviconUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveFavicon}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-gray-500)] mt-1">
                      PNG, ICO, or SVG. Recommended: 32x32px
                    </p>
                    {faviconError && (
                      <p className="text-xs text-red-600 mt-1">{faviconError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Sender Name */}
              <div className="space-y-2">
                <Label htmlFor="emailSenderName">Email Sender Name</Label>
                <p className="text-xs text-[var(--color-gray-500)] mb-2">
                  Used as the &quot;From&quot; name in authentication emails sent to dashboard viewers
                </p>
                <Input
                  id="emailSenderName"
                  value={emailSenderName}
                  onChange={(e) => setEmailSenderName(e.target.value)}
                  placeholder={companyName || 'Your Company Name'}
                  className="max-w-md"
                />
              </div>

              {/* Custom Domain Section */}
              <div className="pt-4 border-t border-[var(--color-gray-200)]">
                <div className="mb-4">
                  <Label className="text-base font-medium">Custom Domain</Label>
                  <p className="text-xs text-[var(--color-gray-500)] mt-1">
                    Use your own domain for sharing dashboards (e.g., dashboards.yourcompany.com)
                  </p>
                </div>

                {/* Current Domain Status */}
                {domainConfig?.custom_domain && (
                  <div className="mb-4 p-4 bg-[var(--color-gray-50)] rounded-lg border border-[var(--color-gray-200)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-gray-700)]">Current Domain</span>
                      {getStatusBadge(domainConfig.custom_domain_status)}
                    </div>
                    <p className="text-lg font-mono text-[var(--color-gray-900)]">{domainConfig.custom_domain}</p>

                    {domainConfig.custom_domain_verified_at && (
                      <p className="text-xs text-[var(--color-gray-500)] mt-2">
                        Verified on {new Date(domainConfig.custom_domain_verified_at).toLocaleDateString()}
                      </p>
                    )}

                    {domainConfig.custom_domain_error && domainConfig.custom_domain_status !== 'verified' && (
                      <p className="text-sm text-red-600 mt-2">{domainConfig.custom_domain_error}</p>
                    )}
                  </div>
                )}

                {/* Domain Input */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="dashboards.yourcompany.com"
                      className="mt-1 max-w-md"
                    />
                  </div>

                  {/* DNS Instructions */}
                  {domainConfig?.custom_domain && domainConfig?.custom_domain_status !== 'verified' && (() => {
                    const domain = domainConfig.custom_domain;
                    const parts = domain.split('.');
                    const isRootDomain = parts.length === 2 || (parts.length === 3 && ['co', 'com', 'org', 'net'].includes(parts[1]));
                    const subdomain = isRootDomain ? '@' : parts.slice(0, -2).join('.');

                    return (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                        <h3 className="text-sm font-medium text-blue-900">DNS Configuration Required</h3>

                        {isRootDomain ? (
                          <>
                            <div className="text-sm text-blue-700">
                              <p className="mb-2">
                                <strong>Root domains</strong> (like {domain}) require special setup because most DNS providers
                                don&apos;t support CNAME records on the root/apex domain.
                              </p>
                            </div>

                            <div className="bg-white p-3 rounded border border-blue-200">
                              <p className="text-sm font-medium text-blue-900 mb-2">Option 1: A Records (works with all providers)</p>
                              <div className="font-mono text-sm space-y-1">
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                  <span className="text-[var(--color-gray-500)]">Type:</span>
                                  <span>A</span>
                                  <span className="text-[var(--color-gray-500)]">Name:</span>
                                  <span>@ <span className="text-[var(--color-gray-400)]">(or leave blank)</span></span>
                                  <span className="text-[var(--color-gray-500)]">Value:</span>
                                  <span>76.76.21.21</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded border border-blue-200">
                              <p className="text-sm font-medium text-blue-900 mb-2">Option 2: CNAME Flattening (Cloudflare, Route53, etc.)</p>
                              <p className="text-xs text-[var(--color-gray-600)] mb-2">
                                If your DNS provider supports CNAME flattening or ALIAS records:
                              </p>
                              <div className="font-mono text-sm space-y-1">
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                  <span className="text-[var(--color-gray-500)]">Type:</span>
                                  <span>CNAME <span className="text-[var(--color-gray-400)]">(or ALIAS)</span></span>
                                  <span className="text-[var(--color-gray-500)]">Name:</span>
                                  <span>@</span>
                                  <span className="text-[var(--color-gray-500)]">Value:</span>
                                  <span className="break-all">{domainConfig.cname_target}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded border border-blue-200">
                              <p className="text-sm font-medium text-blue-900 mb-2">Also add for www (recommended)</p>
                              <div className="font-mono text-sm space-y-1">
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                  <span className="text-[var(--color-gray-500)]">Type:</span>
                                  <span>CNAME</span>
                                  <span className="text-[var(--color-gray-500)]">Name:</span>
                                  <span>www</span>
                                  <span className="text-[var(--color-gray-500)]">Value:</span>
                                  <span className="break-all">{domainConfig.cname_target}</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-blue-700">
                              Add the following CNAME record to your DNS settings:
                            </p>
                            <div className="bg-white p-3 rounded border border-blue-200 font-mono text-sm">
                              <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-[var(--color-gray-500)]">Type:</span>
                                <span>CNAME</span>
                                <span className="text-[var(--color-gray-500)]">Name:</span>
                                <span>{subdomain}</span>
                                <span className="text-[var(--color-gray-500)]">Value:</span>
                                <span className="break-all">{domainConfig.cname_target}</span>
                              </div>
                            </div>
                          </>
                        )}

                        <p className="text-xs text-blue-600">
                          DNS changes can take up to 48 hours to propagate, but usually complete within a few minutes.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Domain Actions */}
                  <div className="flex gap-3">
                    {!domainConfig?.custom_domain || newDomain !== domainConfig.custom_domain ? (
                      <Button
                        onClick={handleSaveDomain}
                        disabled={isSavingDomain || !newDomain.trim()}
                        variant="outline"
                      >
                        {isSavingDomain ? 'Saving...' : 'Save Domain'}
                      </Button>
                    ) : (
                      <>
                        {domainConfig.custom_domain_status !== 'verified' && (
                          <Button onClick={handleVerifyDomain} disabled={isVerifying} variant="outline">
                            {isVerifying ? 'Verifying...' : 'Verify Domain'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleRemoveDomain}
                          disabled={isRemoving}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          {isRemoving ? 'Removing...' : 'Remove Domain'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>What changes with white label enabled:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>&quot;Powered by Zeno&quot; footer is removed from dashboard pages</li>
                  <li>Page titles use your company name instead of Zeno</li>
                  <li>Your favicon appears in browser tabs</li>
                  <li>Authentication emails use your sender name</li>
                  <li>Custom domain for dashboard URLs (if configured)</li>
                </ul>
              </div>
            </div>
          )}
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
