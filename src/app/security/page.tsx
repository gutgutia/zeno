import { Navbar, Footer } from '@/components/marketing';
import { Container } from '@/components/ui';

export const metadata = {
  title: 'Security - Zeno',
  description: 'How Zeno keeps your data safe and secure.',
};

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <Container size="md">
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Security</h1>
            <p className="text-gray-500 mb-8">How we protect your data</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Our Commitment</h2>
              <p className="text-gray-600 mb-4">
                Security is a top priority at Zeno. We understand that you're trusting us with
                your data, and we take that responsibility seriously. Here's how we keep your
                information safe.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Encryption</h2>
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">In Transit</h3>
                <p className="text-gray-600 mb-4">
                  All data transmitted between your browser and our servers is encrypted using
                  TLS 1.3, the latest security protocol.
                </p>
                <h3 className="font-semibold text-gray-900 mb-2">At Rest</h3>
                <p className="text-gray-600">
                  Your data is encrypted at rest using AES-256 encryption in our database,
                  powered by Supabase's enterprise security features.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Infrastructure Security</h2>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Hosting:</strong> Deployed on Vercel with automatic DDoS protection</li>
                <li><strong>Database:</strong> Supabase with Row Level Security (RLS) policies</li>
                <li><strong>Authentication:</strong> Secure, passwordless email verification</li>
                <li><strong>Monitoring:</strong> 24/7 automated security monitoring</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">AI & Your Data</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                <p className="text-gray-700 font-medium mb-2">
                  Your data is NEVER used to train AI models.
                </p>
                <p className="text-gray-600">
                  When you create a dashboard, your data is processed by Claude (Anthropic's AI)
                  solely to generate your specific output. It is not stored, learned from, or
                  used for any other purpose. Anthropic's enterprise API has strict data
                  handling policies that prevent training on customer data.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Access Controls</h2>
              <p className="text-gray-600 mb-4">We implement strict access controls:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Role-based access control for all internal systems</li>
                <li>Multi-factor authentication for team members</li>
                <li>Regular access reviews and audit logs</li>
                <li>Principle of least privilege for all operations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Sharing & Permissions</h2>
              <p className="text-gray-600 mb-4">
                You have full control over who can see your dashboards:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Private by default:</strong> Dashboards are only visible to you</li>
                <li><strong>Shareable links:</strong> Generate unique links to share specific dashboards</li>
                <li><strong>Revoke access:</strong> Disable sharing links at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Incident Response</h2>
              <p className="text-gray-600 mb-4">
                In the unlikely event of a security incident, we have a comprehensive response
                plan that includes immediate investigation, containment, user notification,
                and remediation. We are committed to transparency and will notify affected
                users promptly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Report a Vulnerability</h2>
              <p className="text-gray-600 mb-4">
                We welcome responsible disclosure of security vulnerabilities. If you discover
                a security issue, please report it to us at{' '}
                <a href="mailto:security@zeno.fyi" className="text-blue-600 hover:underline">
                  security@zeno.fyi
                </a>
              </p>
              <p className="text-gray-600">
                Please include details about the vulnerability and steps to reproduce it.
                We'll acknowledge your report within 48 hours and work with you to resolve
                the issue.
              </p>
            </section>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
