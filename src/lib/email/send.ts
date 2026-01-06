import { resend, FROM_EMAIL } from './resend';
import { OTPEmail } from './templates/otp-email';
import { WelcomeEmail } from './templates/welcome-email';
import { DashboardReadyEmail } from './templates/dashboard-ready-email';
import { DashboardUpdatedEmail } from './templates/dashboard-updated-email';

export interface SendOTPEmailParams {
  to: string;
  code: string;
  expiresInMinutes?: number;
}

export async function sendOTPEmail({
  to,
  code,
  expiresInMinutes = 10,
}: SendOTPEmailParams) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Your Zeno login code',
    react: OTPEmail({ code, expiresInMinutes }),
  });

  if (error) {
    console.error('Failed to send OTP email:', error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }

  return data;
}

export interface SendWelcomeEmailParams {
  to: string;
  appUrl?: string;
}

export async function sendWelcomeEmail({
  to,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeno.fyi',
}: SendWelcomeEmailParams) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Welcome to Zeno!',
    react: WelcomeEmail({ userEmail: to, appUrl }),
  });

  if (error) {
    console.error('Failed to send welcome email:', error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }

  return data;
}

export interface SendDashboardReadyEmailParams {
  to: string;
  dashboardTitle: string;
  dashboardId: string;
  appUrl?: string;
}

export async function sendDashboardReadyEmail({
  to,
  dashboardTitle,
  dashboardId,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeno.fyi',
}: SendDashboardReadyEmailParams) {
  const dashboardUrl = `${appUrl}/dashboards/${dashboardId}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Your dashboard "${dashboardTitle}" is ready`,
    react: DashboardReadyEmail({ dashboardTitle, dashboardUrl }),
  });

  if (error) {
    console.error('Failed to send dashboard ready email:', error);
    throw new Error(`Failed to send dashboard ready email: ${error.message}`);
  }

  return data;
}

export interface SendDashboardUpdatedEmailParams {
  to: string;
  dashboardTitle: string;
  dashboardId: string;
  versionLabel?: string;
  summary?: string;
  changesCount?: number;
  appUrl?: string;
}

export async function sendDashboardUpdatedEmail({
  to,
  dashboardTitle,
  dashboardId,
  versionLabel,
  summary,
  changesCount,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeno.fyi',
}: SendDashboardUpdatedEmailParams) {
  const dashboardUrl = `${appUrl}/dashboards/${dashboardId}`;

  const subject = versionLabel
    ? `Your dashboard "${dashboardTitle}" updated to v${versionLabel}`
    : `Your dashboard "${dashboardTitle}" has been updated`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    react: DashboardUpdatedEmail({
      dashboardTitle,
      dashboardUrl,
      versionLabel,
      summary,
      changesCount,
    }),
  });

  if (error) {
    console.error('Failed to send dashboard updated email:', error);
    throw new Error(`Failed to send dashboard updated email: ${error.message}`);
  }

  return data;
}
