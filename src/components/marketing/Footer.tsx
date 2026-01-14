import Link from 'next/link';
import { Container } from '@/components/ui';

const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Examples', href: '/examples' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
    ],
  },
};

export function Footer() {
  return (
    <footer className="bg-[var(--color-gray-50)] border-t border-[var(--color-gray-100)]">
      <Container size="2xl">
        <div className="py-16">
          {/* Main Footer Content */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="inline-block mb-4">
                <img
                  src="/logo.svg"
                  alt="Zeno"
                  className="h-6"
                />
              </Link>
              <p className="text-sm text-[var(--color-gray-600)]">
                Beautiful dashboards in seconds.
              </p>
            </div>

            {/* Link Columns */}
            {Object.values(footerLinks).map((section) => (
              <div key={section.title}>
                <h4 className="font-semibold text-[var(--color-gray-900)] mb-4">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-[var(--color-gray-200)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-gray-500)]">
              &copy; {new Date().getFullYear()} Zeno. All rights reserved.
            </p>
            <p className="text-sm text-[var(--color-gray-500)]">
              Made with care for people who want to look good.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
