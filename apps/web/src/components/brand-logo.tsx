import Image from 'next/image';
import { cn } from '@markaz/ui';

/**
 * Markaz copper wordmark for public and authentication headers. The `alt`
 * carries the brand name as the accessible text fallback. Intrinsic ratio is
 * 4:1; height is controlled via `className`.
 */
export function BrandLogo({
  className,
  priority = true,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/markaz-logo-gold.png"
      alt="Markaz Home"
      width={448}
      height={112}
      priority={priority}
      className={cn('h-10 w-auto md:h-12', className)}
    />
  );
}
