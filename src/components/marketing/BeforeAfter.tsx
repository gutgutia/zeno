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
      chartBars: [45, 52, 49, 61, 38, 41, 45, 50], // Represents quarterly data
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
      chartBars: [28, 41, 69, 95, 30, 45, 60, 80], // Different pattern for marketing
    },
  },
  {
    id: 'proposal',
    label: 'Client Proposal',
    before: {
      title: 'proposal_draft.docx',
      content: [
        'PROPOSAL: Website Redesign',
        '',
        'Client: Acme Corp',
        'Budget: $45,000',
        'Timeline: 8 weeks',
        'Deliverables: Design, Dev, QA',
      ],
    },
    after: {
      title: 'Acme Corp Proposal',
      isDocument: true,
      sections: [
        { icon: '📋', label: 'Scope', value: '3 phases' },
        { icon: '💰', label: 'Investment', value: '$45,000' },
        { icon: '📅', label: 'Timeline', value: '8 weeks' },
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
      chartBars: [90, 75, 40, 20], // Represents completion percentages
      chartLabels: ['API', 'UI', 'Test', 'Docs'],
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
            Dashboards, reports, proposals—Zeno transforms any content into something beautiful.
          </p>
        </div>

        {/* Example Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
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
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-stretch">
            {/* BEFORE */}
            <div className="relative flex flex-col">
              <div className="absolute -top-3 left-4 bg-[var(--color-gray-200)] text-[var(--color-gray-600)] text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide z-10">
                Before
              </div>
              <div className="bg-white rounded-xl shadow-md border border-[var(--color-gray-200)] overflow-hidden pt-4 flex-1 flex flex-col">
                <div className="px-4 pb-2 border-b border-[var(--color-gray-100)]">
                  <span className="text-sm text-[var(--color-gray-500)] font-mono">{example.before.title}</span>
                </div>
                <div className="p-4 bg-[var(--color-gray-50)] font-mono text-sm text-[var(--color-gray-600)] flex-1">
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
            <div className="relative flex flex-col">
              <div className="absolute -top-3 left-4 bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide z-10">
                After
              </div>
              <div className="bg-white rounded-xl shadow-md border border-[var(--color-primary)] overflow-hidden pt-4 flex-1 flex flex-col">
                <div className="px-4 pb-2 border-b border-[var(--color-gray-100)]">
                  <span className="text-sm font-semibold text-[var(--color-gray-900)]">{example.after.title}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  {/* Document-style output */}
                  {example.after.isDocument ? (
                    <div className="flex-1">
                      <div className="space-y-3">
                        {example.after.sections?.map((section) => (
                          <div key={section.label} className="flex items-center gap-3 bg-[var(--color-gray-50)] rounded-lg p-3">
                            <span className="text-2xl">{section.icon}</span>
                            <div>
                              <p className="text-xs text-[var(--color-gray-500)]">{section.label}</p>
                              <p className="font-semibold text-[var(--color-gray-900)]">{section.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-[var(--color-gray-100)]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-gray-500)]">Ready to send</span>
                          <span className="text-[var(--color-primary)] font-medium">Share →</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dashboard-style output */
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {example.after.metrics?.map((metric) => (
                          <div key={metric.label} className="bg-[var(--color-gray-50)] rounded-lg p-3 text-center">
                            <p className="text-xs text-[var(--color-gray-500)] mb-1">{metric.label}</p>
                            <p className="text-lg font-bold text-[var(--color-gray-900)]">{metric.value}</p>
                            <p className="text-xs text-[var(--color-success)]">{metric.trend}</p>
                          </div>
                        ))}
                      </div>
                      {/* Unique visualization per example */}
                      <div className="flex-1 min-h-[64px] bg-gradient-to-t from-[var(--color-primary-light)] to-transparent rounded-lg flex items-end justify-around px-3 pb-2">
                        {example.after.chartBars?.map((height, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div
                              className="w-3 md:w-4 bg-[var(--color-primary)] rounded-t opacity-70"
                              style={{ height: `${height * 0.6}px` }}
                            />
                            {example.after.chartLabels && (
                              <span className="text-[8px] text-[var(--color-gray-400)]">
                                {example.after.chartLabels[i]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
