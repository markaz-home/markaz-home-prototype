'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button, Card, CardContent } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { formatAed, formatDateTime } from '@/lib/format';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['transactions']['get'];

/**
 * The record of a completed transaction — what was agreed, by whom, and when.
 *
 * Completion was previously a single sentence, which left the journey ending
 * with nothing to look back at. Everything here is already in the workspace DTO:
 * confirmation times come from the timeline events rather than a new query, and
 * the other participant's documents stay reduced to a count (their files are
 * never listed to the counterparty).
 */
export function CompletionSummary({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const ts = useTranslations('transactions.summary');
  const locale = useLocale();

  const confirmations = d.timeline.filter((e) => e.type === 'COMPLETION_CONFIRMED');
  const buyerAt = confirmations.find((e) => e.actor === 'BUYER')?.createdAt ?? null;
  const sellerAt = confirmations.find((e) => e.actor === 'SELLER')?.createdAt ?? null;
  const completedAt = d.timeline.find((e) => e.type === 'COMPLETED_DEMO')?.createdAt ?? null;
  const documentCount = d.ownDocuments.length + Object.keys(d.otherChecklist).length;

  const rows: Array<{ label: string; value: string }> = [
    // The headline already carries the community, and the page header repeats
    // the location — so this row is the headline alone.
    { label: ts('property'), value: d.property?.headline ?? '—' },
    { label: ts('side'), value: d.perspective === 'BUYER' ? t('buying') : t('selling') },
    { label: ts('amount'), value: formatAed(d.acceptedAmountAed, locale) },
  ];
  if (d.purchaseRoute) {
    rows.push({
      label: ts('route'),
      value: t(d.purchaseRoute === 'CASH' ? 'route.cash' : 'route.financing'),
    });
  }
  if (d.depositAmountAed != null) {
    rows.push({ label: ts('deposit'), value: formatAed(d.depositAmountAed, locale) });
  }
  if (d.transferAppointmentAt) {
    rows.push({ label: ts('appointment'), value: formatDateTime(d.transferAppointmentAt, locale) });
  }
  rows.push({ label: ts('reference'), value: d.reference });
  rows.push({ label: ts('documents'), value: ts('documentsCount', { count: documentCount }) });

  return (
    <Card className="bg-card/40">
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="border-primary/30 bg-primary/10 grid h-12 w-12 shrink-0 place-items-center rounded-full border"
          >
            <CheckCircle2 className="text-primary h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-medium">{t('completion.successTitle')}</h2>
            {completedAt ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {ts('completedOn')} {formatDateTime(completedAt, locale)}
              </p>
            ) : null}
          </div>
        </div>

        <section>
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            {ts('heading')}
          </h3>
          <dl className="mt-3 text-sm">
            {rows.map((row) => (
              <div
                key={row.label}
                className="border-border/60 flex flex-wrap items-baseline justify-between gap-3 border-b py-2.5 last:border-0"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium" dir="auto">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {buyerAt || sellerAt ? (
          <section>
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
              {ts('confirmations')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { label: ts('buyerConfirmed'), at: buyerAt },
                { label: ts('sellerConfirmed'), at: sellerAt },
              ]
                .filter((c) => c.at)
                .map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5">
                    <CheckCircle2 className="text-primary h-4 w-4 shrink-0" aria-hidden />
                    <span>{c.label}</span>
                    <span className="text-muted-foreground ms-auto text-xs">
                      {formatDateTime(c.at, locale)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs leading-relaxed">
          {t('completion.successBody')}
        </p>

        <Button asChild variant="outline">
          <Link href="/transactions">{ts('backToTransactions')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
