import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-32 bg-gradient-to-b from-[var(--color-gray-50)] to-white">
      <Container size="lg" className="text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-lighter)] rounded-full mb-8">
          <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />
          <span className="text-sm font-medium text-[var(--color-primary)]">
            Now in Public Beta
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-gray-900)] tracking-tight mb-6">
          Beautiful dashboards
          <br />
          <span className="text-[var(--color-primary)]">in seconds</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[var(--color-gray-600)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Paste your data, describe what you want, and let AI create stunning,
          shareable dashboards. No spreadsheet skills required.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button size="lg">
            Start Creating Free
          </Button>
          <Button variant="secondary" size="lg">
            See Examples
          </Button>
        </div>

        {/* Hero Image/Preview */}
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute -inset-4 bg-gradient-to-r from-[var(--color-primary-light)] to-[var(--color-accent-light)] rounded-2xl blur-2xl opacity-40" />
          <div className="relative bg-white rounded-xl shadow-xl border border-[var(--color-gray-200)] overflow-hidden">
            {/* Mock Dashboard Preview */}
            <div className="bg-[var(--color-gray-50)] px-4 py-3 border-b border-[var(--color-gray-200)] flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" />
                <div className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" />
                <div className="w-3 h-3 rounded-full bg-[var(--color-gray-300)]" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-5 bg-white rounded-md border border-[var(--color-gray-200)] max-w-md mx-auto flex items-center px-3">
                  <span className="text-xs text-[var(--color-gray-400)]">zeno.fyi/d/quarterly-sales</span>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Metric Cards */}
                {[
                  { label: 'Total Revenue', value: '$48,293', change: '+12.5%' },
                  { label: 'Active Users', value: '2,847', change: '+8.2%' },
                  { label: 'Conversion', value: '3.42%', change: '+0.8%' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-[var(--color-gray-50)] rounded-lg p-4">
                    <p className="text-xs text-[var(--color-gray-500)] mb-1">{metric.label}</p>
                    <p className="text-xl font-semibold text-[var(--color-gray-900)]">{metric.value}</p>
                    <p className="text-xs text-[var(--color-success)]">{metric.change}</p>
                  </div>
                ))}
              </div>
              {/* Chart Placeholder */}
              <div className="h-48 bg-gradient-to-t from-[var(--color-primary-light)] to-transparent rounded-lg flex items-end justify-around px-4 pb-4">
                {[65, 45, 80, 55, 90, 70, 85].map((height, i) => (
                  <div
                    key={i}
                    className="w-8 bg-[var(--color-primary)] rounded-t-md opacity-80"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
