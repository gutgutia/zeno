import { Container } from '@/components/ui';

export function CTA() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container size="lg" className="text-center">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-12 md:p-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to look good?
          </h2>
          <p className="text-lg text-blue-100 max-w-xl mx-auto mb-8">
            Stop wrestling with spreadsheets. Start impressing your boss, your clients, and yourself. It's free to try.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/login"
              className="inline-flex items-center justify-center h-12 px-8 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              Try it free
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center h-12 px-8 text-white font-medium rounded-lg border border-white/30 hover:bg-white/10 transition-colors"
            >
              See how it works ↑
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
