'use client';

import { useState } from 'react';
import { Container } from '@/components/ui';

const faqs = [
  {
    question: 'What is Zeno?',
    answer: 'Zeno is an AI-powered dashboard generator that transforms your raw data into beautiful, shareable visualizations in seconds. Simply paste your spreadsheet data, describe what you want, and our AI creates stunning dashboards without any coding required.',
  },
  {
    question: 'What data formats does Zeno support?',
    answer: 'Zeno supports CSV files, Excel spreadsheets (.xlsx, .xls), Google Sheets integration, and you can even paste data directly from any spreadsheet application. We automatically detect your data structure and format.',
  },
  {
    question: 'Do I need technical skills to use Zeno?',
    answer: 'No technical skills required. Just describe what you want in plain English, like "show me monthly revenue trends" or "create a sales performance dashboard." Our AI handles all the complexity for you.',
  },
  {
    question: 'How does sharing work?',
    answer: 'Every dashboard gets a unique, shareable link. You can share publicly (anyone with the link can view), share with specific email addresses, or share with entire email domains. Viewers don\'t need a Zeno account to see your dashboards.',
  },
  {
    question: 'Can I update my dashboard with new data?',
    answer: 'Yes! You can refresh your dashboard with updated data anytime. If you connect Google Sheets, your dashboard can automatically sync when your source data changes.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use enterprise-grade security with encryption at rest and in transit. Your data is processed securely and never shared with third parties. We\'re SOC 2 compliant and follow industry best practices for data protection.',
  },
  {
    question: 'What\'s included in the free tier?',
    answer: 'The free tier includes credits to create several dashboards so you can experience Zeno\'s full capabilities. You can then purchase additional credits as needed, or subscribe for unlimited usage.',
  },
  {
    question: 'Can I customize the look of my dashboards?',
    answer: 'Yes! You can customize colors, add your company logo, and even use custom domains for white-label dashboards. Branding settings can be applied at the organization level or per-dashboard.',
  },
];

// Generate JSON-LD for FAQPage schema
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

function FAQItem({ question, answer, isOpen, onToggle }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[var(--color-gray-200)] last:border-b-0">
      <button
        type="button"
        className="w-full py-6 flex items-start justify-between text-left gap-4"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-[var(--color-gray-900)]">
          {question}
        </span>
        <span className="flex-shrink-0 mt-1">
          <svg
            className={`w-5 h-5 text-[var(--color-gray-500)] transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-6' : 'max-h-0'
        }`}
      >
        <p className="text-[var(--color-gray-600)] leading-relaxed pr-12">
          {answer}
        </p>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-32 bg-[var(--color-gray-50)]">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Container size="lg">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-gray-900)] mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-[var(--color-gray-600)] max-w-2xl mx-auto">
            Everything you need to know about Zeno.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-[var(--color-gray-200)] px-8">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
