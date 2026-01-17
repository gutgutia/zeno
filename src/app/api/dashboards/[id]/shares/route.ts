import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { DashboardShare, ShareViewerType, Organization, BrandingConfig, CustomDomainStatus } from '@/types/database';
import { resend, FROM_EMAIL } from '@/lib/email/resend';
import { ShareNotificationEmail } from '@/lib/email/templates/share-notification-email';

// Helper to build the dashboard URL based on organization settings
// Only uses custom domain/subdomain when white labeling is enabled
function buildDashboardUrl(
  slug: string,
  org: Pick<Organization, 'subdomain' | 'custom_domain' | 'custom_domain_status' | 'white_label_enabled'> | null
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeno.fyi';

  // Only use custom domain/subdomain if white labeling is enabled
  if (!org?.white_label_enabled) {
    return `${baseUrl}/d/${slug}`;
  }

  // If org has a verified custom domain, use it
  if (org.custom_domain && org.custom_domain_status === 'verified') {
    return `https://${org.custom_domain}/d/${slug}`;
  }

  // If org has a subdomain, use it
  if (org.subdomain) {
    // Extract the base domain from NEXT_PUBLIC_APP_URL or default to zeno.fyi
    const baseDomain = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${org.subdomain}.${baseDomain}/d/${slug}`;
  }

  // Fallback to default app URL
  return `${baseUrl}/d/${slug}`;
}

// Determine viewer type based on domain matching
function detectViewerType(ownerEmail: string, shareValue: string, shareType: 'email' | 'domain'): ShareViewerType {
  const ownerDomain = ownerEmail.toLowerCase().split('@')[1];

  if (shareType === 'domain') {
    // Domain share - compare domains directly
    return shareValue.toLowerCase() === ownerDomain ? 'internal' : 'external';
  } else {
    // Email share - extract domain from email
    const shareDomain = shareValue.toLowerCase().split('@')[1];
    return shareDomain === ownerDomain ? 'internal' : 'external';
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id]/shares - List shares for a dashboard
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership via workspace
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('workspace_id, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as { workspace_id: string; workspaces: { owner_id: string } };
    if (dashboardData.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get shares
    const { data: shares, error } = await supabase
      .from('dashboard_shares')
      .select('*')
      .eq('dashboard_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Include owner's email domain for viewer type auto-detection in UI
    const ownerDomain = user.email ? user.email.toLowerCase().split('@')[1] : null;

    return NextResponse.json({
      shares: shares as DashboardShare[],
      ownerDomain, // Used by UI for auto-detecting viewer type
    });
  } catch (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dashboards/[id]/shares - Add a share
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { share_type, share_value, viewer_type: requestedViewerType } = body;

    // Validate input
    if (!share_type || !['domain', 'email'].includes(share_type)) {
      return NextResponse.json({ error: 'Invalid share_type' }, { status: 400 });
    }

    if (!share_value || typeof share_value !== 'string') {
      return NextResponse.json({ error: 'share_value is required' }, { status: 400 });
    }

    // Validate viewer_type if provided
    if (requestedViewerType && !['auto', 'internal', 'external'].includes(requestedViewerType)) {
      return NextResponse.json({ error: 'Invalid viewer_type' }, { status: 400 });
    }

    // Validate format
    const normalizedValue = share_value.toLowerCase().trim();

    if (share_type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    } else if (share_type === 'domain') {
      // Basic domain validation - should have at least one dot
      const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
      if (!domainRegex.test(normalizedValue)) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
      }
    }

    // Verify ownership and get dashboard details for email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dashboard, error: dashboardError } = await (supabase as any)
      .from('dashboards')
      .select('workspace_id, title, slug, owner_id, organization_id')
      .eq('id', id)
      .single();

    if (dashboardError) {
      console.error('[shares] Dashboard query error:', dashboardError);
    }

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as {
      workspace_id: string;
      title: string;
      slug: string;
      owner_id: string;
      organization_id: string | null;
    };

    // Check ownership
    if (dashboardData.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch organization white-label settings if dashboard belongs to an org
    let org: {
      branding: BrandingConfig | null;
      subdomain: string | null;
      custom_domain: string | null;
      custom_domain_status: CustomDomainStatus | null;
      white_label_enabled: boolean;
      email_sender_name: string | null;
    } | null = null;

    if (dashboardData.organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgData } = await (supabase as any)
        .from('organizations')
        .select('branding, subdomain, custom_domain, custom_domain_status, white_label_enabled, email_sender_name')
        .eq('id', dashboardData.organization_id)
        .single();

      org = orgData;
    }

    // Determine viewer_type
    // If 'auto' or not specified, detect based on domain matching
    let finalViewerType: ShareViewerType = requestedViewerType || 'auto';
    if (finalViewerType === 'auto') {
      finalViewerType = detectViewerType(user.email || '', normalizedValue, share_type);
    }

    // Create share
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: share, error } = await (supabase as any)
      .from('dashboard_shares')
      .insert({
        dashboard_id: id,
        share_type,
        share_value: normalizedValue,
        viewer_type: finalViewerType,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'This share already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send email notification for email shares (not domain shares)
    if (share_type === 'email') {
      try {
        // Get owner's profile name for the email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        const ownerName = profile?.name || user.email?.split('@')[0] || 'Someone';
        const dashboardUrl = buildDashboardUrl(dashboardData.slug, org);

        // Build white-label options if enabled
        const whiteLabel = org?.white_label_enabled ? {
          companyName: org.branding?.companyName,
          logoUrl: org.branding?.logoUrl,
          senderName: org.email_sender_name || undefined,
        } : undefined;

        // Determine the "from" name (use custom sender name if white-labeled)
        const fromName = whiteLabel?.senderName || 'Zeno';

        await resend.emails.send({
          from: `${fromName} <${FROM_EMAIL.split('<')[1]?.replace('>', '') || 'notifications@zeno.fyi'}>`,
          to: normalizedValue,
          subject: `${ownerName} shared "${dashboardData.title}" with you`,
          react: ShareNotificationEmail({
            dashboardTitle: dashboardData.title,
            dashboardUrl,
            sharedByName: ownerName,
            whiteLabel,
          }),
        });
      } catch (emailError) {
        // Log but don't fail the request if email fails
        console.error('Failed to send share notification email:', emailError);
      }
    }

    return NextResponse.json({ share: share as DashboardShare }, { status: 201 });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
