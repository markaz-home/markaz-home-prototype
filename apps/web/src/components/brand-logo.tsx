import Image from 'next/image';
import { cn } from '@markaz/ui';

/**
 * MARKAZ wordmark for headers (the approved "Architectural Blue" logo,
 * `public/logo-web.png`). The `alt` carries the brand name as the accessible
 * text fallback. Intrinsic ratio is 4:1; height is controlled via `className`.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-web.png"
      alt="MARKAZ Home"
      width={448}
      height={112}
      priority
      data-brand-logo
      className={cn('h-10 w-auto md:h-12', className)}
    />
  );
}
