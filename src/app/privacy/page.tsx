import { Navbar, Footer } from '@/components/marketing';
import { Container } from '@/components/ui';

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
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: January 1, 2026</p>

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
                <li><strong>Content:</strong> Data you upload or paste to create dashboards</li>
                <li><strong>Usage Data:</strong> How you interact with our service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your dashboard creation requests</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
              <p className="text-gray-600 mb-4">
                Your data is stored securely using industry-standard encryption. We use Supabase
                for database hosting, which provides enterprise-grade security features.
              </p>
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
                you services. You can delete your dashboards at any time, and you can request
                deletion of your account by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
              <p className="text-gray-600 mb-4">We use the following third-party services:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li><strong>Supabase:</strong> Database and authentication</li>
                <li><strong>Anthropic (Claude):</strong> AI-powered dashboard generation</li>
                <li><strong>Vercel:</strong> Application hosting</li>
                <li><strong>Resend:</strong> Email delivery</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-600 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-600">
                If you have any questions about this Privacy Policy, please contact us at{' '}
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
