# Email Templates (Deprecated)

This folder previously contained HTML email templates.

**Email templates have moved to:** `src/lib/email/templates/`

We now use **React Email** with **Resend** for sending emails. See:

- `src/lib/email/templates/otp-email.tsx` - OTP login code email
- `src/lib/email/templates/welcome-email.tsx` - Welcome email
- `src/lib/email/templates/dashboard-ready-email.tsx` - Dashboard ready notification
- `src/lib/email/templates/share-notification-email.tsx` - Share notification
- `src/lib/email/send.ts` - Email sending functions
- `src/lib/email/resend.ts` - Resend client configuration
- `src/lib/email/assets.ts` - Email asset URLs (logos, etc.)

## API Endpoints

- `POST /api/email/otp` - Send OTP code email
- `POST /api/email/welcome` - Send welcome email

## Environment Variables

```env
RESEND_API_KEY=re_your-resend-api-key
FROM_EMAIL=Zeno <noreply@yourdomain.com>
EMAIL_WEBHOOK_SECRET=your-webhook-secret
```

## Usage

```typescript
import { sendOTPEmail, sendWelcomeEmail } from '@/lib/email';

// Send OTP email
await sendOTPEmail({
  to: 'user@example.com',
  code: '123456',
  expiresInMinutes: 10,
});

// Send welcome email
await sendWelcomeEmail({
  to: 'user@example.com',
});
```
