import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface OTPEmailProps {
  code: string;
  expiresInMinutes?: number;
  appUrl?: string;
}

export function OTPEmail({
  code,
  expiresInMinutes = 10,
  appUrl = 'https://zeno.fyi',
}: OTPEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Zeno login code: {code}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${appUrl}/brand/logo-inverted.svg`}
              width="100"
              height="44"
              alt="Zeno"
              style={logo}
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={greeting}>Your login code</Heading>
            <Text style={message}>
              Enter the following code to sign in to your Zeno account. This
              code will expire in {expiresInMinutes} minutes.
            </Text>

            {/* Code Box */}
            <Section style={codeContainer}>
              <Text style={codeLabel}>VERIFICATION CODE</Text>
              <Text style={codeText}>{code}</Text>
              <Text style={expiry}>Expires in {expiresInMinutes} minutes</Text>
            </Section>

            <Section style={divider} />

            <Text style={securityNote}>
              If you didn&apos;t request this code, you can safely ignore this email.
              Someone may have entered your email address by mistake.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by{' '}
              <Link href="https://zeno.fyi" style={footerLink}>
                Zeno
              </Link>
              .<br />
              Paste data. Get a dashboard. Share in seconds.
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
  maxWidth: '480px',
  margin: '40px auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

const header = {
  background: 'linear-gradient(135deg, #0055FF 0%, #0044CC 100%)',
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const logo = {
  display: 'block',
  margin: '0 auto',
};

const content = {
  padding: '40px',
};

const greeting = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
};

const message = {
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: '0 0 32px 0',
};

const codeContainer = {
  backgroundColor: '#f9fafb',
  border: '2px dashed #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const codeLabel = {
  fontSize: '12px',
  fontWeight: '500',
  color: '#6b7280',
  letterSpacing: '0.5px',
  margin: '0 0 12px 0',
};

const codeText = {
  fontSize: '36px',
  fontWeight: '700',
  color: '#0055FF',
  letterSpacing: '8px',
  fontFamily: "'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace",
  margin: 0,
};

const expiry = {
  fontSize: '13px',
  color: '#9ca3af',
  margin: '16px 0 0 0',
};

const divider = {
  height: '1px',
  backgroundColor: '#e5e7eb',
  margin: '32px 0',
};

const securityNote = {
  fontSize: '13px',
  color: '#6b7280',
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

export default OTPEmail;
