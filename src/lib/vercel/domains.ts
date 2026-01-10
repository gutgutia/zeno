/**
 * Vercel Domains API Integration
 *
 * Handles adding, removing, and verifying custom domains via Vercel's API.
 * Requires VERCEL_TOKEN and VERCEL_PROJECT_ID environment variables.
 *
 * API Reference: https://vercel.com/docs/rest-api/endpoints#domains
 */

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelDomainConfig {
  // From Vercel API response
  name: string;
  apexName: string;
  projectId: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  updatedAt?: number;
  createdAt?: number;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

interface VercelError {
  error: {
    code: string;
    message: string;
  };
}

interface AddDomainResult {
  success: boolean;
  domain?: VercelDomainConfig;
  error?: string;
  verificationRequired?: boolean;
}

interface RemoveDomainResult {
  success: boolean;
  error?: string;
}

interface VerifyDomainResult {
  success: boolean;
  verified: boolean;
  error?: string;
  verificationDetails?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

interface DomainCheckResult {
  success: boolean;
  available: boolean;
  error?: string;
}

function getVercelCredentials(): { token: string; projectId: string; teamId?: string } | null {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    console.warn('Vercel credentials not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID.');
    return null;
  }

  return { token, projectId, teamId };
}

function buildUrl(path: string, teamId?: string): string {
  const url = new URL(path, VERCEL_API_BASE);
  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }
  return url.toString();
}

/**
 * Add a custom domain to the Vercel project
 */
export async function addDomainToVercel(domain: string): Promise<AddDomainResult> {
  const credentials = getVercelCredentials();
  if (!credentials) {
    return { success: false, error: 'Vercel credentials not configured' };
  }

  try {
    const response = await fetch(
      buildUrl(`/v10/projects/${credentials.projectId}/domains`, credentials.teamId),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = data as VercelError;
      // Domain already exists is not necessarily an error
      if (error.error?.code === 'domain_already_exists') {
        return {
          success: true,
          verificationRequired: true,
          error: 'Domain already added, verification may be required',
        };
      }
      return { success: false, error: error.error?.message || 'Failed to add domain' };
    }

    const domainConfig = data as VercelDomainConfig;
    return {
      success: true,
      domain: domainConfig,
      verificationRequired: !domainConfig.verified,
    };
  } catch (error) {
    console.error('Vercel API error (addDomain):', error);
    return { success: false, error: 'Failed to connect to Vercel API' };
  }
}

/**
 * Remove a custom domain from the Vercel project
 */
export async function removeDomainFromVercel(domain: string): Promise<RemoveDomainResult> {
  const credentials = getVercelCredentials();
  if (!credentials) {
    return { success: false, error: 'Vercel credentials not configured' };
  }

  try {
    const response = await fetch(
      buildUrl(`/v9/projects/${credentials.projectId}/domains/${domain}`, credentials.teamId),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${credentials.token}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json();
      const error = data as VercelError;
      // Domain not found is okay - means it's already removed
      if (error.error?.code === 'not_found') {
        return { success: true };
      }
      return { success: false, error: error.error?.message || 'Failed to remove domain' };
    }

    return { success: true };
  } catch (error) {
    console.error('Vercel API error (removeDomain):', error);
    return { success: false, error: 'Failed to connect to Vercel API' };
  }
}

/**
 * Verify a domain's DNS configuration with Vercel
 */
export async function verifyDomainWithVercel(domain: string): Promise<VerifyDomainResult> {
  const credentials = getVercelCredentials();
  if (!credentials) {
    return { success: false, verified: false, error: 'Vercel credentials not configured' };
  }

  try {
    const response = await fetch(
      buildUrl(`/v9/projects/${credentials.projectId}/domains/${domain}/verify`, credentials.teamId),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = data as VercelError;
      return {
        success: false,
        verified: false,
        error: error.error?.message || 'Failed to verify domain',
      };
    }

    const domainConfig = data as VercelDomainConfig;
    return {
      success: true,
      verified: domainConfig.verified,
      verificationDetails: domainConfig.verification,
    };
  } catch (error) {
    console.error('Vercel API error (verifyDomain):', error);
    return { success: false, verified: false, error: 'Failed to connect to Vercel API' };
  }
}

/**
 * Get domain configuration from Vercel
 */
export async function getDomainFromVercel(domain: string): Promise<{
  success: boolean;
  domain?: VercelDomainConfig;
  error?: string;
}> {
  const credentials = getVercelCredentials();
  if (!credentials) {
    return { success: false, error: 'Vercel credentials not configured' };
  }

  try {
    const response = await fetch(
      buildUrl(`/v9/projects/${credentials.projectId}/domains/${domain}`, credentials.teamId),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.token}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json();
      const error = data as VercelError;
      return { success: false, error: error.error?.message || 'Domain not found' };
    }

    const domainConfig = (await response.json()) as VercelDomainConfig;
    return { success: true, domain: domainConfig };
  } catch (error) {
    console.error('Vercel API error (getDomain):', error);
    return { success: false, error: 'Failed to connect to Vercel API' };
  }
}

/**
 * Check if a domain is available (not already added to another project)
 */
export async function checkDomainAvailability(domain: string): Promise<DomainCheckResult> {
  const credentials = getVercelCredentials();
  if (!credentials) {
    return { success: false, available: false, error: 'Vercel credentials not configured' };
  }

  try {
    // First, try to get domain info to see if it exists
    const response = await fetch(
      buildUrl(`/v6/domains/${domain}/config`, credentials.teamId),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.token}`,
        },
      }
    );

    if (response.status === 404) {
      // Domain not in any Vercel project - available
      return { success: true, available: true };
    }

    if (!response.ok) {
      const data = await response.json();
      const error = data as VercelError;
      return { success: false, available: false, error: error.error?.message };
    }

    // Domain exists somewhere
    return { success: true, available: false };
  } catch (error) {
    console.error('Vercel API error (checkDomain):', error);
    return { success: false, available: false, error: 'Failed to connect to Vercel API' };
  }
}

/**
 * Get the expected CNAME target for custom domains
 */
export function getCnameTarget(): string {
  // This is the standard Vercel CNAME target
  // For custom setups, this could be configurable via environment variable
  return process.env.VERCEL_CNAME_TARGET || 'cname.vercel-dns.com';
}

/**
 * DNS lookup to check if CNAME is properly configured
 * Note: This should be called from a server environment
 */
export async function checkDnsConfiguration(domain: string): Promise<{
  success: boolean;
  configured: boolean;
  cnameValue?: string;
  error?: string;
}> {
  try {
    // Use DNS over HTTPS (Cloudflare) for reliable DNS lookups
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`,
      {
        headers: {
          Accept: 'application/dns-json',
        },
      }
    );

    if (!response.ok) {
      return { success: false, configured: false, error: 'DNS lookup failed' };
    }

    const data = await response.json();

    // Check if we got any CNAME answers
    if (!data.Answer || data.Answer.length === 0) {
      // No CNAME record found - might be using A record or not configured
      return { success: true, configured: false };
    }

    // Get the CNAME value
    const cnameRecord = data.Answer.find((r: { type: number }) => r.type === 5); // Type 5 = CNAME
    if (!cnameRecord) {
      return { success: true, configured: false };
    }

    const cnameValue = cnameRecord.data.replace(/\.$/, ''); // Remove trailing dot
    const expectedTarget = getCnameTarget();

    // Check if CNAME points to our expected target
    const configured = cnameValue === expectedTarget || cnameValue.endsWith('.vercel-dns.com');

    return {
      success: true,
      configured,
      cnameValue,
    };
  } catch (error) {
    console.error('DNS lookup error:', error);
    return { success: false, configured: false, error: 'Failed to perform DNS lookup' };
  }
}
