'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Try Zeno with no commitment',
    credits: '100 credits (one-time)',
    creditsNote: '~5-15 dashboards',
    features: [
      '3 dashboards',
      'Public sharing only',
      'Paste & CSV upload',
      'Community support',
    ],
    limitations: [
      'Zeno branding required',
      'No private sharing',
    ],
    cta: 'Get Started Free',
    ctaLink: '/auth',
    variant: 'outline' as const,
    popular: false,
  },
  {
    name: 'Starter',
    monthlyPrice: 10,
    annualPrice: 8,
    description: 'For solo creators and freelancers',
    credits: '200 credits/seat/mo',
    creditsNote: '~15-40 dashboards',
    features: [
      'Unlimited dashboards',
      'Private sharing (email & domain)',
      'Custom subdomain',
      'Email support',
    ],
    limitations: [
      'Zeno branding required',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/auth',
    variant: 'outline' as const,
    popular: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 24,
    annualPrice: 20,
    description: 'For teams needing integrations & branding',
    credits: '500 credits/seat/mo',
    creditsNote: '~35-100 dashboards',
    features: [
      'Everything in Starter',
      'Remove Zeno branding',
      'Custom domain',
      'Custom branding (logo, colors)',
      'Google Sheets integration',
      'Scheduled auto-refresh',
      'PDF & DocX export',
      'Shared workspaces',
      'Priority support',
    ],
    limitations: [],
    cta: 'Start Free Trial',
    ctaLink: '/auth',
    variant: 'default' as const,
    popular: true,
  },
];

const creditPacks = [
  { credits: 100, price: 6, perCredit: 0.06 },
  { credits: 500, price: 25, perCredit: 0.05, savings: '17%' },
  { credits: 2000, price: 80, perCredit: 0.04, savings: '33%' },
];

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto mb-8">
            Start free, upgrade when you need more. Pay per seat, pool credits across your team.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-white rounded-full p-1.5 border border-[var(--color-gray-200)]">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)]'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs opacity-80">Save up to 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {plans.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            const isProPlan = plan.popular;

            return (
              <div
                key={plan.name}
                className={`
                  relative rounded-2xl p-6 flex flex-col
                  ${isProPlan
                    ? 'bg-white border-2 border-[var(--color-primary)] shadow-xl ring-1 ring-[var(--color-primary)]/10'
                    : 'bg-white border border-[var(--color-gray-200)] shadow-sm'
                  }
                `}
              >
                {/* Popular Badge */}
                {isProPlan && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-[var(--color-gray-900)] mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[var(--color-gray-500)] mb-4">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--color-gray-900)]">
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="text-[var(--color-gray-500)] text-sm">
                        /seat/mo
                      </span>
                    )}
                  </div>
                  {price > 0 && isAnnual && (
                    <p className="text-xs text-[var(--color-gray-400)] mt-1">
                      Billed annually (${price * 12}/seat/year)
                    </p>
                  )}
                </div>

                {/* Credits */}
                <div className="bg-[var(--color-gray-50)] rounded-lg p-3 mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-semibold text-[var(--color-gray-900)]">
                      {plan.credits}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-gray-500)]">
                    {plan.creditsNote}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <svg
                        className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-[var(--color-gray-600)]">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2.5">
                      <svg
                        className="w-4 h-4 text-[var(--color-gray-300)] flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span className="text-sm text-[var(--color-gray-400)]">{limitation}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={plan.ctaLink}>
                  <Button 
                    variant={plan.variant} 
                    className={`w-full ${isProPlan ? 'shadow-md' : ''}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Enterprise Callout */}
        <div className="max-w-5xl mx-auto mb-12">
          <div className="bg-[#0D1327] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#FFFFFF' }}>
                Need enterprise features?
              </h3>
              <p style={{ color: '#94A3B8' }}>
                SSO, unlimited seats, custom integrations, dedicated support, and SLA guarantees.
              </p>
            </div>
            <Link href="/contact" className="flex-shrink-0">
              <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-[#0D1327]">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>

        {/* Credits Section */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-[var(--color-gray-200)] p-8">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-[var(--color-gray-900)] mb-2">
                Need more credits?
              </h3>
              <p className="text-[var(--color-gray-600)]">
                Purchase additional credit packs anytime. Credits are added to your workspace pool.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {creditPacks.map((pack) => (
                <div
                  key={pack.credits}
                  className="relative border border-[var(--color-gray-200)] rounded-xl p-4 text-center hover:border-[var(--color-primary)] hover:shadow-md transition-all"
                >
                  {pack.savings && (
                    <span className="absolute -top-2.5 right-3 bg-[var(--color-success)] text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      Save {pack.savings}
                    </span>
                  )}
                  <p className="text-2xl font-bold text-[var(--color-gray-900)] mb-1">
                    {pack.credits.toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--color-gray-500)] mb-3">credits</p>
                  <p className="text-lg font-semibold text-[var(--color-primary)]">
                    ${pack.price}
                  </p>
                  <p className="text-xs text-[var(--color-gray-400)]">
                    ${pack.perCredit.toFixed(2)}/credit
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Teaser */}
        <div className="text-center mt-12">
          <p className="text-[var(--color-gray-600)]">
            Have questions about pricing?{' '}
            <Link href="/contact" className="text-[var(--color-primary)] font-medium hover:underline">
              Contact us
            </Link>
            {' '}or check out our{' '}
            <button className="text-[var(--color-primary)] font-medium hover:underline">
              FAQ
            </button>
          </p>
        </div>
      </Container>
    </section>
  );
}
