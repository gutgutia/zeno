import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out Zeno and personal projects.',
    features: [
      '3 dashboards',
      'Basic chart types',
      'Public sharing only',
      'Community support',
    ],
    cta: 'Get Started',
    variant: 'secondary' as const,
    popular: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    description: 'For professionals who need more power and privacy.',
    features: [
      'Unlimited dashboards',
      'All chart types',
      'Private & public sharing',
      'Custom domains',
      'Priority support',
      'Export to PDF/PNG',
    ],
    cta: 'Start Free Trial',
    variant: 'primary' as const,
    popular: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: 'per user/month',
    description: 'For teams that collaborate on data stories.',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Collaborative editing',
      'Admin controls',
      'SSO integration',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    variant: 'secondary' as const,
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-white">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            Start free, upgrade when you need more. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                relative rounded-2xl p-8
                ${plan.popular
                  ? 'bg-white border-2 border-[var(--color-primary)] shadow-xl'
                  : 'bg-white border border-[var(--color-gray-200)]'
                }
              `}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-[var(--color-primary)] text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-[var(--color-gray-900)]">
                    {plan.price}
                  </span>
                  <span className="text-[var(--color-gray-500)]">
                    /{plan.period}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-gray-600)] mt-2">
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-[var(--color-success)] flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-[var(--color-gray-600)]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button variant={plan.variant} fullWidth>
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
