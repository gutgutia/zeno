import { Container, Button } from '@/components/ui';

export function CTA() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container size="lg" className="text-center">
        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] rounded-3xl p-12 md:p-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your data?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            Join thousands of professionals creating beautiful dashboards in seconds. Start free, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-[var(--color-primary)] hover:bg-[var(--color-gray-100)]"
            >
              Get Started Free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
            >
              Schedule a Demo
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
