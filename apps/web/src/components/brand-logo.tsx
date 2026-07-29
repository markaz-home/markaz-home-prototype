import Image from 'next/image';
import { cn } from '@markaz/ui';

/**
 * Markaz copper wordmark for public and authentication headers. The `alt`
 * carries the brand name as the accessible text fallback. Intrinsic ratio is
 * 4:1; height is controlled via `className`.
 */
export function BrandLogo({
  className,
  variant = 'gold',
  priority = true,
}: {
  className?: string;
  variant?: 'gold' | 'blue';
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === 'blue' ? '/logo-web.png' : '/markaz-logo-gold.png'}
      alt="Markaz Home"
      width={variant === 'blue' ? 2507 : 448}
      height={variant === 'blue' ? 628 : 112}
      priority={priority}
      className={cn('h-10 w-auto md:h-12', className)}
    />
  );
}
