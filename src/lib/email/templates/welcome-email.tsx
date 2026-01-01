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

interface WelcomeEmailProps {
  userEmail?: string;
  appUrl?: string;
}

export function WelcomeEmail({
  appUrl = 'https://zeno.app',
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Zeno - Create beautiful dashboards in seconds</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Zeno</Text>
            <Text style={tagline}>
              Paste data. Get a dashboard. Share in seconds.
            </Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={greeting}>Welcome to Zeno!</Heading>
            <Text style={message}>
              Thanks for signing up. You&apos;re now ready to create beautiful,
              shareable dashboards from your data in seconds, powered by AI.
            </Text>

            {/* Features */}
            <Section style={featureList}>
              <Section style={featureItem}>
                <Text style={featureIcon}>📊</Text>
                <Text style={featureText}>
                  <strong>Paste or upload data</strong> - CSV, Excel, or just
                  copy-paste from anywhere
                </Text>
              </Section>

              <Section style={featureItem}>
                <Text style={featureIcon}>✨</Text>
                <Text style={featureText}>
                  <strong>AI generates your dashboard</strong> - Charts,
                  metrics, and insights automatically
                </Text>
              </Section>

              <Section style={featureItem}>
                <Text style={featureIcon}>💬</Text>
                <Text style={featureText}>
                  <strong>Refine with chat</strong> - Tell AI what to change in
                  plain English
                </Text>
              </Section>

              <Section style={featureItem}>
                <Text style={featureIcon}>🔗</Text>
                <Text style={featureText}>
                  <strong>Share instantly</strong> - Publish with one click and
                  share a link
                </Text>
              </Section>
            </Section>

            <Button style={ctaButton} href={`${appUrl}/dashboards/new`}>
              Create Your First Dashboard
            </Button>

            <Hr style={divider} />

            <Section style={helpSection}>
              <Text style={helpTitle}>Need help getting started?</Text>
              <Text style={helpText}>
                Check out our{' '}
                <Link href={`${appUrl}/docs`} style={helpLink}>
                  documentation
                </Link>{' '}
                or reply to this email if you have any questions. We&apos;re here to
                help!
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this email because you signed up for{' '}
              <Link href={appUrl} style={footerLink}>
                Zeno
              </Link>
              .<br />
              If you didn&apos;t sign up, please ignore this email.
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
  padding: '48px 40px',
  textAlign: 'center' as const,
};

const logo = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#ffffff',
  letterSpacing: '-0.5px',
  margin: '0 0 8px 0',
};

const tagline = {
  fontSize: '14px',
  color: 'rgba(255, 255, 255, 0.85)',
  margin: 0,
};

const content = {
  padding: '40px',
};

const greeting = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
};

const message = {
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.7',
  margin: '0 0 32px 0',
};

const featureList = {
  marginBottom: '32px',
};

const featureItem = {
  marginBottom: '16px',
};

const featureIcon = {
  fontSize: '20px',
  margin: '0 0 4px 0',
};

const featureText = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.5',
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
  margin: '32px 0',
};

const helpSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
};

const helpTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 8px 0',
};

const helpText = {
  fontSize: '13px',
  color: '#6b7280',
  lineHeight: '1.6',
  margin: 0,
};

const helpLink = {
  color: '#2563EB',
  textDecoration: 'none',
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

export default WelcomeEmail;
