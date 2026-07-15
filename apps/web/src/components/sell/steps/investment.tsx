'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { investmentCaseSchema } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import {
  WizardShell,
  WizardLoading,
  ListingUnavailable,
  formatAed,
  type WizardListing,
} from '../wizard';
import { useListing, type GetData } from './step-shared';

// --- Investment Case (optional) ---------------------------------------------
export function InvestmentStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  return <InvestmentInner key={listingId} listingId={listingId} data={get.data} />;
}
function InvestmentInner({ listingId, data }: { listingId: string; data: GetData }) {
  const t = useTranslations('investment');
  const router = useRouter();
  const utils = trpc.useUtils();
  const ic = data.investmentCase;
  const [adding, setAdding] = useState(!!ic);
  const [orig, setOrig] = useState(
    ic?.originalPurchasePriceAed != null ? String(ic.originalPurchasePriceAed) : '',
  );
  const [date, setDate] = useState(ic?.purchaseDate ?? '');
  const [reno, setReno] = useState(
    ic?.renovationCostsAed != null ? String(ic.renovationCostsAed) : '0',
  );
  const [visible, setVisible] = useState(ic?.visible ?? false);
  const [error, setError] = useState<string | null>(null);
  const save = trpc.listing.investment.save.useMutation();
  const skip = trpc.listing.investment.skip.useMutation();

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (data.askingPriceAed == null) return setError(t('errNeedAsking'));
    const parsed = investmentCaseSchema.safeParse({
      originalPurchasePriceAed: Number(orig.replace(/,/g, '')),
      renovationCostsAed: Number(reno.replace(/,/g, '') || '0'),
      purchaseDate: date,
      visible,
    });
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setError(
        code === 'renovation_negative'
          ? t('errRenovation')
          : code === 'purchase_date_future'
            ? t('errDateFuture')
            : t('errAmount'),
      );
      return;
    }
    await save.mutateAsync({ listingId, ...parsed.data });
    router.push(`/sell/listings/${listingId}/form-a`);
  }

  return (
    <WizardShell listing={data as unknown as WizardListing} current="investment-case">
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {t('stepLabel')}
          </p>
          <h1 className="font-display text-brand-900 mt-1 text-2xl font-medium">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Alert variant="info">{t('privacyNote')}</Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {!adding ? (
          <div className="flex gap-3">
            <Button onClick={() => setAdding(true)}>{t('add')}</Button>
            <Button
              variant="outline"
              loading={skip.isPending}
              onClick={async () => {
                await skip.mutateAsync({ listingId });
                router.push(`/sell/listings/${listingId}/form-a`);
              }}
            >
              {t('skip')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSave} className="space-y-5">
            <FormField id="orig" label={t('originalPrice')} required>
              <Input
                id="orig"
                inputMode="numeric"
                dir="ltr"
                value={orig}
                onChange={(e) => setOrig(e.target.value)}
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('originalHelp')}</p>
            </FormField>
            <FormField id="date" label={t('purchaseDate')} required>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <p className="text-muted-foreground mt-1 text-xs">{t('purchaseDateHelp')}</p>
            </FormField>
            <FormField id="reno" label={t('renovation')}>
              <Input
                id="reno"
                inputMode="numeric"
                dir="ltr"
                value={reno}
                onChange={(e) => setReno(e.target.value)}
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('renovationHelp')}</p>
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              <span>{t('showOnListing')}</span>
            </label>
            {ic ? (
              <div className="rounded-lg border p-4 text-sm">
                <p className="mb-2 font-medium">{t('summaryTitle')}</p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">{t('totalInvested')}</dt>
                  <dd>{formatAed(ic.totalInvestedAed)}</dd>
                  <dt className="text-muted-foreground">{t('estimatedGain')}</dt>
                  <dd>{formatAed(ic.estimatedGainAed)}</dd>
                  <dt className="text-muted-foreground">{t('estimatedRoi')}</dt>
                  <dd>{ic.estimatedRoiPct != null ? `${ic.estimatedRoiPct}%` : '—'}</dd>
                  <dt className="text-muted-foreground">{t('annualised')}</dt>
                  <dd>
                    {ic.estimatedAnnualisedReturnPct != null
                      ? `${ic.estimatedAnnualisedReturnPct}%`
                      : t('annualisedUnavailable')}
                  </dd>
                  <dt className="text-muted-foreground">{t('pricePerSqft')}</dt>
                  <dd>{formatAed(ic.pricePerSqftAed)}</dd>
                </dl>
                <p className="text-muted-foreground mt-2 text-xs">{t('disclaimer')}</p>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-4">
              <Button
                type="button"
                variant="outline"
                loading={skip.isPending}
                onClick={async () => {
                  await skip.mutateAsync({ listingId });
                  await utils.listing.get.invalidate({ listingId });
                  router.push(`/sell/listings/${listingId}/form-a`);
                }}
              >
                {t('skip')}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t('save')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </WizardShell>
  );
}
