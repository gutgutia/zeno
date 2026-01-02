import { Container } from '@/components/ui';

export function CTA() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container size="lg" className="text-center">
        <div 
          className="rounded-3xl p-12 md:p-16"
          style={{ backgroundColor: '#0055FF' }}
        >
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: '#FFFFFF' }}
          >
            Ready to look good?
          </h2>
          <p 
            className="text-lg max-w-xl mx-auto mb-8"
            style={{ color: 'rgba(255, 255, 255, 0.85)' }}
          >
            Stop wrestling with spreadsheets. Start impressing your boss, your clients, and yourself. It's free to try.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/login"
              className="inline-flex items-center justify-center h-12 px-8 font-medium rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#FFFFFF', color: '#0055FF' }}
            >
              Try it free
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center h-12 px-8 font-medium rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: '#FFFFFF', border: '2px solid rgba(255, 255, 255, 0.5)' }}
            >
              See how it works ↑
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
