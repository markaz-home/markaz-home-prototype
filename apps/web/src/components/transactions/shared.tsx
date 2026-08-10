'use client';

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
