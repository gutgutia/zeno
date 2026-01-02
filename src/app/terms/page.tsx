import { Navbar, Footer } from '@/components/marketing';
import { Container } from '@/components/ui';

export const metadata = {
  title: 'Terms of Service - Zeno',
  description: 'Zeno Terms of Service - The rules and guidelines for using our service.',
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <Container size="md">
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-500 mb-8">Last updated: January 1, 2026</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing or using Zeno ("the Service"), you agree to be bound by these Terms
                of Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-600 mb-4">
                Zeno is a platform that allows users to create beautiful dashboards and documents
                from their data using AI-powered generation. Users can upload data, describe their
                needs, and receive polished, shareable outputs.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
              <p className="text-gray-600 mb-4">
                To use certain features of the Service, you must create an account. You are
                responsible for maintaining the confidentiality of your account and for all
                activities that occur under your account.
              </p>
              <p className="text-gray-600 mb-4">You agree to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Keep your account information up to date</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Acceptable Use</h2>
              <p className="text-gray-600 mb-4">You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
                <li>Upload any content that is illegal, harmful, or offensive</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the intellectual property rights of others</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Interfere with or disrupt the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Your Content</h2>
              <p className="text-gray-600 mb-4">
                You retain ownership of any content you upload to the Service. By uploading content,
                you grant us a limited license to process and display your content as necessary to
                provide the Service.
              </p>
              <p className="text-gray-600 mb-4">
                You are solely responsible for the content you upload and must ensure you have
                the right to share any data you provide to the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-600 mb-4">
                The Service and its original content, features, and functionality are owned by
                Zeno and are protected by international copyright, trademark, and other
                intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Payment Terms</h2>
              <p className="text-gray-600 mb-4">
                Some features of the Service require payment. By subscribing to a paid plan,
                you agree to pay all applicable fees. Fees are non-refundable except as required
                by law or as explicitly stated in these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Termination</h2>
              <p className="text-gray-600 mb-4">
                We may terminate or suspend your account at any time for violations of these terms.
                You may also delete your account at any time. Upon termination, your right to use
                the Service will immediately cease.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Disclaimer of Warranties</h2>
              <p className="text-gray-600 mb-4">
                The Service is provided "as is" without warranties of any kind, either express
                or implied. We do not guarantee that the Service will be uninterrupted, secure,
                or error-free.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                To the maximum extent permitted by law, Zeno shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages arising out of your use
                of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Changes to Terms</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify these terms at any time. We will notify users of
                any material changes by posting the new terms on this page with an updated date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <p className="text-gray-600">
                If you have any questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@zeno.fyi" className="text-blue-600 hover:underline">
                  legal@zeno.fyi
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
