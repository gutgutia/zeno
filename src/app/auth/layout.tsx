import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

// Prevent search engines from indexing auth pages
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Marketing (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--color-gray-50)] relative flex-col justify-between p-16 overflow-hidden border-r border-[var(--color-gray-100)]">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-[var(--color-primary-light)] blur-[100px] opacity-60" />
          <div className="absolute bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-primary-light)] blur-[80px] opacity-40" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full justify-between">
          {/* Logo */}
          <div>
            <Link href="/" className="inline-block">
              <Image
                src="/brand/logo-primary.svg"
                alt="Zeno"
                width={151}
                height={66}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Main Message */}
          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight mb-6 text-[var(--color-gray-900)]">
              Paste data.
              <br />
              Get a dashboard.
              <br />
              <span className="text-[var(--color-primary)]">Share in seconds.</span>
            </h2>
            <p className="text-lg text-[var(--color-gray-600)]">
              Join the professionals who use Zeno to turn messy spreadsheets into beautiful, shareable insights without writing code.
            </p>
          </div>

          {/* Footer - Copyright */}
          <div className="text-sm text-[var(--color-gray-500)]">
             &copy; {new Date().getFullYear()} Zeno. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo (visible only on small screens) */}
          <div className="lg:hidden mb-8 text-center flex justify-center">
            <Link href="/" className="inline-block">
              <Image
                src="/brand/logo-primary.svg"
                alt="Zeno"
                width={151}
                height={66}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  );
}

