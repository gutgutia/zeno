import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email sending will fail.');
}

// Use a placeholder key for build time, actual sending will fail with meaningful error
export const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key');

// Default sender - verified domain
export const FROM_EMAIL = process.env.FROM_EMAIL || 'Zeno <noreply@zeno.fyi>';
