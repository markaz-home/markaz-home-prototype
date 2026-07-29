import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Building2, Heart, Receipt, ArrowLeftRight } from 'lucide-react';
import { Alert, Button, Card, CardContent, cn } from '@markaz/ui';
import { isThreadActionable, isTerminal } from '@markaz/domain';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/server/session';
import { getServerApi } from '@/server/api';
import { formatAed } from '@/lib/format';
import { isFreshDashboard } from '@/lib/dashboard-state';
import { PropertyCard } from '@/components/marketplace/property-card';
import { OfferStatusBadge } from '@/components/offers/shared';

type ListingRow = {
  id: string;
  title: string | null;
  state: string;
  completedRequired: number;
  totalRequired: number;
  ready: boolean;
};

/** Resolve a settled promise, recording whether anything failed (§ partial load). */
function settled<T>(r: PromiseSettledResult<T>, fallback: T, failures: { any: boolean }): T {
  if (r.status === 'fulfilled') return r.value;
  failures.any = true;
  return fallback;
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const tt = await getTranslations('transactions');
  const session = await getSession();
  const api = await getServerApi();
  const name = session?.profile?.fullName?.split(' ')[0] ?? null;

  // One parallel read per workspace area. A single failing area degrades to its
  // empty state plus a partial-load notice — never a blank dashboard.
  const failures = { any: false };
  const [savedR, listingsR, buyerR, sellerR, txR, featuredR, savedIdsR, ownedIdsR] =
    await Promise.allSettled([
      api.marketplace.saved.list(),
      api.listing.list(),
      api.offers.getBuyerThreads(),
      api.offers.getSellerInbox(),
      api.transactions.listMine(),
      api.marketplace.featured(),
      api.marketplace.saved.publicIds(),
      api.marketplace.myLivePublicIds(),
    ]);

  const saved = settled(savedR, [], failures);
  // `listing.list` returns loosely-typed rows (see routers/listing/index.ts);
  // the wizard casts the same way.
  const listings = settled(listingsR, [], failures) as unknown as ListingRow[];
  const buyerThreads = settled(buyerR, [], failures);
  const sellerThreads = settled(sellerR, [], failures);
  const transactions = settled(txR, [], failures);
  const featured = settled(featuredR, [], failures);
  const savedIds = new Set(settled(savedIdsR, [] as string[], failures));
  const ownedIds = new Set(settled(ownedIdsR, [] as string[], failures));

  const openOffers = [...buyerThreads, ...sellerThreads].filter((th) =>
    isThreadActionable(th.status),
  );
  const activeTransactions = transactions.filter((x) => !isTerminal(x.status));
  const activeTx = activeTransactions[0] ?? null;
  const latestOffer =
    [...buyerThreads, ...sellerThreads].sort((a, b) =>
      b.lastActivityAt.localeCompare(a.lastActivityAt),
    )[0] ?? null;
  const draft = listings.find((l) => l.state !== 'LIVE' && !l.ready) ?? null;
  // Never recommend the customer their own listing (§20: you cannot offer on it).
  const recommended = featured.filter(
    (c): c is typeof c & { publicId: string } => !!c.publicId && !ownedIds.has(c.publicId),
  );

  const isFresh = isFreshDashboard(
    {
      saved: saved.length,
      listings: listings.length,
      buyerThreads: buyerThreads.length,
      sellerThreads: sellerThreads.length,
      transactions: transactions.length,
    },
    failures.any,
  );

  const stats = [
    {
      icon: Heart,
      label: t('savedProperties'),
      value: saved.length,
      href: '/saved-properties',
    },
    { icon: ArrowLeftRight, label: t('activeOffers'), value: openOffers.length, href: '/offers' },
    {
      icon: Receipt,
      label: t('activeTransactions'),
      value: activeTransactions.length,
      href: '/transactions',
    },
    { icon: Building2, label: t('myListings'), value: listings.length, href: '/sell' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-[11px] font-semibold uppercase tracking-[0.16em]">
            {t('eyebrow')}
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight">
            {name ? t('welcome', { name }) : t('welcomeNoName')}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild className="rounded-full">
            <Link href="/properties">{t('browseCta')}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/sell">{t('listCta')}</Link>
          </Button>
        </div>
      </div>

      {failures.any ? (
        <Alert variant="warning">
          <p className="text-sm">{t('summariesPartialError')}</p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="border-border/70 bg-card/40 hover:border-primary/40 rounded-lg border p-4 transition-colors"
          >
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </span>
            <span className="mt-2 block text-2xl font-semibold tabular-nums" dir="ltr">
              {value}
            </span>
          </Link>
        ))}
      </div>

      {isFresh ? (
        <Card className="bg-card/40">
          <CardContent className="space-y-3 pt-6">
            <h2 className="font-display text-xl">{t('freshTitle')}</h2>
            <p className="text-muted-foreground max-w-2xl text-sm">{t('freshBody')}</p>
            <Button asChild className="rounded-full">
              <Link href="/properties">
                {t('browseCta')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {draft ? (
        <Section title={t('continueListingTitle')}>
          <Link
            href={`/sell/listings/${draft.id}`}
            className="border-border/70 bg-card/40 hover:border-primary/40 block rounded-lg border p-5 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p dir="auto" className="truncate font-medium">
                  {draft.title ?? t('untitledListing')}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('listingProgress', {
                    completed: draft.completedRequired,
                    total: draft.totalRequired,
                  })}
                </p>
              </div>
              <span className="text-primary flex items-center gap-1 text-sm">
                {t('continueListingCta')}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </span>
            </div>
            <ProgressBar
              value={
                draft.totalRequired ? (draft.completedRequired / draft.totalRequired) * 100 : 0
              }
            />
          </Link>
        </Section>
      ) : null}

      {activeTx ? (
        <Section title={t('activeTransactionTitle')} href="/transactions" hrefLabel={t('viewAll')}>
          <Link
            href={`/transactions/${activeTx.id}`}
            className="border-border/70 bg-card/40 hover:border-primary/40 block rounded-lg border p-5 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p dir="auto" className="truncate font-medium">
                  {activeTx.property?.headline ?? '—'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {[
                    formatAed(activeTx.acceptedAmountAed, locale),
                    activeTx.property?.community,
                    activeTx.property?.emirate,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="text-start sm:text-end">
                <span className="border-primary/30 bg-primary/10 text-primary inline-block rounded-full border px-3 py-1 text-xs">
                  {tt(activeTx.statusKey)}
                </span>
                <p className="text-muted-foreground mt-1.5 text-xs">{tt(activeTx.nextActorKey)}</p>
              </div>
            </div>
            <ProgressBar
              value={
                activeTx.totalStages ? (activeTx.completedStages / activeTx.totalStages) * 100 : 0
              }
            />
            <p className="text-muted-foreground mt-2 text-[11px]">
              {tt('progress.stages', {
                completed: activeTx.completedStages,
                total: activeTx.totalStages,
              })}
            </p>
          </Link>
        </Section>
      ) : null}

      {latestOffer ? (
        <Section title={t('latestOfferTitle')} href="/offers" hrefLabel={t('viewAll')}>
          <Link
            href={`/offers/${latestOffer.threadId}`}
            className="border-border/70 bg-card/40 hover:border-primary/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors"
          >
            <div className="min-w-0">
              <p dir="auto" className="truncate text-sm font-medium">
                {latestOffer.property.headline}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t(latestOffer.perspective === 'BUYER' ? 'offerMadeBy' : 'offerReceivedOn', {
                  amount: formatAed(latestOffer.currentProposal?.amountAed ?? 0, locale),
                })}
              </p>
            </div>
            <OfferStatusBadge statusKey={latestOffer.statusKey} />
          </Link>
        </Section>
      ) : null}

      {recommended.length > 0 ? (
        <Section title={t('recommendedTitle')} href="/properties" hrefLabel={t('seeAll')}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((card) => (
              <PropertyCard
                key={card.publicId}
                card={card}
                isAuthenticated
                saved={savedIds.has(card.publicId)}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em]">{title}</h2>
        {href && hrefLabel ? (
          <Link href={href} className="text-primary flex items-center gap-1 text-xs">
            {hrefLabel}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn('bg-foreground/10 mt-4 h-1.5 w-full overflow-hidden rounded-full', className)}
    >
      <div className="bg-primary h-full rounded-full" style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}
