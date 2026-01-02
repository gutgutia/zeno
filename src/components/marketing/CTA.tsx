import { Container, Button } from '@/components/ui';

export function CTA() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container size="lg" className="text-center">
        <div className="bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] rounded-3xl p-12 md:p-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to look good?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            Stop wrestling with spreadsheets. Start impressing your boss, your clients, and yourself. It's free to try.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="!bg-white !text-[#2563eb] hover:!bg-gray-100"
            >
              Try it free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="!text-white !border-white/30 hover:!bg-white/10"
            >
              See how it works ↑
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
