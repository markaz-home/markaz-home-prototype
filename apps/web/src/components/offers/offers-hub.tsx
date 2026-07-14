'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from '@markaz/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed, formatPct } from '@/lib/format';
import { OfferStatusBadge } from './shared';

type View = 'made' | 'received';
const BUYER_FILTERS = ['all', 'action', 'waiting', 'accepted', 'closed'] as const;
const SELLER_FILTERS = [
  'all',
  'action',
  'waiting',
  'aboveThreshold',
  'belowThreshold',
  'accepted',
  'closed',
] as const;

/** Unified Offers hub with Made / Received tabs (offers-design-spec §16–17). */
export function OffersHub({ initialView }: { initialView: View }) {
  const t = useTranslations('offers');
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as View);
          router.replace(`/offers?view=${v}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="made">{t('tabMade')}</TabsTrigger>
          <TabsTrigger value="received">{t('tabReceived')}</TabsTrigger>
        </TabsList>
        {/* Panels are force-mounted so each trigger's aria-controls always resolves
            (valid ARIA); content stays lazy so only the active view fetches. */}
        <TabsContent value="made" forceMount hidden={view !== 'made'}>
          {view === 'made' ? <BuyerList /> : null}
        </TabsContent>
        <TabsContent value="received" forceMount hidden={view !== 'received'}>
          {view === 'received' ? <SellerList /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterRow({
  filters,
  value,
  onChange,
}: {
  filters: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('offers');
  const labelKey: Record<string, string> = {
    all: 'filterAll',
    action: 'filterAction',
    waiting: 'filterWaiting',
    accepted: 'filterAccepted',
    closed: 'filterClosed',
    aboveThreshold: 'filterAboveThreshold',
    belowThreshold: 'filterBelowThreshold',
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('title')}>
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          aria-pressed={value === f}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm',
            value === f
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(labelKey[f] as 'filterAll')}
        </button>
      ))}
    </div>
  );
}

function BuyerList() {
  const t = useTranslations('offers');
  const [filter, setFilter] = useState<(typeof BUYER_FILTERS)[number]>('all');
  const q = trpc.offers.getBuyerThreads.useQuery({ filter });

  return (
    <div className="space-y-4">
      <FilterRow filters={BUYER_FILTERS} value={filter} onChange={(v) => setFilter(v as 'all')} />
      {q.isLoading ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState
          title={t('error.generic')}
          retryLabel={t('realtime.refresh')}
          onRetry={() => q.refetch()}
        />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          title={t('buyerEmptyTitle')}
          description={t('buyerEmptyBody')}
          action={
            <Button asChild>
              <Link href="/properties">{t('browse')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="sr-only" role="status">
            {t('resultCount', { count: q.data.length })}
          </p>
          <ul className="space-y-3">
            {q.data.map((th) => (
              <li key={th.threadId}>
                <OfferCard thread={th} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SellerList() {
  const t = useTranslations('offers');
  const [filter, setFilter] = useState<(typeof SELLER_FILTERS)[number]>('all');
  const q = trpc.offers.getSellerInbox.useQuery({ filter });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t('sellerTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('sellerDescription')}</p>
      </div>
      <FilterRow filters={SELLER_FILTERS} value={filter} onChange={(v) => setFilter(v as 'all')} />
      {q.isLoading ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState
          title={t('error.generic')}
          retryLabel={t('realtime.refresh')}
          onRetry={() => q.refetch()}
        />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState title={t('sellerEmptyTitle')} description={t('sellerEmptyBody')} />
      ) : (
        <>
          <p className="sr-only" role="status">
            {t('resultCount', { count: q.data.length })}
          </p>
          <ul className="space-y-3">
            {q.data.map((th) => (
              <li key={th.threadId}>
                <OfferCard thread={th} seller />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface CardThread {
  threadId: string;
  statusKey: string;
  isActionable: boolean;
  lastActivityAt: string;
  property: {
    headline: string;
    askingPriceAed: number | null;
    community: string | null;
    emirate: string | null;
    coverUrl: string | null;
  };
  currentProposal: { amountAed: number } | null;
  comparison: { pct: number; direction: 'BELOW' | 'ABOVE' | 'EQUAL' } | null;
  buyerLabel?: string;
  threshold?: 'AT_OR_ABOVE' | 'BELOW' | null;
}

function OfferCard({ thread, seller = false }: { thread: CardThread; seller?: boolean }) {
  const t = useTranslations('offers');
  const tt = useTranslations('offers.threshold');
  const locale = useLocale();
  const p = thread.property;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="h-20 w-28 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="bg-muted h-20 w-28 shrink-0 rounded-md" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge statusKey={thread.statusKey} />
            {seller && thread.buyerLabel ? (
              <span className="text-muted-foreground text-sm">
                {t('buyerLabel', { n: thread.buyerLabel })} · {t('verifiedCustomer')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-medium" dir="auto">
            {p.headline}
          </p>
          <p className="text-muted-foreground text-sm">
            {[p.community, p.emirate].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm">
            {thread.currentProposal ? (
              <span className="font-semibold tabular-nums" dir="ltr">
                {formatAed(thread.currentProposal.amountAed, locale)}
              </span>
            ) : null}
            <span className="text-muted-foreground" dir="ltr">
              {t('askingPrice')}: {formatAed(p.askingPriceAed, locale)}
            </span>
            {thread.comparison && thread.comparison.direction !== 'EQUAL' ? (
              <span className="text-muted-foreground" dir="ltr">
                {thread.comparison.direction === 'BELOW' ? '−' : '+'}
                {formatPct(thread.comparison.pct, locale)}
              </span>
            ) : null}
          </div>
          {seller && thread.threshold ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {thread.threshold === 'AT_OR_ABOVE' ? tt('above') : tt('below')}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          <Button asChild variant={thread.isActionable ? 'default' : 'outline'}>
            <Link href={`/offers/${thread.threadId}`}>
              {thread.isActionable ? t('reviewOffer') : t('viewOffer')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}
