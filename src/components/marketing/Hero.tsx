import Link from 'next/link';
import { Container, Button } from '@/components/ui';

export function Hero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-32 bg-gradient-to-b from-[var(--color-gray-50)] to-white">
      <Container size="lg" className="text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-lighter)] rounded-full mb-8">
          <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />
          <span className="text-sm font-medium text-[var(--color-primary)]">
            Now in Public Beta
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-gray-900)] tracking-tight mb-6">
          Beautiful dashboards
          <br />
          <span className="text-[var(--color-primary)]">in seconds</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[var(--color-gray-600)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Paste a spreadsheet, upload a document, or connect Google Sheets.
          Get a stunning dashboard or polished report you'll be proud to share.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/auth">
            <Button size="lg">
              Try it free
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="secondary" size="lg">
              See the magic ↓
            </Button>
          </a>
        </div>

        {/* Hero Image/Preview - Before/After Transformation */}
        <div className="relative mx-auto max-w-5xl">
          <div className="absolute -inset-4 bg-gradient-to-r from-[var(--color-primary-light)] to-[var(--color-primary-lighter)] rounded-2xl blur-2xl opacity-40" />
          <div className="relative grid md:grid-cols-2 gap-4 md:gap-6">
            {/* BEFORE - Raw Data */}
            <div className="bg-white rounded-xl shadow-lg border border-[var(--color-gray-200)] overflow-hidden">
              <div className="bg-[var(--color-gray-100)] px-4 py-2 border-b border-[var(--color-gray-200)]">
                <span className="text-xs font-medium text-[var(--color-gray-500)] uppercase tracking-wide">Your data</span>
              </div>
              <div className="p-4 font-mono text-xs text-[var(--color-gray-600)] bg-[var(--color-gray-50)]">
                <div className="text-[var(--color-gray-400)] mb-2">sales_data.csv</div>
                <div className="space-y-1 text-[10px] md:text-xs">
                  <div className="text-[var(--color-gray-400)]">Month,Revenue,Users,Conv%</div>
                  <div>Jan,12500,892,2.1</div>
                  <div>Feb,14200,1024,2.4</div>
                  <div>Mar,18900,1356,2.8</div>
                  <div>Apr,22100,1589,3.1</div>
                  <div>May,28400,1847,3.4</div>
                  <div>Jun,31200,2103,3.6</div>
                  <div className="text-[var(--color-gray-400)]">...</div>
                </div>
              </div>
            </div>

            {/* Arrow indicator (hidden on mobile) */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>

            {/* Mobile arrow */}
            <div className="flex md:hidden justify-center -my-2">
              <div className="w-10 h-10 bg-[var(--color-primary)] rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* AFTER - Beautiful Dashboard */}
            <div className="bg-white rounded-xl shadow-lg border border-[var(--color-gray-200)] overflow-hidden">
              <div className="bg-[var(--color-primary)] px-4 py-2">
                <span className="text-xs font-medium text-white uppercase tracking-wide">Your dashboard</span>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[var(--color-gray-900)] mb-3">Q2 Sales Performance</h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Revenue', value: '$127K', change: '+149%' },
                    { label: 'Users', value: '8,811', change: '+136%' },
                    { label: 'Conv.', value: '3.6%', change: '+71%' },
                  ].map((metric) => (
                    <div key={metric.label} className="bg-[var(--color-gray-50)] rounded-lg p-2">
                      <p className="text-[10px] text-[var(--color-gray-500)]">{metric.label}</p>
                      <p className="text-sm font-semibold text-[var(--color-gray-900)]">{metric.value}</p>
                      <p className="text-[10px] text-[var(--color-success)]">{metric.change}</p>
                    </div>
                  ))}
                </div>
                {/* Mini Chart */}
                <div className="h-24 bg-gradient-to-t from-[var(--color-primary-light)] to-transparent rounded-lg flex items-end justify-around px-2 pb-2">
                  {[35, 40, 55, 65, 82, 90].map((height, i) => (
                    <div
                      key={i}
                      className="w-4 md:w-6 bg-[var(--color-primary)] rounded-t-md opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
