/**
 * Email Asset URLs
 * 
 * Email clients (Gmail, Outlook, etc.) don't support SVG images.
 * We store PNG versions of our logos in Supabase Storage for email use.
 * 
 * To update the logo:
 * 1. Convert the SVG to PNG at 2x resolution (e.g., 240x105 for a 120x52 display)
 * 2. Upload to Supabase Storage: logos/email/logo-mono-light.png
 * 3. Update EMAIL_LOGO_URL below with the public URL
 * 
 * Supabase Storage URL format:
 * https://[project-ref].supabase.co/storage/v1/object/public/logos/email/logo-mono-light.png
 */

// Email logo URL - PNG hosted on Supabase Storage for email client compatibility
// Uses logo-mono-light (all white) for dark header backgrounds in emails
export const EMAIL_LOGO_URL = 
  process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || 
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/email/logo-mono-light.png`;

// Logo dimensions for email templates (display size, not actual image size)
export const EMAIL_LOGO_WIDTH = 120;
export const EMAIL_LOGO_HEIGHT = 52;

// Smaller version for compact headers
export const EMAIL_LOGO_SMALL_WIDTH = 100;
export const EMAIL_LOGO_SMALL_HEIGHT = 44;

