import { nanoid } from 'nanoid';

/**
 * Generate a URL-safe slug from a title
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const id = nanoid(8);
  return base ? `${base}-${id}` : id;
}

/**
 * Generate a random slug for untitled dashboards
 */
export function generateRandomSlug(): string {
  return nanoid(12);
}
