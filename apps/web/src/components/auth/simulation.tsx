import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@markaz/ui';

/** Persistent UAE PASS demo disclosure (design spec §16.2). */
export function DemoDisclosure() {
  const t = useTranslations('identity');
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-brand-100 p-3 text-sm text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>
        <span className="font-medium">{t('disclosureTitle')}</span> {t('disclosureBody')}
      </p>
    </div>
  );
}

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
