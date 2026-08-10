'use client';

import { usePathname } from '@/i18n/navigation';
import { cn } from '@markaz/ui';

/**
 * Keeps route changes calm without delaying navigation. The keyed wrapper only
 * animates the page content; persistent headers, sidebars and footers stay put.
 */
export function RouteTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={cn('route-content min-w-0', className)}>
      {children}
    </div>
  );
}
