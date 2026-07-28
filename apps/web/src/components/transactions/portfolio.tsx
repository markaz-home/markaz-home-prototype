'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Building2 } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed, formatDateTime } from '@/lib/format';
import type { RouterOutputs } from '@/trpc/types';

type Item = RouterOutputs['transactions']['listMine'][number];

/**
 * Everything this account completed — bought and sold in one place.
 *
 * Deliberately journey-neutral: one customer both buys and sells here, so a
 * buyer-framed "My purchases" would leave a completed sale homeless. Each row
 * links to its completion summary in the transaction workspace, which stays the
 * single source of the record — this is a way in, not a second copy of it.
 */
export function Portfolio() {
  const t = useTranslations('portfolio');
  const tt = useTranslations('transactions');
  const locale = useLocale();
  const list = trpc.transactions.listMine.useQuery();

  const completed = (list.data ?? [])
    .filter((x) => x.status === 'COMPLETED_DEMO')
    .sort((a, b) =>
      (b.completedAt ?? b.lastActivityAt).localeCompare(a.completedAt ?? a.lastActivityAt),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {list.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title={tt('loadError.title')} description={tt('loadError.body')} />
      ) : completed.length === 0 ? (
        <EmptyState
          icon={<Building2 className="text-primary h-7 w-7" aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Button asChild className="rounded-full">
              <Link href="/properties">{t('browse')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {completed.map((item) => (
            <li key={item.id}>
              <PortfolioRow item={item} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PortfolioRow({ item, locale }: { item: Item; locale: string }) {
  const t = useTranslations('portfolio');
  const tt = useTranslations('transactions');
  const bought = item.perspective === 'BUYER';

  return (
    <Link
      href={`/transactions/${item.id}`}
      className="border-border/70 bg-card/40 hover:border-primary/40 flex flex-wrap items-center gap-4 rounded-lg border p-5 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={bought ? 'border-primary/40 bg-primary/10 text-primary' : undefined}
          >
            {bought ? t('bought') : t('sold')}
          </Badge>
          <span className="text-muted-foreground text-xs" dir="ltr">
            {item.reference}
          </span>
        </div>
        <p dir="auto" className="mt-2 truncate font-medium">
          {item.property?.headline ?? '—'}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {[item.property?.community, item.property?.emirate].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="text-end">
        <p className="text-primary text-lg font-semibold tabular-nums" dir="ltr">
          {formatAed(item.acceptedAmountAed, locale)}
        </p>
        {item.completedAt ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {tt('summary.completedOn')} {formatDateTime(item.completedAt, locale)}
          </p>
        ) : null}
      </div>

      <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
