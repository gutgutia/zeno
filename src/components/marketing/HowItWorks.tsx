import { Container } from '@/components/ui';

const steps = [
  {
    number: '01',
    title: 'Paste your data',
    description: 'Copy data from any spreadsheet, CSV, or database. We handle the parsing automatically.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4 font-mono text-sm text-[var(--color-gray-600)]">
        <div className="text-[var(--color-gray-400)] mb-2"># Monthly Sales Data</div>
        <div>Jan, 12500</div>
        <div>Feb, 14200</div>
        <div>Mar, 18900</div>
        <div className="text-[var(--color-gray-400)]">...</div>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Describe what you want',
    description: 'Tell us in plain English what kind of dashboard you need. Be as specific or vague as you like.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="bg-white rounded-lg rounded-tl-none p-3 border border-[var(--color-gray-200)] text-sm text-[var(--color-gray-700)]">
            "Create a sales dashboard with a trend line and highlight the best performing month"
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Get your dashboard',
    description: 'In seconds, receive a beautiful, interactive dashboard ready to share with your team.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-2 flex-1 bg-[var(--color-primary)] rounded-full" />
          <span className="text-xs text-[var(--color-gray-500)]">Generated</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded p-2 border border-[var(--color-gray-200)]">
            <div className="text-xs text-[var(--color-gray-400)] mb-1">Peak</div>
            <div className="text-lg font-semibold text-[var(--color-gray-900)]">$18.9k</div>
          </div>
          <div className="bg-white rounded p-2 border border-[var(--color-gray-200)]">
            <div className="text-xs text-[var(--color-gray-400)] mb-1">Growth</div>
            <div className="text-lg font-semibold text-[var(--color-success)]">+51%</div>
          </div>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            How it Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Three steps to your dashboard
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            No tutorials needed. If you can copy and paste, you can create dashboards.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line (hidden on mobile and for last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-[var(--color-gray-200)] -translate-x-1/2 z-0" />
              )}

              {/* Step content */}
              <div className="relative z-10">
                <div className="text-5xl font-bold text-[var(--color-gray-200)] mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                  {step.title}
                </h3>
                <p className="text-[var(--color-gray-600)] mb-6">
                  {step.description}
                </p>
                {step.visual}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
