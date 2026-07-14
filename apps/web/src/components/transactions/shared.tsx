'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/trpc/react';

/** Nav action-needed badge — derives from authoritative task state (spec §34.4). */
export function TransactionsNavBadge() {
  const counts = trpc.transactions.getActionCounts.useQuery(undefined, { refetchInterval: 60_000 });
  const n = counts.data?.actionNeeded ?? 0;
  if (n <= 0) return null;
  return (
    <span
      className="bg-primary text-primary-foreground ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
      aria-hidden
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Persistent simulation disclosure — information treatment, not a warning (spec §4). */
export function SimulationDisclosure() {
  const t = useTranslations('transactions.disclosure');
  return (
    <div className="border-primary/20 bg-primary/5 flex items-start gap-3 rounded-lg border p-4 text-sm">
      <Info className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">{t('title')}</span>
        {' — '}
        <span className="text-muted-foreground">{t('body')}</span>
      </p>
    </div>
  );
}
