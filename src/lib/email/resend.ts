import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email sending will fail.');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender - update this to your verified domain
export const FROM_EMAIL = process.env.FROM_EMAIL || 'Zeno <noreply@zeno.app>';
