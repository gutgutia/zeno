import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { EMAIL_LOGO_URL, EMAIL_LOGO_SMALL_WIDTH, EMAIL_LOGO_SMALL_HEIGHT } from '../assets';

interface TeamInvitationEmailProps {
  organizationName: string;
  inviterName?: string;
  inviteUrl: string;
  role: string;
  expiresAt: string;
}

export function TeamInvitationEmail({
  organizationName,
  inviterName,
  inviteUrl,
  role,
  expiresAt,
}: TeamInvitationEmailProps) {
  const inviterText = inviterName ? `${inviterName} has invited you` : "You've been invited";
  const expiresDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Html>
      <Head />
      <Preview>{inviterText} to join {organizationName} on Zeno</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={EMAIL_LOGO_URL}
              width={EMAIL_LOGO_SMALL_WIDTH}
              height={EMAIL_LOGO_SMALL_HEIGHT}
              alt="Zeno"
              style={logoImg}
            />
            <Text style={tagline}>You're invited to join a team</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <table cellPadding="0" cellSpacing="0" border={0} style={iconTable}>
              <tr>
                <td style={iconCell}>
                  <span style={iconEmoji}>+</span>
                </td>
              </tr>
            </table>

            <Heading style={title}>Team Invitation</Heading>

            <Text style={message}>
              {inviterName ? (
                <>
                  <strong>{inviterName}</strong> has invited you to join
                </>
              ) : (
                <>You've been invited to join</>
              )}{' '}
              the <strong>{organizationName}</strong> team on Zeno as a{' '}
              <strong>{role}</strong>.
            </Text>

            <Section style={orgPreview}>
              <Text style={previewLabel}>Team</Text>
              <Text style={previewTitle}>{organizationName}</Text>
              <Text style={roleText}>Role: {role.charAt(0).toUpperCase() + role.slice(1)}</Text>
            </Section>

            <Button style={ctaButton} href={inviteUrl}>
              Accept Invitation
            </Button>

            <Text style={expiryNote}>
              This invitation expires on {expiresDate}
            </Text>

            <Hr style={divider} />

            <Section style={infoSection}>
              <Text style={infoTitle}>What is Zeno?</Text>
              <Text style={infoText}>
                Zeno is a platform for creating beautiful, interactive dashboards
                from spreadsheet data. As a team member, you'll be able to
                collaborate on dashboards and share insights with your colleagues.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because someone invited you to their team.
              <br />
              If you don't want to join, you can ignore this email.
              <br />
              <Link href="https://zeno.fyi" style={footerLink}>
                Zeno
              </Link>{' '}
              - Create beautiful dashboards in seconds.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const container = {
  maxWidth: '520px',
  margin: '40px auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

const header = {
  background: 'linear-gradient(135deg, #0055FF 0%, #0044CC 100%)',
  padding: '40px',
  textAlign: 'center' as const,
};

const logoImg = {
  display: 'block',
  margin: '0 auto 12px auto',
};

const tagline = {
  fontSize: '16px',
  color: 'rgba(255, 255, 255, 0.9)',
  fontWeight: '500',
  margin: 0,
};

const content = {
  padding: '40px',
  textAlign: 'center' as const,
};

const iconTable = {
  margin: '0 auto 24px auto',
};

const iconCell = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#e0ecff',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
};

const iconEmoji = {
  fontSize: '32px',
  color: '#0055FF',
  fontWeight: '700',
  lineHeight: '64px',
};

const title = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
};

const message = {
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.7',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
};

const orgPreview = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '24px',
};

const previewLabel = {
  fontSize: '11px',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px 0',
};

const previewTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 4px 0',
};

const roleText = {
  fontSize: '13px',
  color: '#6b7280',
  margin: 0,
};

const ctaButton = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #0055FF 0%, #0044CC 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '14px 32px',
  borderRadius: '8px',
  marginBottom: '16px',
};

const expiryNote = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0 0 24px 0',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const infoSection = {
  textAlign: 'left' as const,
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
};

const infoTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 8px 0',
};

const infoText = {
  fontSize: '13px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: 0,
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 40px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
};

const footerText = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: 0,
  lineHeight: '1.6',
};

const footerLink = {
  color: '#0055FF',
  textDecoration: 'none',
};

export default TeamInvitationEmail;
