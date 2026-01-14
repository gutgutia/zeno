import { Navbar, Footer } from '@/components/marketing';
import { Container } from '@/components/ui';
import { Breadcrumbs } from '@/components/seo';

export const metadata = {
  title: 'Privacy Policy - Zeno',
  description: 'Zeno Privacy Policy - How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <Container size="md">
          <Breadcrumbs items={[{ name: 'Privacy Policy', href: '/privacy' }]} />
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: January 13, 2026</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
              <p className="text-gray-600 mb-4">
                At Zeno, we take your privacy seriously. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              <p className="text-gray-600 mb-4">We collect information that you provide directly to us:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Email address when you sign up</li>
                <li><strong>Content:</strong> Data you upload, paste, or import from connected services to create dashboards</li>
                <li><strong>Google Account Data:</strong> When you connect your Google account, we access your Google Sheets data that you explicitly select through the Google Picker interface</li>
                <li><strong>Usage Data:</strong> How you interact with our service</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through Stripe</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your dashboard creation requests</li>
                <li>Generate AI-powered visualizations and dashboards from your data</li>
                <li>Sync your dashboards with connected Google Sheets when you enable auto-sync</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Process payments and manage your subscription</li>
                <li>Respond to your comments and questions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Google User Data</h2>
              <p className="text-gray-600 mb-4">
                When you connect your Google account and select spreadsheets through Google Picker, we access and use your Google Sheets data as follows:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>What we access:</strong> Only the specific spreadsheets you explicitly select through the Google Picker interface. We do not browse or access any other files in your Google Drive.</li>
                <li><strong>How we use it:</strong> Your spreadsheet data is used solely to generate dashboards and visualizations as requested by you. If you enable auto-sync, we periodically read the spreadsheet to update your dashboard when the data changes.</li>
                <li><strong>Storage:</strong> We store the spreadsheet data necessary to render your dashboards. This data is stored securely using industry-standard encryption.</li>
                <li><strong>No AI Training:</strong> Your Google Sheets data is never used to train AI models. It is only processed to generate your specific dashboard.</li>
                <li><strong>No Selling:</strong> We do not sell, rent, or share your Google user data with third parties for their own purposes.</li>
                <li><strong>Deletion:</strong> You can delete your dashboard at any time, which removes the associated Google Sheets data. You can also disconnect your Google account from Settings to revoke access.</li>
              </ul>
              <p className="text-gray-600 mb-4">
                <strong>Compliance:</strong> Zeno&apos;s use and transfer of information received from Google APIs adheres to the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
              <p className="text-gray-600 mb-4">
                Your data is stored securely using industry-standard encryption. We use Supabase
                for database hosting, which provides enterprise-grade security features including:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Encryption at rest and in transit</li>
                <li>Row-level security policies</li>
                <li>Regular security audits</li>
              </ul>
              <p className="text-gray-600 mb-4">
                <strong>Important:</strong> Your data is never used to train AI models. The content
                you upload is only used to generate your specific dashboards and is not shared
                with third parties for any other purpose.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Retention</h2>
              <p className="text-gray-600 mb-4">
                We retain your data for as long as your account is active or as needed to provide
                you services. Specifically:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Dashboard Data:</strong> Retained until you delete the dashboard or your account</li>
                <li><strong>Google Sheets Data:</strong> Retained while the dashboard exists and your Google account is connected. Deleted when you delete the dashboard, disconnect Google, or delete your account</li>
                <li><strong>Account Information:</strong> Retained until you request account deletion</li>
                <li><strong>Usage Logs:</strong> Retained for up to 90 days for troubleshooting and analytics</li>
              </ul>
              <p className="text-gray-600 mb-4">
                You can delete your dashboards at any time from the dashboard list. To request complete
                deletion of your account and all associated data, please contact us at{' '}
                <a href="mailto:privacy@zeno.fyi" className="text-blue-600 hover:underline">privacy@zeno.fyi</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sharing</h2>
              <p className="text-gray-600 mb-4">
                We do not sell your personal data. We share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Service Providers:</strong> We share data with third-party service providers who assist us in operating our service (listed below)</li>
                <li><strong>AI Processing:</strong> Your dashboard content is sent to Anthropic&apos;s Claude API for AI-powered generation. Anthropic does not use this data to train their models.</li>
                <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights</li>
                <li><strong>With Your Consent:</strong> We may share information when you give us explicit permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
              <p className="text-gray-600 mb-4">We use the following third-party services to operate Zeno:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Supabase:</strong> Database hosting and user authentication</li>
                <li><strong>Anthropic (Claude):</strong> AI-powered dashboard generation</li>
                <li><strong>Google:</strong> Google Sheets integration for data import and sync (when you connect your Google account)</li>
                <li><strong>Stripe:</strong> Payment processing and subscription management</li>
                <li><strong>Vercel:</strong> Application hosting</li>
                <li><strong>Resend:</strong> Transactional email delivery</li>
                <li><strong>PostHog:</strong> Product analytics (anonymized usage data)</li>
              </ul>
              <p className="text-gray-600 mb-4">
                Each of these services has their own privacy policy governing their use of your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-600 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Access:</strong> Request access to the personal data we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data by deleting your dashboards or contacting us</li>
                <li><strong>Export:</strong> Export your data in a portable format</li>
                <li><strong>Revoke Access:</strong> Disconnect third-party services (like Google) from your account at any time through Settings</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p className="text-gray-600 mb-4">
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:privacy@zeno.fyi" className="text-blue-600 hover:underline">privacy@zeno.fyi</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy from time to time. If we make material changes to how
                we use your data, we will notify you by email or through a notice on our service before
                the changes take effect. We encourage you to review this policy periodically.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-600">
                If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
                <a href="mailto:privacy@zeno.fyi" className="text-blue-600 hover:underline">
                  privacy@zeno.fyi
                </a>
              </p>
            </section>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
