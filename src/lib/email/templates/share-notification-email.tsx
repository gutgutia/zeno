import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ShareNotificationEmailProps {
  dashboardTitle: string;
  dashboardUrl: string;
  sharedByName?: string;
  appUrl?: string;
}

export function ShareNotificationEmail({
  dashboardTitle,
  dashboardUrl,
  sharedByName,
  appUrl = 'https://zeno.fyi',
}: ShareNotificationEmailProps) {
  const sharedByText = sharedByName ? `${sharedByName} shared` : 'Someone shared';

  return (
    <Html>
      <Head />
      <Preview>{sharedByText} "{dashboardTitle}" with you on Zeno</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Zeno</Text>
            <Text style={tagline}>A dashboard has been shared with you</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Section style={shareIcon}>
              <Text style={shareIconText}>&#128279;</Text>
            </Section>

            <Heading style={title}>You've Got Access</Heading>

            <Text style={message}>
              {sharedByName ? (
                <>
                  <strong>{sharedByName}</strong> has shared a dashboard with you
                </>
              ) : (
                <>You have been granted access to a dashboard</>
              )}
              {' '}on Zeno.
            </Text>

            <Section style={dashboardPreview}>
              <Text style={previewLabel}>Dashboard</Text>
              <Text style={previewTitle}>{dashboardTitle}</Text>
            </Section>

            <Button style={ctaButton} href={dashboardUrl}>
              View Dashboard
            </Button>

            <Hr style={divider} />

            <Section style={infoSection}>
              <Text style={infoTitle}>What is Zeno?</Text>
              <Text style={infoText}>
                Zeno is a platform for creating beautiful, interactive dashboards
                from spreadsheet data. You can view this shared dashboard for free,
                and create your own dashboards anytime.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because someone shared a dashboard with you.
              <br />
              <Link href={appUrl} style={footerLink}>
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
  background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)',
  padding: '40px',
  textAlign: 'center' as const,
};

const logo = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#ffffff',
  letterSpacing: '-0.5px',
  margin: '0 0 8px 0',
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

const shareIcon = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#dbeafe',
  margin: '0 auto 24px auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const shareIconText = {
  fontSize: '28px',
  margin: 0,
  lineHeight: '64px',
  textAlign: 'center' as const,
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
  background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)',
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
  color: '#2563EB',
  textDecoration: 'none',
};

export default ShareNotificationEmail;
