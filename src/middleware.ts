import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Main domains where the app is hosted (subdomains of these are organization subdomains)
const MAIN_DOMAINS = [
  'zeno.fyi',
  'vercel.app',
  'localhost',
  '127.0.0.1',
];

// Subdomains that are reserved for app functionality (not organizations)
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin'];

/**
 * Extract subdomain from hostname
 * Returns null if on main domain or reserved subdomain
 */
function getSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Check if it's a main domain or localhost
  for (const mainDomain of MAIN_DOMAINS) {
    if (host === mainDomain) {
      return null; // Main domain, no subdomain
    }

    if (host.endsWith(`.${mainDomain}`)) {
      // Extract subdomain
      const subdomain = host.slice(0, -(mainDomain.length + 1));

      // Check if it's a reserved subdomain
      if (RESERVED_SUBDOMAINS.includes(subdomain)) {
        return null;
      }

      // Multi-level subdomain (e.g., "a.b.zeno.app") - take first part
      const parts = subdomain.split('.');
      return parts[0];
    }
  }

  // Could be a custom domain - return the full hostname as indicator
  // We'll look this up in the database
  return `custom:${host}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Extend cookie lifetime to 1 year for persistent sessions
              maxAge: 60 * 60 * 24 * 365,
            })
          );
        },
      },
    }
  );

  // Refresh session if expired - this keeps the user logged in
  await supabase.auth.getUser();

  // Check for subdomain
  const subdomain = getSubdomain(hostname);

  if (subdomain) {
    // Paths that don't require authentication on subdomains
    // - /auth: login page
    // - /api/auth: auth API endpoints
    // - /api/cron/: cron job endpoints (authenticated via CRON_SECRET)
    // - /d/: shared dashboard pages (they have their own auth gate)
    const publicPaths = ['/auth', '/api/auth', '/api/cron/', '/d/'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    // Check authentication for subdomain access
    if (!isPublicPath) {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect unauthenticated users to /auth on the subdomain
        const url = request.nextUrl.clone();
        url.pathname = '/auth';

        const response = NextResponse.redirect(url);

        // Copy cookies from supabase response
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie.name, cookie.value);
        });

        return response;
      }
    }

    // Handle custom domain lookup
    if (subdomain.startsWith('custom:')) {
      const customDomain = subdomain.slice(7);

      // Look up organization by custom domain
      const { data: organization } = await supabase
        .from('organizations')
        .select('id, subdomain')
        .eq('custom_domain', customDomain)
        .single();

      if (organization) {
        // Rewrite to organization route
        const url = request.nextUrl.clone();
        url.pathname = `/w/${organization.subdomain || organization.id}${pathname}`;
        return NextResponse.rewrite(url, {
          request,
          headers: supabaseResponse.headers,
        });
      }

      // Custom domain not found - show 404 or redirect to main site
      return supabaseResponse;
    }

    // Regular subdomain - rewrite to organization route
    // e.g., acme.zeno.fyi/my-dashboard -> /w/acme/my-dashboard
    const url = request.nextUrl.clone();
    url.pathname = `/w/${subdomain}${pathname}`;

    const response = NextResponse.rewrite(url, {
      request,
    });

    // Copy cookies from supabase response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value);
    });

    return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
