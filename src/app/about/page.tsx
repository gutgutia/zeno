import { Navbar, Footer } from '@/components/marketing';
import { Container } from '@/components/ui';

export const metadata = {
  title: 'About - Zeno',
  description: 'Learn about Zeno and our mission to make data beautiful for everyone.',
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <Container size="md">
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">About Zeno</h1>

            <section className="mb-12">
              <p className="text-xl text-gray-600 leading-relaxed mb-6">
                Zeno exists because we believe everyone deserves to look good when sharing data.
                You shouldn't need to be a designer or a data scientist to create a beautiful
                dashboard or a polished report.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">The Problem</h2>
              <p className="text-gray-600 mb-4">
                We've all been there. You have important data—sales numbers, project updates,
                campaign results—and you need to share it with your boss, your clients, or your
                team. So you open Excel, create some charts, maybe copy them into PowerPoint,
                and spend hours trying to make it look... acceptable.
              </p>
              <p className="text-gray-600 mb-4">
                Or worse, you've tried tools like Tableau or Looker, only to find yourself
                drowning in configuration options, data connections, and a learning curve
                that feels more like a cliff.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Solution</h2>
              <p className="text-gray-600 mb-4">
                Zeno is different. We believe the best tools are the ones you don't have to learn.
              </p>
              <p className="text-gray-600 mb-4">
                With Zeno, you just paste your data, tell us what you need in plain English, and
                get a beautiful result in seconds. No tutorials. No certifications. No frustration.
              </p>
              <p className="text-gray-600 mb-4">
                We use AI to handle the hard parts—choosing the right charts, picking colors that
                work together, laying out information clearly—so you can focus on what matters:
                your message.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Values</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Simplicity First</h3>
                  <p className="text-gray-600 text-sm">
                    If it takes more than a minute to figure out, it's too complicated.
                    We obsess over making things simple.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Beauty Matters</h3>
                  <p className="text-gray-600 text-sm">
                    Good design isn't a luxury. When your work looks professional,
                    people take you seriously.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Your Data, Your Control</h3>
                  <p className="text-gray-600 text-sm">
                    We never use your data to train AI models. Your information stays
                    private and secure.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Honest Pricing</h3>
                  <p className="text-gray-600 text-sm">
                    No hidden fees, no surprise charges. Start free, upgrade when
                    you need more.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get in Touch</h2>
              <p className="text-gray-600">
                We'd love to hear from you. Whether you have feedback, questions, or just
                want to say hi, reach out at{' '}
                <a href="mailto:hello@zeno.fyi" className="text-blue-600 hover:underline">
                  hello@zeno.fyi
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
