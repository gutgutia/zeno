import { Container } from '@/components/ui/Container';

const testimonials = [
  {
    quote: "I used to spend hours in Excel making charts look presentable. Now I paste data into Zeno and have a beautiful dashboard in under a minute.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechFlow",
  },
  {
    quote: "Our weekly investor updates went from a dreaded task to something I actually enjoy. The AI suggestions are surprisingly good.",
    author: "Marcus Johnson",
    role: "Founder",
    company: "Stealth Startup",
  },
  {
    quote: "Finally, a tool that doesn't require a data science degree. I share dashboards with clients and they're always impressed.",
    author: "Emily Rodriguez",
    role: "Consultant",
    company: "Independent",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Loved by data storytellers
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="bg-white rounded-xl p-8 border border-[var(--color-gray-100)] shadow-sm"
            >
              {/* Quote Icon */}
              <svg
                className="w-10 h-10 text-[var(--color-primary-light)] mb-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>

              {/* Quote */}
              <blockquote className="text-[var(--color-gray-700)] mb-6 leading-relaxed">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-accent-light)] flex items-center justify-center">
                  <span className="text-sm font-semibold text-[var(--color-primary)]">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-gray-900)]">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-[var(--color-gray-500)]">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
