import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface NewUserNotificationEmailProps {
  userEmail: string;
  signupTime: string;
}

export function NewUserNotificationEmail({
  userEmail,
  signupTime,
}: NewUserNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New Zeno signup: {userEmail}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={heading}>New User Signup</Heading>
            <Text style={message}>
              A new user just signed up for Zeno:
            </Text>
            <Section style={detailsBox}>
              <Text style={detailLabel}>Email</Text>
              <Text style={detailValue}>{userEmail}</Text>
              <Text style={detailLabel}>Time</Text>
              <Text style={detailValue}>{signupTime}</Text>
            </Section>
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

const content = {
  padding: '32px',
};

const heading = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 16px 0',
};

const message = {
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: '0 0 20px 0',
};

const detailsBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px 20px',
};

const detailLabel = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 4px 0',
};

const detailValue = {
  fontSize: '15px',
  color: '#111827',
  margin: '0 0 12px 0',
};

export default NewUserNotificationEmail;
