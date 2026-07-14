'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Card,
  CardContent,
  EmptyState,
  Label,
  Skeleton,
} from '@markaz/ui';
import {
  normalizeAmountInput,
  validateOfferAmount,
  offerComparison,
  offerWarning,
  expiryFromOption,
  EXPIRY_OPTIONS,
  DEFAULT_EXPIRY_OPTION,
  type ExpiryOption,
} from '@markaz/domain';
import { useRouter, Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed } from '@/lib/format';
import { AmountComparison, NonBindingDisclosure, useOfferErrorMessage } from './shared';

type Step = 'form' | 'review';

/** Buyer offer creation: amount → review → submit (offers-design-spec §13–15). */
export function OfferForm({ publicId, slug }: { publicId: string; slug: string }) {
  const t = useTranslations('offers');
  const tv = useTranslations('offers.validation');
  const locale = useLocale();
  const router = useRouter();
  const errMsg = useOfferErrorMessage();

  const eligibility = trpc.offers.eligibility.useQuery({ publicId });
  const submit = trpc.offers.submitInitialProposal.useMutation();

  const [raw, setRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryOption>(DEFAULT_EXPIRY_OPTION);
  const [step, setStep] = useState<Step>('form');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const amount = useMemo(() => normalizeAmountInput(raw), [raw]);
  const asking = eligibility.data?.eligible ? eligibility.data.property?.askingPriceAed ?? null : null;
  const amountError = touched ? validateOfferAmount(amount) : null;
  const comparison = amount != null && asking ? offerComparison(amount, asking) : null;
  const warning = amount != null && asking ? offerWarning(amount, asking) : null;
  const expiresPreview = expiry === 'none' ? null : expiryFromOption(expiry, new Date());

  if (eligibility.isLoading) {
    return (
      <div className="container max-w-[1180px] py-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  // Ineligible states (§12.3 / §14).
  if (!eligibility.data?.eligible) {
    const reason = eligibility.data?.reason ?? 'UNAVAILABLE';
    if (reason === 'ACTIVE_THREAD' && eligibility.data && 'threadId' in eligibility.data) {
      return (
        <IneligiblePanel
          title={t('eligibility.activeThread')}
          body={t('eligibility.activeThreadBody')}
          action={<Button asChild><Link href={`/offers/${eligibility.data.threadId}`}>{t('cta.view')}</Link></Button>}
        />
      );
    }
    const map: Record<string, string> = {
      OWNER: t('eligibility.ownListing'),
      UNAVAILABLE: t('eligibility.unavailable'),
      UNDER_OFFER: t('eligibility.underOffer'),
      ONBOARDING: t('eligibility.onboarding'),
    };
    return (
      <IneligiblePanel
        title={t('error.notAvailableTitle')}
        body={map[reason] ?? t('eligibility.unavailable')}
        action={<Button asChild variant="outline"><Link href={`/properties/${publicId}/${slug}`}>{t('closed.viewProperty')}</Link></Button>}
      />
    );
  }

  const property = eligibility.data.property;

  async function onSubmit() {
    setSubmitError(null);
    try {
      const res = await submit.mutateAsync({ publicId, amountAed: amount!, expiry });
      router.replace(`/offers/${res!.threadId}`);
    } catch (e) {
      setSubmitError(errMsg(e));
      setStep('form');
    }
  }

  return (
    <div className="container max-w-[1180px] py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href={`/properties/${publicId}/${slug}`} className="hover:text-foreground">{property?.headline ?? '—'}</Link>
        <span> · {step === 'review' ? t('review.title') : t('form.title')}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="max-w-[720px] space-y-6">
          <header>
            <h1 className="text-2xl font-semibold">{step === 'review' ? t('review.title') : t('form.title')}</h1>
            <p className="mt-1 text-muted-foreground">{step === 'review' ? t('review.description') : t('form.description')}</p>
          </header>

          {submitError ? <Alert variant="destructive">{submitError}</Alert> : null}

          {step === 'form' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (!validateOfferAmount(amount)) setStep('review');
              }}
              noValidate
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="offer-amount">{t('form.amount')}</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 focus-within:ring-2 focus-within:ring-ring">
                  <span className="select-none font-medium text-muted-foreground" aria-hidden>AED</span>
                  <input
                    id="offer-amount"
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder={t('form.placeholder')}
                    aria-describedby="offer-asking offer-comparison offer-amount-error"
                    aria-invalid={!!amountError}
                    className="h-12 flex-1 bg-transparent text-lg tabular-nums outline-none"
                  />
                </div>
                <p id="offer-asking" className="text-sm text-muted-foreground">
                  {t('form.asking', { amount: formatAed(asking, locale).replace('AED ', '') })}
                </p>
                <div id="offer-comparison"><AmountComparison comparison={comparison} /></div>
                {amountError ? (
                  <p id="offer-amount-error" role="alert" className="text-sm text-destructive">
                    {amountError === 'REQUIRED' ? tv('required') : amountError === 'POSITIVE' ? tv('zero') : amountError === 'INTEGER' ? tv('decimals') : tv('max')}
                  </p>
                ) : null}
              </div>

              {warning ? (
                <Alert variant="warning" role="status">
                  <p>{warning === 'LOW' ? t('warning.low') : t('warning.high')}</p>
                </Alert>
              ) : null}

              <fieldset className="space-y-2">
                <Label htmlFor="offer-expiry">{t('form.expiry')}</Label>
                <select
                  id="offer-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryOption)}
                  className="h-11 w-full rounded-md border bg-background px-3"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{t(`expiry.${o === '48h' ? 'h48' : o === '3d' ? 'd3' : o === '7d' ? 'd7' : 'none'}` as 'expiry.d7')}</option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  {t('form.expiryHelp')}
                  {expiresPreview ? <> · {t('form.validUntil', { date: expiresPreview.toLocaleString(locale) })}</> : null}
                </p>
              </fieldset>

              <NonBindingDisclosure />

              <div className="flex gap-3">
                <Button type="submit">{t('form.review')}</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/properties/${publicId}/${slug}`}>{t('form.cancel')}</Link>
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <Row label={t('askingPrice')} value={formatAed(asking, locale)} />
                  <Row label={t('form.amount')} value={formatAed(amount, locale)} bold />
                  <Row
                    label={comparison?.direction === 'BELOW' ? t('form.belowAsking', { amount: formatAed(comparison.absDiff, locale) }) : comparison?.direction === 'ABOVE' ? t('form.aboveAsking', { amount: formatAed(comparison.absDiff, locale) }) : t('form.matches')}
                    value=""
                  />
                  <Row label={t('form.expiry')} value={expiresPreview ? expiresPreview.toLocaleString(locale) : t('form.noExpiry')} />
                </CardContent>
              </Card>
              <NonBindingDisclosure />
              <div className="flex gap-3">
                <Button onClick={onSubmit} loading={submit.isPending}>
                  {submit.isPending ? t('review.submitting') : t('review.submit')}
                </Button>
                <Button variant="outline" onClick={() => setStep('form')} disabled={submit.isPending}>
                  {t('review.edit')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky property summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {property?.coverUrl ? (
                <img src={property.coverUrl} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
              ) : null}
              <p className="text-lg font-semibold">{formatAed(asking, locale)}</p>
              <p className="font-medium" dir="auto">{property?.headline}</p>
              <p className="text-sm text-muted-foreground">{[property?.community, property?.emirate].filter(Boolean).join(' · ')}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function IneligiblePanel({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="container max-w-[680px] py-12">
      <EmptyState title={title} description={body} action={action} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={bold ? 'text-lg font-semibold' : 'font-medium'} dir="ltr">{value}</span>
    </div>
  );
}
