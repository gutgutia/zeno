import { Container } from '@/components/ui';

const useCases = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Sales Teams',
    description: 'Turn pipeline data into stunning proposals and forecasts that close deals.',
    example: '"I sent a Zeno dashboard instead of an Excel attachment. We closed the deal."',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
    title: 'Marketing Teams',
    description: 'Transform campaign metrics into reports your stakeholders actually want to read.',
    example: '"My boss asked how I made this so fast. I just smiled."',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Finance & Operations',
    description: 'Make budget reviews and forecasts crystal clear for any audience.',
    example: '"Finally, executives understand my quarterly reports at first glance."',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Founders & Executives',
    description: 'Impress investors and board members with polished updates in minutes.',
    example: '"Our investor updates went from dreaded to delightful."',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Consultants & Freelancers',
    description: 'Deliver beautiful client reports without the design overhead.',
    example: '"My client thought I hired a designer. I didn\'t correct them."',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Anyone with a Spreadsheet',
    description: 'Turn any data into something you\'re genuinely proud to share.',
    example: '"Wait, I didn\'t have to learn anything?"',
  },
];

export function WhoItsFor() {
  return (
    <section id="who-its-for" className="py-20 md:py-32 bg-white">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            Who it's for
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Built for people who need to look good
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            Whether you're presenting to your boss, your clients, or your investors—Zeno helps you impress.
          </p>
        </div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="bg-[var(--color-gray-50)] rounded-xl p-6 hover:shadow-md transition-shadow border border-transparent hover:border-[var(--color-gray-200)]"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-[var(--color-primary-light)] rounded-lg flex items-center justify-center text-[var(--color-primary)] mb-4">
                {useCase.icon}
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
                {useCase.title}
              </h3>
              <p className="text-[var(--color-gray-600)] mb-4">
                {useCase.description}
              </p>

              {/* Example Quote */}
              <p className="text-sm text-[var(--color-gray-500)] italic border-l-2 border-[var(--color-primary-light)] pl-3">
                {useCase.example}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
