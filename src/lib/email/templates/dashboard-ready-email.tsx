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

interface DashboardReadyEmailProps {
  dashboardTitle: string;
  dashboardUrl: string;
}

export function DashboardReadyEmail({
  dashboardTitle,
  dashboardUrl,
}: DashboardReadyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your dashboard "{dashboardTitle}" is ready to view</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={EMAIL_LOGO_URL}
              width={EMAIL_LOGO_SMALL_WIDTH}
              height={EMAIL_LOGO_SMALL_HEIGHT}
              alt="Zeno"
              style={logo}
            />
            <Text style={tagline}>Your dashboard is ready!</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <table cellPadding="0" cellSpacing="0" border={0} style={successIconTable}>
              <tr>
                <td style={successIconCell}>
                  <span style={checkmarkEmoji}>✓</span>
                </td>
              </tr>
            </table>

            <Heading style={title}>Dashboard Generated</Heading>

            <Text style={message}>
              Great news! Your dashboard <strong>"{dashboardTitle}"</strong> has
              been successfully generated and is ready to view.
            </Text>

            <Section style={dashboardPreview}>
              <Text style={previewLabel}>Dashboard</Text>
              <Text style={previewTitle}>{dashboardTitle}</Text>
            </Section>

            <Button style={ctaButton} href={dashboardUrl}>
              View Your Dashboard
            </Button>

            <Hr style={divider} />

            <Section style={nextSteps}>
              <Text style={nextStepsTitle}>What you can do next:</Text>
              <Text style={nextStepsItem}>
                <strong>Edit & refine</strong> - Use the chat to make changes in
                plain English
              </Text>
              <Text style={nextStepsItem}>
                <strong>Publish</strong> - Make your dashboard public with a
                shareable link
              </Text>
              <Text style={nextStepsItem}>
                <strong>Share</strong> - Invite specific people by email or
                domain
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you requested notification when
              your dashboard was ready.
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

const logo = {
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

const successIconTable = {
  margin: '0 auto 24px auto',
};

const successIconCell = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#e0ecff',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
};

const checkmarkEmoji = {
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

const dashboardPreview = {
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
  marginBottom: '32px',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const nextSteps = {
  textAlign: 'left' as const,
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
};

const nextStepsTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 12px 0',
};

const nextStepsItem = {
  fontSize: '13px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: '0 0 8px 0',
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

export default DashboardReadyEmail;
