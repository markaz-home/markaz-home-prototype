import Image from 'next/image';
import { cn } from '@markaz/ui';

/**
 * The operations portal uses the same copper wordmark as the customer product;
 * the adjacent Operations label distinguishes the internal workspace.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/markaz-logo-gold.png"
      alt="Markaz"
      width={448}
      height={112}
      priority
      className={cn('h-7 w-auto', className)}
    />
  );
}
