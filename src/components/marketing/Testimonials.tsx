import { Container } from '@/components/ui';

const reactions = [
  {
    quote: "My boss asked how I made this so fast",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    quote: "Wait, I didn't have to learn anything?",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    quote: "My client thought I hired a designer",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    quote: "This is easier than Google Docs",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    quote: "Finally, a tool that doesn't need training",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    quote: "I look so much more professional now",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            The reaction
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            What you'll hear yourself saying
          </h2>
        </div>

        {/* Reactions Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reactions.map((reaction) => (
            <div
              key={reaction.quote}
              className="bg-white rounded-xl p-6 border border-[var(--color-gray-100)] shadow-sm flex items-center gap-4 hover:border-[var(--color-primary-light)] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] flex-shrink-0">
                {reaction.icon}
              </div>
              <p className="text-[var(--color-gray-700)] font-medium">
                "{reaction.quote}"
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
