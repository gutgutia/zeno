import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zeno.fyi';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Dynamic pages: published dashboards
  let dashboardPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createAdminClient();

    // Fetch all published dashboards
    const { data: dashboards } = await supabase
      .from('dashboards')
      .select('slug, updated_at')
      .eq('is_published', true)
      .eq('generation_status', 'completed')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1000); // Limit to prevent overly large sitemaps

    if (dashboards) {
      dashboardPages = dashboards.map((dashboard) => ({
        url: `${baseUrl}/d/${dashboard.slug}`,
        lastModified: new Date(dashboard.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    // Silently fail - sitemap will still include static pages
    console.error('Failed to fetch dashboards for sitemap:', error);
  }

  return [...staticPages, ...dashboardPages];
}
