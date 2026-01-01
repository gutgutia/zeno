import { type ReactNode } from 'react';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ContainerProps {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'main';
}

const sizeStyles: Record<ContainerSize, string> = {
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1280px]',
  '2xl': 'max-w-[1440px]',
};

export function Container({
  children,
  size = 'xl',
  className = '',
  as: Component = 'div',
}: ContainerProps) {
  return (
    <Component
      className={`
        mx-auto w-full px-6 md:px-8
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </Component>
  );
}
