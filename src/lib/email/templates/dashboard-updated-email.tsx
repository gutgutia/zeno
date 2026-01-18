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

interface DashboardUpdatedEmailProps {
  dashboardTitle: string;
  dashboardUrl: string;
  versionLabel?: string;
  summary?: string;
  changesCount?: number;
}

export function DashboardUpdatedEmail({
  dashboardTitle,
  dashboardUrl,
  versionLabel,
  summary,
  changesCount,
}: DashboardUpdatedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your dashboard "{dashboardTitle}" has been updated{versionLabel ? ` to version ${versionLabel}` : ''}</Preview>
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
            <Text style={tagline}>Dashboard updated!</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <table cellPadding="0" cellSpacing="0" border={0} style={successIconTable}>
              <tr>
                <td style={successIconCell}>
                  <Img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%230055FF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'%3E%3C/path%3E%3C/svg%3E"
                    width="32"
                    height="32"
                    alt="Updated"
                    style={checkmarkIcon}
                  />
                </td>
              </tr>
            </table>

            <Heading style={title}>Dashboard Updated</Heading>

            <Text style={message}>
              Your dashboard <strong>"{dashboardTitle}"</strong> has been
              successfully updated with new data
              {versionLabel && <> and is now at <strong>version {versionLabel}</strong></>}.
            </Text>

            <Section style={dashboardPreview}>
              <Text style={previewLabel}>Dashboard</Text>
              <Text style={previewTitle}>{dashboardTitle}</Text>
              {versionLabel && (
                <Text style={versionBadge}>v{versionLabel}</Text>
              )}
            </Section>

            {summary && (
              <Section style={summarySection}>
                <Text style={summaryLabel}>What changed</Text>
                <Text style={summaryText}>{summary}</Text>
                {changesCount !== undefined && changesCount > 0 && (
                  <Text style={changesCountText}>{changesCount} metric{changesCount !== 1 ? 's' : ''} updated</Text>
                )}
              </Section>
            )}

            <Button style={ctaButton} href={dashboardUrl}>
              View Updated Dashboard
            </Button>

            <Hr style={divider} />

            <Section style={tipSection}>
              <Text style={tipTitle}>Tip</Text>
              <Text style={tipText}>
                If you have a Google Sheet connected, you can enable automatic syncing
                to keep your dashboard up-to-date without manual updates.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because your dashboard data was updated.
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
  backgroundColor: '#dbeafe',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
};

const checkmarkIcon = {
  display: 'inline-block',
  verticalAlign: 'middle',
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

const versionBadge = {
  display: 'inline-block',
  backgroundColor: '#dbeafe',
  color: '#1d4ed8',
  fontSize: '12px',
  fontWeight: '500',
  padding: '2px 8px',
  borderRadius: '4px',
  marginTop: '8px',
};

const summarySection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '24px',
  textAlign: 'left' as const,
};

const summaryLabel = {
  fontSize: '11px',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
};

const summaryText = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.6',
  margin: 0,
};

const changesCountText = {
  fontSize: '13px',
  color: '#6b7280',
  marginTop: '8px',
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

const tipSection = {
  textAlign: 'left' as const,
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px 20px',
};

const tipTitle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 8px 0',
};

const tipText = {
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

export default DashboardUpdatedEmail;
