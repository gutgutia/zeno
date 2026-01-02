'use client';

import { useState } from 'react';
import { Container } from '@/components/ui';

const examples = [
  {
    id: 'sales',
    label: 'Sales Report',
    before: {
      title: 'quarterly_sales.xlsx',
      content: [
        'Region,Q1,Q2,Q3,Q4',
        'North,45200,52100,48900,61200',
        'South,38100,41200,44500,49800',
        'East,29800,33400,31200,38900',
        'West,51200,58900,62100,71400',
      ],
    },
    after: {
      title: 'Regional Sales Dashboard',
      metrics: [
        { label: 'Total Revenue', value: '$658K', trend: '+23%' },
        { label: 'Best Region', value: 'West', trend: '$244K' },
        { label: 'Q4 Growth', value: '+18%', trend: 'vs Q3' },
      ],
    },
  },
  {
    id: 'marketing',
    label: 'Campaign Results',
    before: {
      title: 'campaign_metrics.csv',
      content: [
        'Campaign,Spend,Clicks,Leads,Conv',
        'Email Launch,2500,8420,284,3.4%',
        'Social Ads,4200,12840,412,3.2%',
        'Google Ads,6800,22100,687,3.1%',
        'Webinar,1200,890,156,17.5%',
      ],
    },
    after: {
      title: 'Marketing Performance',
      metrics: [
        { label: 'Total Leads', value: '1,539', trend: '+42%' },
        { label: 'Best ROI', value: 'Webinar', trend: '17.5%' },
        { label: 'Cost/Lead', value: '$9.56', trend: '-18%' },
      ],
    },
  },
  {
    id: 'project',
    label: 'Project Status',
    before: {
      title: 'project_update.txt',
      content: [
        'Project Alpha - Status Update',
        '- Backend API: 90% complete',
        '- Frontend UI: 75% complete',
        '- Testing: 40% complete',
        '- Documentation: 20% complete',
      ],
    },
    after: {
      title: 'Project Alpha Status',
      metrics: [
        { label: 'Overall', value: '68%', trend: 'On Track' },
        { label: 'At Risk', value: 'Docs', trend: '20%' },
        { label: 'ETA', value: 'Mar 15', trend: '3 weeks' },
      ],
    },
  },
];

export function BeforeAfter() {
  const [activeExample, setActiveExample] = useState('sales');
  const example = examples.find((e) => e.id === activeExample) || examples[0];

  return (
    <section id="before-after" className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      <Container size="xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            See the transformation
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            From raw data to ready-to-share
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            No matter what format your data is in, Zeno transforms it into something beautiful.
          </p>
        </div>

        {/* Example Tabs */}
        <div className="flex justify-center gap-2 mb-10">
          {examples.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setActiveExample(ex.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeExample === ex.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-white text-[var(--color-gray-600)] hover:bg-[var(--color-gray-100)] border border-[var(--color-gray-200)]'
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Before/After Comparison */}
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* BEFORE */}
            <div className="relative">
              <div className="absolute -top-3 left-4 bg-[var(--color-gray-200)] text-[var(--color-gray-600)] text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                Before
              </div>
              <div className="bg-white rounded-xl shadow-md border border-[var(--color-gray-200)] overflow-hidden pt-4">
                <div className="px-4 pb-2 border-b border-[var(--color-gray-100)]">
                  <span className="text-sm text-[var(--color-gray-500)] font-mono">{example.before.title}</span>
                </div>
                <div className="p-4 bg-[var(--color-gray-50)] font-mono text-sm text-[var(--color-gray-600)]">
                  <div className="space-y-1">
                    {example.before.content.map((line, i) => (
                      <div key={i} className={i === 0 ? 'text-[var(--color-gray-400)]' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AFTER */}
            <div className="relative">
              <div className="absolute -top-3 left-4 bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                After
              </div>
              <div className="bg-white rounded-xl shadow-md border border-[var(--color-primary)] overflow-hidden pt-4">
                <div className="px-4 pb-2 border-b border-[var(--color-gray-100)]">
                  <span className="text-sm font-semibold text-[var(--color-gray-900)]">{example.after.title}</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {example.after.metrics.map((metric) => (
                      <div key={metric.label} className="bg-[var(--color-gray-50)] rounded-lg p-3 text-center">
                        <p className="text-xs text-[var(--color-gray-500)] mb-1">{metric.label}</p>
                        <p className="text-lg font-bold text-[var(--color-gray-900)]">{metric.value}</p>
                        <p className="text-xs text-[var(--color-success)]">{metric.trend}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini visualization */}
                  <div className="h-16 bg-gradient-to-t from-[var(--color-primary-light)] to-transparent rounded-lg flex items-end justify-around px-3 pb-2">
                    {[40, 55, 45, 70, 60, 85, 75, 90].map((height, i) => (
                      <div
                        key={i}
                        className="w-3 bg-[var(--color-primary)] rounded-t opacity-70"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow between (desktop only) */}
          <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-10 h-10 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
