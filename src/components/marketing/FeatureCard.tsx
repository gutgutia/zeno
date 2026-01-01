import { cn } from "@/lib/utils";

interface FeatureCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function FeatureCard({
  children,
  className,
  hover = false,
  padding = 'md',
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-[var(--color-gray-100)] shadow-sm',
        paddingClasses[padding],
        hover && 'transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}
