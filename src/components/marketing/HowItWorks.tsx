import { Container } from '@/components/ui';

const steps = [
  {
    number: '01',
    title: 'Bring your data',
    description: 'Copy-paste from a spreadsheet, upload a file, or connect Google Sheets. Any format works.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center text-green-600 text-xs font-bold border-2 border-white">XLS</div>
            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600 text-xs font-bold border-2 border-white">CSV</div>
            <div className="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center text-yellow-600 text-xs font-bold border-2 border-white">GS</div>
          </div>
          <span className="text-sm text-[var(--color-gray-500)]">Drop any file</span>
        </div>
        <div className="font-mono text-xs text-[var(--color-gray-500)] bg-white rounded p-2 border border-dashed border-[var(--color-gray-300)]">
          <div>Name, Sales, Region</div>
          <div>Acme, $45k, West</div>
          <div className="text-[var(--color-gray-400)]">...</div>
        </div>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Tell us what you need',
    description: 'Want a sales dashboard? A project summary? A polished report? Just say so in plain English.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="bg-white rounded-lg rounded-tl-none p-3 border border-[var(--color-gray-200)] text-sm text-[var(--color-gray-700)]">
            "Make this look like a professional sales report I can send to my boss"
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Share something beautiful',
    description: 'Get a polished dashboard or document ready to share with anyone—instantly.',
    visual: (
      <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-2 flex-1 bg-[var(--color-primary)] rounded-full" />
          <span className="text-xs text-[var(--color-success)] font-medium">Ready to share</span>
        </div>
        <div className="bg-white rounded p-2 border border-[var(--color-gray-200)] flex items-center gap-2">
          <div className="flex-1 text-xs text-[var(--color-gray-500)] truncate">zeno.fyi/d/sales-q4</div>
          <button className="text-xs bg-[var(--color-primary-light)] text-[var(--color-primary)] px-2 py-1 rounded font-medium">Copy</button>
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
            Simpler than you'd expect
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            No tutorials needed. If you can copy and paste, you're ready.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col">
              {/* Step number */}
              <div className="text-5xl font-bold text-[var(--color-gray-200)] mb-4">
                {step.number}
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                {step.title}
              </h3>
              
              {/* Description - fixed height to align visuals */}
              <p className="text-[var(--color-gray-600)] mb-6 md:min-h-[72px]">
                {step.description}
              </p>
              
              {/* Visual */}
              <div className="mt-auto">
                {step.visual}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
