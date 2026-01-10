import { createAdminClient } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ subdomain: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OrganizationHomePage({ params }: PageProps) {
  const { subdomain } = await params;

  const adminSupabase = createAdminClient();

  // Verify the subdomain exists
  const { data: organization, error: organizationError } = await adminSupabase
    .from('organizations')
    .select('id')
    .eq('subdomain', subdomain)
    .single();

  if (organizationError || !organization) {
    notFound();
  }

  // Subdomain root redirects to main app
  // Dashboard viewing stays on subdomain (handled by /w/[subdomain]/[slug])
  redirect('https://zeno.fyi');
}
