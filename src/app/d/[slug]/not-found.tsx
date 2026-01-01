import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-gray-50)] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[var(--color-gray-300)] mb-4">404</h1>
        <h2 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
          Dashboard Not Found
        </h2>
        <p className="text-[var(--color-gray-600)] mb-6">
          This dashboard doesn&apos;t exist or is not published.
        </p>
        <Link href="/">
          <Button>Go to Homepage</Button>
        </Link>
      </div>
    </div>
  );
}
