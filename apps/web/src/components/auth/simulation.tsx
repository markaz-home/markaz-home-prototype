import { cn } from '@markaz/ui';

type ChipTone = 'pending' | 'verified' | 'failed';
/** Demo status chip — text always carries the state, not colour alone. */
export function DemoChip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'verified' && 'bg-success/15 text-success',
        tone === 'pending' && 'bg-warning/15 text-warning',
        tone === 'failed' && 'bg-destructive/15 text-destructive',
      )}
    >
      {children}
    </span>
  );
}
