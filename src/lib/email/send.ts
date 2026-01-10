import { resend, FROM_EMAIL } from './resend';
import { OTPEmail, WhiteLabelOptions } from './templates/otp-email';
import { WelcomeEmail } from './templates/welcome-email';
import { DashboardReadyEmail } from './templates/dashboard-ready-email';
import { DashboardUpdatedEmail } from './templates/dashboard-updated-email';
import { NewUserNotificationEmail } from './templates/new-user-notification-email';
import { TeamInvitationEmail } from './templates/team-invitation-email';

const ADMIN_EMAIL = 'abhishek.gutgutia@gmail.com';

export interface SendOTPEmailParams {
  to: string;
  code: string;
  expiresInMinutes?: number;
  whiteLabel?: WhiteLabelOptions;
}

export async function sendOTPEmail({
  to,
  code,
  expiresInMinutes = 10,
  whiteLabel,
}: SendOTPEmailParams) {
  // Use white-label sender name if provided, otherwise default
  const fromName = whiteLabel?.senderName || 'Zeno';
  const subject = whiteLabel?.companyName
    ? 'Your login code'
    : 'Your Zeno login code';

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${FROM_EMAIL.split('<')[1]?.replace('>', '') || 'noreply@zeno.fyi'}>`,
    to,
    subject,
    react: OTPEmail({ code, expiresInMinutes, whiteLabel }),
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

export interface SendNewUserNotificationEmailParams {
  userEmail: string;
}

export async function sendNewUserNotificationEmail({
  userEmail,
}: SendNewUserNotificationEmailParams) {
  const signupTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New Zeno signup: ${userEmail}`,
    react: NewUserNotificationEmail({ userEmail, signupTime }),
  });

  if (error) {
    console.error('Failed to send new user notification email:', error);
    throw new Error(`Failed to send new user notification email: ${error.message}`);
  }

  return data;
}

export interface SendTeamInvitationEmailParams {
  to: string;
  organizationName: string;
  inviterName?: string;
  inviteToken: string;
  role: string;
  expiresAt: string;
  appUrl?: string;
}

export async function sendTeamInvitationEmail({
  to,
  organizationName,
  inviterName,
  inviteToken,
  role,
  expiresAt,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeno.fyi',
}: SendTeamInvitationEmailParams) {
  const inviteUrl = `${appUrl}/invite/${inviteToken}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You've been invited to join ${organizationName} on Zeno`,
    react: TeamInvitationEmail({
      organizationName,
      inviterName,
      inviteUrl,
      role,
      expiresAt,
    }),
  });

  if (error) {
    console.error('Failed to send team invitation email:', error);
    throw new Error(`Failed to send team invitation email: ${error.message}`);
  }

  return data;
}
