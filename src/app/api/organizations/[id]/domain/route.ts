import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { Organization, CustomDomainStatus } from '@/types/database';
import {
  addDomainToVercel,
  removeDomainFromVercel,
  verifyDomainWithVercel,
  checkDnsConfiguration,
  getCnameTarget,
} from '@/lib/vercel/domains';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validate domain format
function isValidDomain(domain: string): boolean {
  // Basic domain validation
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

// Check if user is admin/owner of organization
async function checkOrgAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single() as { data: { role: string } | null };

  return data?.role === 'owner' || data?.role === 'admin';
}

/**
 * GET /api/organizations/[id]/domain
 * Get current domain configuration and status
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access
    const hasAccess = await checkOrgAccess(supabase, id, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get organization with domain info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error } = await (supabase as any)
      .from('organizations')
      .select('id, custom_domain, custom_domain_status, custom_domain_verified_at, custom_domain_error, subdomain')
      .eq('id', id)
      .single() as { data: Organization | null; error: unknown };

    if (error || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      custom_domain: org.custom_domain,
      custom_domain_status: org.custom_domain_status,
      custom_domain_verified_at: org.custom_domain_verified_at,
      custom_domain_error: org.custom_domain_error,
      subdomain: org.subdomain,
      cname_target: getCnameTarget(),
    });
  } catch (error) {
    console.error('Error fetching domain config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[id]/domain
 * Set or update custom domain (initiates verification)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access
    const hasAccess = await checkOrgAccess(supabase, id, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const normalizedDomain = domain.toLowerCase().trim();

    if (!isValidDomain(normalizedDomain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Check if domain is already used by another organization
    const { data: existingOrg } = await adminSupabase
      .from('organizations')
      .select('id')
      .eq('custom_domain', normalizedDomain)
      .neq('id', id)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: 'This domain is already in use by another organization' },
        { status: 409 }
      );
    }

    // Update organization with pending domain
    const { error: updateError } = await adminSupabase
      .from('organizations')
      .update({
        custom_domain: normalizedDomain,
        custom_domain_status: 'pending' as CustomDomainStatus,
        custom_domain_verified_at: null,
        custom_domain_error: null,
        vercel_domain_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 });
    }

    // Log the domain initiation
    await adminSupabase.from('domain_verification_log').insert({
      organization_id: id,
      domain: normalizedDomain,
      status: 'initiated',
    });

    return NextResponse.json({
      success: true,
      domain: normalizedDomain,
      status: 'pending',
      cname_target: getCnameTarget(),
      instructions: `Add a CNAME record pointing ${normalizedDomain} to ${getCnameTarget()}`,
    });
  } catch (error) {
    console.error('Error setting domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/organizations/[id]/domain
 * Verify domain (check DNS and add to Vercel)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access
    const hasAccess = await checkOrgAccess(supabase, id, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get organization
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('custom_domain, custom_domain_status')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.custom_domain) {
      return NextResponse.json({ error: 'No domain configured' }, { status: 400 });
    }

    const domain = org.custom_domain;

    // Update status to verifying
    await adminSupabase
      .from('organizations')
      .update({
        custom_domain_status: 'verifying' as CustomDomainStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log DNS check
    await adminSupabase.from('domain_verification_log').insert({
      organization_id: id,
      domain,
      status: 'dns_check',
    });

    // Step 1: Check DNS configuration
    const dnsResult = await checkDnsConfiguration(domain);

    if (!dnsResult.success) {
      await adminSupabase
        .from('organizations')
        .update({
          custom_domain_status: 'failed' as CustomDomainStatus,
          custom_domain_error: dnsResult.error || 'DNS lookup failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      await adminSupabase.from('domain_verification_log').insert({
        organization_id: id,
        domain,
        status: 'failed',
        error_message: dnsResult.error,
      });

      return NextResponse.json({
        success: false,
        error: 'DNS lookup failed',
        details: dnsResult.error,
      });
    }

    if (!dnsResult.configured) {
      await adminSupabase
        .from('organizations')
        .update({
          custom_domain_status: 'pending' as CustomDomainStatus,
          custom_domain_error: `CNAME not configured. Expected: ${getCnameTarget()}, Found: ${dnsResult.cnameValue || 'none'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return NextResponse.json({
        success: false,
        error: 'CNAME not configured correctly',
        expected: getCnameTarget(),
        found: dnsResult.cnameValue || null,
        instructions: `Add a CNAME record pointing ${domain} to ${getCnameTarget()}`,
      });
    }

    // Log Vercel add
    await adminSupabase.from('domain_verification_log').insert({
      organization_id: id,
      domain,
      status: 'vercel_add',
      dns_records: { cname: dnsResult.cnameValue },
    });

    // Step 2: Add domain to Vercel
    const vercelResult = await addDomainToVercel(domain);

    if (!vercelResult.success) {
      await adminSupabase
        .from('organizations')
        .update({
          custom_domain_status: 'failed' as CustomDomainStatus,
          custom_domain_error: vercelResult.error || 'Failed to add domain to Vercel',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      await adminSupabase.from('domain_verification_log').insert({
        organization_id: id,
        domain,
        status: 'failed',
        error_message: vercelResult.error,
      });

      return NextResponse.json({
        success: false,
        error: 'Failed to add domain to hosting provider',
        details: vercelResult.error,
      });
    }

    // Step 3: Verify with Vercel (triggers SSL provisioning)
    if (vercelResult.verificationRequired) {
      const verifyResult = await verifyDomainWithVercel(domain);

      if (!verifyResult.verified) {
        // Verification still pending (SSL might take a few minutes)
        await adminSupabase
          .from('organizations')
          .update({
            custom_domain_status: 'verifying' as CustomDomainStatus,
            custom_domain_error: 'SSL certificate is being provisioned. This may take a few minutes.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        return NextResponse.json({
          success: true,
          status: 'verifying',
          message: 'Domain added. SSL certificate is being provisioned.',
          verificationDetails: verifyResult.verificationDetails,
        });
      }
    }

    // Success!
    await adminSupabase
      .from('organizations')
      .update({
        custom_domain_status: 'verified' as CustomDomainStatus,
        custom_domain_verified_at: new Date().toISOString(),
        custom_domain_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await adminSupabase.from('domain_verification_log').insert({
      organization_id: id,
      domain,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      status: 'verified',
      message: 'Domain verified and active!',
    });
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[id]/domain
 * Remove custom domain
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access
    const hasAccess = await checkOrgAccess(supabase, id, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get current domain
    const { data: org } = await adminSupabase
      .from('organizations')
      .select('custom_domain')
      .eq('id', id)
      .single();

    if (org?.custom_domain) {
      // Remove from Vercel (best effort)
      await removeDomainFromVercel(org.custom_domain);
    }

    // Clear domain from organization
    const { error: updateError } = await adminSupabase
      .from('organizations')
      .update({
        custom_domain: null,
        custom_domain_status: null,
        custom_domain_verified_at: null,
        custom_domain_error: null,
        vercel_domain_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error removing domain:', updateError);
      return NextResponse.json({ error: 'Failed to remove domain' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
