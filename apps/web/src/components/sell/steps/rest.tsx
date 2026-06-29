'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldAlert, Loader2, UploadCloud, Star, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { listingSettingsSchema, investmentCaseSchema } from '@markaz/domain';
import { Alert, Badge, Button, FormField, Input, cn } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { trpc } from '@/trpc/react';
import { useRouter, Link } from '@/i18n/navigation';
import {
  WizardShell,
  WizardLoading,
  ListingUnavailable,
  SimDisclosure,
  SectionBadge,
  formatAed,
  type WizardListing,
} from '../wizard';
import {
  OWNERSHIP_BUCKET,
  DRAFT_PHOTO_BUCKET,
  buildObjectPath,
  uploadObject,
  getSignedUrls,
} from '@/lib/listing-storage';
import { useAutosave } from '../use-autosave';

const numOrNull = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return v.trim() === '' || Number.isNaN(n) ? null : n;
};

import type { ListingDetail } from '@/trpc/types';
type GetData = ListingDetail;
const supabase = () => createSupabaseBrowserClient();

function useListing(listingId: string) {
  // Always refetch on mount: wizard data changes via mutations + simulation polls,
  // so each step must reflect the authoritative server state (incl. readiness).
  return trpc.listing.get.useQuery({ listingId }, { staleTime: 0 });
}
function StepHeader({ ns }: { ns: 'ownership' | 'verification' | 'settings' | 'investment' | 'formA' | 'photos' | 'permit' | 'review' }) {
  const t = useTranslations(ns);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('stepLabel')}</p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-brand-900">{t('title')}</h1>
      <p className="mt-1 text-muted-foreground">{t('description')}</p>
    </div>
  );
}

// --- Ownership document -----------------------------------------------------
export function OwnershipStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  return <OwnershipInner key={listingId} listingId={listingId} data={get.data} />;
}
function OwnershipInner({ listingId, data }: { listingId: string; data: GetData }) {
  const t = useTranslations('ownership');
  const tl = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const register = trpc.listing.document.register.useMutation();
  const remove = trpc.listing.document.remove.useMutation();
  const [docType, setDocType] = useState<'TITLE_DEED' | 'OQOOD'>((data.document?.documentType as never) ?? 'TITLE_DEED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return setError(t('errUnsupported'));
    if (file.size > 10 * 1024 * 1024) return setError(t('errTooLarge'));
    setBusy(true);
    try {
      const path = buildObjectPath(listingId, 'doc', file.name);
      await uploadObject(supabase(), OWNERSHIP_BUCKET, path, file);
      await register.mutateAsync({ listingId, documentType: docType, storagePath: path, originalName: file.name, contentType: file.type, sizeBytes: file.size });
      await utils.listing.get.invalidate({ listingId });
    } catch {
      setError(t('errUpload'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardShell listing={data as unknown as WizardListing} current="ownership" autosave={busy ? 'saving' : 'idle'}>
      <div className="space-y-6">
        <StepHeader ns="ownership" />
        <Alert variant="warning" title={t('safetyTitle')}>{t('safetyBody')}</Alert>
        <FormField id="docType" label={t('titleDeed') + ' / ' + t('oqood')}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['TITLE_DEED', 'OQOOD'] as const).map((d) => (
              <button type="button" key={d} onClick={() => setDocType(d)} aria-pressed={docType === d} className={cn('rounded-md border p-3 text-start text-sm', docType === d ? 'border-primary bg-brand-100' : 'border-input')}>
                <span className="font-medium">{t(d === 'TITLE_DEED' ? 'titleDeed' : 'oqood')}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t(d === 'TITLE_DEED' ? 'titleDeedHelp' : 'oqoodHelp')}</span>
              </button>
            ))}
          </div>
        </FormField>
        <Alert variant="info" title={t('privateTitle')}>{t('privateBody')}</Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {data.document ? (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">{data.document.originalName ?? 'document'}</p>
            <p className="text-xs text-success">{t('uploaded')}</p>
            <div className="mt-3 flex gap-2">
              <label className="cursor-pointer">
                <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm">{t('replace')}</span>
              </label>
              <Button variant="outline" size="sm" loading={remove.isPending} onClick={async () => { await remove.mutateAsync({ listingId }); await utils.listing.get.invalidate({ listingId }); }}>{t('remove')}</Button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">{busy ? t('uploading') : t('uploadCta')}</span>
            <span className="mt-1 text-xs text-muted-foreground">{t('uploadHint')}</span>
            <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button disabled={!data.document} onClick={() => router.push(`/sell/listings/${listingId}/verification`)}>{tl('saveContinue')}</Button>
        </div>
      </div>
    </WizardShell>
  );
}

// --- Ownership verification -------------------------------------------------
export function VerificationStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const status = trpc.listing.verification.status.useQuery(
    { listingId },
    { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 1500 : false) },
  );
  const t = useTranslations('verification');
  const tl = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const start = trpc.listing.verification.start.useMutation({ onSuccess: () => { status.refetch(); utils.listing.get.invalidate({ listingId }); } });

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const st = status.data?.status ?? 'NOT_STARTED';

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="verification">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        {st === 'NOT_STARTED' || st === undefined ? (
          <>
            <div>
              <h1 className="font-display text-2xl font-medium text-brand-900">{t('startTitle')}</h1>
              <p className="mt-1 text-muted-foreground">{t('startBody')}</p>
            </div>
            <Button loading={start.isPending} onClick={() => start.mutate({ listingId })}>{t('start')}</Button>
            <p className="text-xs text-muted-foreground">{t('startHelp')}</p>
          </>
        ) : st === 'PENDING' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-medium text-brand-900">{t('pendingTitle')}</h1>
              <Badge variant="default">{t('pendingStatus')}</Badge>
            </div>
            <Alert variant="info"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('pendingBody')}</span></Alert>
            <Button variant="outline" onClick={() => status.refetch()}>{t('refresh')}</Button>
          </>
        ) : st === 'VERIFIED_DEMO' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-medium text-brand-900">{t('successTitle')}</h1>
              <Badge variant="success">{t('successStatus')}</Badge>
            </div>
            <Alert variant="success"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden />{t('successBody')}</span></Alert>
            <Button onClick={() => router.push(`/sell/listings/${listingId}/settings`)}>{t('continue')}</Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-medium text-brand-900">{t('failTitle')}</h1>
              <Badge variant="destructive">{tl('sectionFailed')}</Badge>
            </div>
            <Alert variant="destructive"><span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" aria-hidden />{t('failBody')}</span></Alert>
            <div className="flex gap-2">
              <Button loading={start.isPending} onClick={() => start.mutate({ listingId })}>{t('retry')}</Button>
              <Button variant="outline" onClick={() => router.push(`/sell/listings/${listingId}/ownership`)}>{t('replaceDoc')}</Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}

// --- Listing settings -------------------------------------------------------
export function SettingsStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  return <SettingsInner key={listingId} listingId={listingId} data={get.data} />;
}
function SettingsInner({ listingId, data }: { listingId: string; data: GetData }) {
  const t = useTranslations('settings');
  const tl = useTranslations('listing');
  const router = useRouter();
  const save = trpc.listing.saveSettings.useMutation();
  const [asking, setAsking] = useState(data.askingPriceAed != null ? String(data.askingPriceAed) : '');
  const [minNotif, setMinNotif] = useState(data.minNotificationPriceAed != null ? String(data.minNotificationPriceAed) : '');
  const [error, setError] = useState<string | null>(null);
  const autosave = useAutosave(listingId, data.version);
  const firstRender = useRef(true);

  // Debounced autosave of the (partial) price fields.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    autosave.schedule({ askingPriceAed: numOrNull(asking), minNotificationPriceAed: numOrNull(minNotif) });
  }, [asking, minNotif, autosave.schedule]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    autosave.cancel();
    setError(null);
    const parsed = listingSettingsSchema.safeParse({ askingPriceAed: Number(asking.replace(/,/g, '')), minNotificationPriceAed: Number(minNotif.replace(/,/g, '')) });
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setError(code === 'notification_above_asking' ? t('errMinAboveAsking') : code === 'asking_price_too_high' ? t('errAskingTooHigh') : t('errAskingInvalid'));
      return;
    }
    try {
      await save.mutateAsync({ listingId, ...parsed.data });
      router.push(`/sell/listings/${listingId}/investment-case`);
    } catch {
      setError(t('errAskingInvalid'));
    }
  }

  return (
    <WizardShell listing={data as unknown as WizardListing} current="settings" autosave={autosave.state}>
      <form onSubmit={onSubmit} className="space-y-6">
        <StepHeader ns="settings" />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <FormField id="asking" label={t('askingPrice')} required>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">AED</span>
            <Input id="asking" inputMode="numeric" dir="ltr" value={asking} onChange={(e) => setAsking(e.target.value)} placeholder={t('askingPlaceholder')} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('askingHelp')}</p>
        </FormField>
        <FormField id="minNotif" label={t('minNotification')} required>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">AED</span>
            <Input id="minNotif" inputMode="numeric" dir="ltr" value={minNotif} onChange={(e) => setMinNotif(e.target.value)} placeholder={t('minPlaceholder')} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('minExplanation')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('demoNote')}</p>
        </FormField>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{t('visibilityTitle')}</p>
          <p className="text-muted-foreground">{t('visibilityBody')}</p>
        </div>
        <div className="flex justify-end border-t pt-4">
          <Button type="submit" loading={save.isPending}>{tl('saveContinue')}</Button>
        </div>
      </form>
    </WizardShell>
  );
}

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
  const [orig, setOrig] = useState(ic?.originalPurchasePriceAed != null ? String(ic.originalPurchasePriceAed) : '');
  const [date, setDate] = useState(ic?.purchaseDate ?? '');
  const [reno, setReno] = useState(ic?.renovationCostsAed != null ? String(ic.renovationCostsAed) : '0');
  const [visible, setVisible] = useState(ic?.visible ?? false);
  const [error, setError] = useState<string | null>(null);
  const save = trpc.listing.investment.save.useMutation();
  const skip = trpc.listing.investment.skip.useMutation();

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (data.askingPriceAed == null) return setError(t('errNeedAsking'));
    const parsed = investmentCaseSchema.safeParse({ originalPurchasePriceAed: Number(orig.replace(/,/g, '')), renovationCostsAed: Number(reno.replace(/,/g, '') || '0'), purchaseDate: date, visible });
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setError(code === 'renovation_negative' ? t('errRenovation') : code === 'purchase_date_future' ? t('errDateFuture') : t('errAmount'));
      return;
    }
    await save.mutateAsync({ listingId, ...parsed.data });
    router.push(`/sell/listings/${listingId}/form-a`);
  }

  return (
    <WizardShell listing={data as unknown as WizardListing} current="investment-case">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('stepLabel')}</p>
          <h1 className="mt-1 font-display text-2xl font-medium text-brand-900">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        <Alert variant="info">{t('privacyNote')}</Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {!adding ? (
          <div className="flex gap-3">
            <Button onClick={() => setAdding(true)}>{t('add')}</Button>
            <Button variant="outline" loading={skip.isPending} onClick={async () => { await skip.mutateAsync({ listingId }); router.push(`/sell/listings/${listingId}/form-a`); }}>{t('skip')}</Button>
          </div>
        ) : (
          <form onSubmit={onSave} className="space-y-5">
            <FormField id="orig" label={t('originalPrice')} required>
              <Input id="orig" inputMode="numeric" dir="ltr" value={orig} onChange={(e) => setOrig(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{t('originalHelp')}</p>
            </FormField>
            <FormField id="date" label={t('purchaseDate')} required>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{t('purchaseDateHelp')}</p>
            </FormField>
            <FormField id="reno" label={t('renovation')}>
              <Input id="reno" inputMode="numeric" dir="ltr" value={reno} onChange={(e) => setReno(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{t('renovationHelp')}</p>
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              <span>{t('showOnListing')}</span>
            </label>
            {ic ? (
              <div className="rounded-lg border p-4 text-sm">
                <p className="mb-2 font-medium">{t('summaryTitle')}</p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">{t('totalInvested')}</dt><dd>{formatAed(ic.totalInvestedAed)}</dd>
                  <dt className="text-muted-foreground">{t('estimatedGain')}</dt><dd>{formatAed(ic.estimatedGainAed)}</dd>
                  <dt className="text-muted-foreground">{t('estimatedRoi')}</dt><dd>{ic.estimatedRoiPct != null ? `${ic.estimatedRoiPct}%` : '—'}</dd>
                  <dt className="text-muted-foreground">{t('annualised')}</dt><dd>{ic.estimatedAnnualisedReturnPct != null ? `${ic.estimatedAnnualisedReturnPct}%` : t('annualisedUnavailable')}</dd>
                  <dt className="text-muted-foreground">{t('pricePerSqft')}</dt><dd>{formatAed(ic.pricePerSqftAed)}</dd>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">{t('disclaimer')}</p>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-4">
              <Button type="button" variant="outline" loading={skip.isPending} onClick={async () => { await skip.mutateAsync({ listingId }); await utils.listing.get.invalidate({ listingId }); router.push(`/sell/listings/${listingId}/form-a`); }}>{t('skip')}</Button>
              <Button type="submit" loading={save.isPending}>{t('save')}</Button>
            </div>
          </form>
        )}
      </div>
    </WizardShell>
  );
}

// --- Simulated Form A -------------------------------------------------------
export function FormAStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const t = useTranslations('formA');
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = trpc.listing.formA.complete.useMutation();
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const done = get.data.formA.status === 'VERIFIED_DEMO';

  async function onComplete() {
    if (!confirmed) return setError(t('errConfirm'));
    setError(null);
    const res = await complete.mutateAsync({ listingId, confirm: true });
    await utils.listing.get.invalidate({ listingId });
    if (res.status === 'COMPLETE') router.push(`/sell/listings/${listingId}/photos`);
  }

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="form-a">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        <div>
          <h1 className="font-display text-2xl font-medium text-brand-900">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {done ? (
          <>
            <Alert variant="success" title={t('successTitle')}>{t('successBody')}</Alert>
            <Button onClick={() => router.push(`/sell/listings/${listingId}/photos`)}>{t('continue')}</Button>
          </>
        ) : (
          <>
            <div className="rounded-lg border p-4 text-sm">
              <p>{get.data.property?.buildingOrProject} · {get.data.property?.community}</p>
              <p className="text-muted-foreground">{formatAed(get.data.askingPriceAed)}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t('demoStatement')}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>{t('confirm')}</span>
            </label>
            <Button loading={complete.isPending} onClick={onComplete}>{t('complete')}</Button>
          </>
        )}
      </div>
    </WizardShell>
  );
}

// --- Photos -----------------------------------------------------------------
export function PhotosStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const t = useTranslations('photos');
  const tl = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = trpc.listing.photos.register.useMutation();
  const setCover = trpc.listing.photos.setCover.useMutation();
  const del = trpc.listing.photos.delete.useMutation();
  const reorder = trpc.listing.photos.reorder.useMutation();
  const complete = trpc.listing.photos.complete.useMutation();

  const photos = get.data?.photos ?? [];
  useEffect(() => {
    const paths = photos.map((p) => p.storagePath);
    if (paths.length === 0) return;
    getSignedUrls(supabase(), DRAFT_PHOTO_BUCKET, paths).then(setUrls).catch(() => {});
  }, [photos.map((p) => p.storagePath).join(',')]);

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;

  async function onFiles(files: FileList) {
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError(t('errUnsupported')); continue; }
        if (file.size > 12 * 1024 * 1024) { setError(t('errTooLarge')); continue; }
        const path = buildObjectPath(listingId, 'photo', file.name);
        await uploadObject(supabase(), DRAFT_PHOTO_BUCKET, path, file);
        await register.mutateAsync({ listingId, storagePath: path, originalName: file.name, contentType: file.type, sizeBytes: file.size });
      }
      await utils.listing.get.invalidate({ listingId });
    } catch {
      setError(t('errTooMany'));
    } finally {
      setBusy(false);
    }
  }
  async function move(idx: number, dir: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j]!, ids[idx]!];
    await reorder.mutateAsync({ listingId, orderedIds: ids });
    await utils.listing.get.invalidate({ listingId });
  }

  const hasCover = photos.some((p) => p.isCover);
  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="photos" autosave={busy ? 'saving' : 'idle'}>
      <div className="space-y-6">
        <StepHeader ns="photos" />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">{busy ? t('uploading', { count: photos.length }) : t('uploadCta')}</span>
          <span className="mt-1 text-xs text-muted-foreground">{t('uploadHint')}</span>
          <input type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files && onFiles(e.target.files)} />
        </label>
        <p className="text-xs text-muted-foreground">{t('guidance')}</p>

        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, idx) => (
              <li key={p.id} className="overflow-hidden rounded-lg border">
                <img src={urls[p.storagePath] ?? ''} alt={p.originalName ?? `Photograph ${idx + 1}`} className="aspect-[4/3] w-full bg-muted object-cover" />
                <div className="flex items-center justify-between p-2">
                  <span className="text-xs">{idx + 1}{p.isCover ? ` · ${t('cover')}` : ''}</span>
                  <div className="flex gap-1">
                    <button type="button" aria-label={t('moveEarlier')} onClick={() => move(idx, -1)} className="rounded p-1 hover:bg-muted"><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" aria-label={t('moveLater')} onClick={() => move(idx, 1)} className="rounded p-1 hover:bg-muted"><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" aria-label={t('setCover')} onClick={async () => { await setCover.mutateAsync({ listingId, photoId: p.id }); await utils.listing.get.invalidate({ listingId }); }} className="rounded p-1 hover:bg-muted"><Star className={cn('h-3.5 w-3.5', p.isCover && 'fill-warning text-warning')} aria-hidden /></button>
                    <button type="button" aria-label={t('remove')} onClick={async () => { const r = await del.mutateAsync({ listingId, photoId: p.id }); await import('@/lib/listing-storage').then((m) => m.removeObjects(supabase(), DRAFT_PHOTO_BUCKET, r.removedPhotos)).catch(() => {}); await utils.listing.get.invalidate({ listingId }); }} className="rounded p-1 hover:bg-muted"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length > 0 ? <p className="text-xs text-muted-foreground">{t('coverHelp')}</p> : null}

        <div className="flex justify-end border-t pt-4">
          <Button
            disabled={photos.length < 1 || !hasCover}
            loading={complete.isPending}
            onClick={async () => { await complete.mutateAsync({ listingId }); router.push(`/sell/listings/${listingId}/trakheesi`); }}
          >
            {tl('saveContinue')}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}

// --- Simulated Trakheesi ----------------------------------------------------
export function TrakheesiStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const status = trpc.listing.permit.status.useQuery(
    { listingId },
    { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 1500 : false) },
  );
  const t = useTranslations('permit');
  const tlf = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const submit = trpc.listing.permit.submit.useMutation({ onSuccess: () => { status.refetch(); utils.listing.get.invalidate({ listingId }); } });

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const st = status.data?.status ?? 'NOT_STARTED';

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="trakheesi">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        {st === 'NOT_STARTED' ? (
          <>
            <div>
              <h1 className="font-display text-2xl font-medium text-brand-900">{t('prepareTitle')}</h1>
              <p className="mt-1 text-muted-foreground">{t('prepareBody')}</p>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <p>{get.data.property?.buildingOrProject} · {get.data.property?.community}</p>
              <p className="text-muted-foreground">{formatAed(get.data.askingPriceAed)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>{t('confirm')}</span></label>
            <Button disabled={!confirmed} loading={submit.isPending} onClick={() => submit.mutate({ listingId, confirm: true })}>{t('submit')}</Button>
          </>
        ) : st === 'PENDING' ? (
          <>
            <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-medium text-brand-900">{t('pendingTitle')}</h1><Badge>{t('pendingStatus')}</Badge></div>
            <Alert variant="info"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('pendingBody')}</span></Alert>
            <Button variant="outline" onClick={() => status.refetch()}>{t('refresh')}</Button>
          </>
        ) : st === 'VERIFIED_DEMO' ? (
          <>
            <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-medium text-brand-900">{t('approvedTitle')}</h1><Badge variant="success">{t('approvedStatus')}</Badge></div>
            <Alert variant="success">{t('approvedBody')}</Alert>
            <div className="inline-flex flex-col items-center rounded-lg border p-4">
              <div className="grid h-24 w-24 grid-cols-5 grid-rows-5 gap-0.5" aria-hidden>
                {Array.from({ length: 25 }).map((_, i) => (<span key={i} className={cn('rounded-[1px]', (i * 7) % 3 === 0 ? 'bg-brand-900' : 'bg-transparent')} />))}
              </div>
              <p className="mt-2 text-xs font-medium">{t('qrLabel')}</p>
              <p className="text-[11px] text-muted-foreground">{t('qrHelp')}</p>
            </div>
            <Button onClick={() => router.push(`/sell/listings/${listingId}/review`)}>{t('reviewListing')}</Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-medium text-brand-900">{t('failTitle')}</h1><Badge variant="destructive">{tlf('sectionFailed')}</Badge></div>
            <Alert variant="destructive">{t('failBody')}</Alert>
            <Button loading={submit.isPending} onClick={() => submit.mutate({ listingId, confirm: true })}>{t('retry')}</Button>
          </>
        )}
      </div>
    </WizardShell>
  );
}

// --- Review -----------------------------------------------------------------
const REVIEW_ROWS: { section: string; labelKey: string; step: string }[] = [
  { section: 'details', labelKey: 'secDetails', step: 'details' },
  { section: 'ownership', labelKey: 'secOwnership', step: 'ownership' },
  { section: 'verification', labelKey: 'secVerification', step: 'verification' },
  { section: 'settings', labelKey: 'secSettings', step: 'settings' },
  { section: 'investment', labelKey: 'secInvestment', step: 'investment-case' },
  { section: 'formA', labelKey: 'secFormA', step: 'form-a' },
  { section: 'photos', labelKey: 'secPhotos', step: 'photos' },
  { section: 'permit', labelKey: 'secPermit', step: 'trakheesi' },
];
export function ReviewStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const t = useTranslations('review');
  const tl = useTranslations('listing');
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markReady = trpc.listing.review.markReady.useMutation();
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const { sections, readiness } = get.data;

  async function onConfirm() {
    if (!confirmed) return;
    setError(null);
    try {
      await markReady.mutateAsync({ listingId, confirm: true });
      router.push(`/sell/listings/${listingId}/ready`);
    } catch {
      setError(t('itemsBody'));
    }
  }

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="review">
      <div className="space-y-6">
        <StepHeader ns="review" />
        {readiness.ready ? (
          <Alert variant="success" title={t('allComplete')}>{t('allCompleteBody')}</Alert>
        ) : (
          <Alert variant="warning" title={t('itemsNeedAttention', { count: readiness.blocking.length })}>{t('itemsBody')}</Alert>
        )}
        <ul className="divide-y rounded-lg border">
          {REVIEW_ROWS.map((r) => (
            <li key={r.section} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium">{t(r.labelKey)}</span>
              <div className="flex items-center gap-3">
                <SectionBadge status={sections[r.section as keyof typeof sections]} />
                <Link href={`/sell/listings/${listingId}/${r.step}`} className="text-sm text-primary hover:underline">{tl('edit')}</Link>
              </div>
            </li>
          ))}
        </ul>
        <Alert variant="info" title={t('prototypeTitle')}>{t('prototypeBody')}</Alert>
        <Alert variant="info" title={t('notPublicTitle')}>{t('notPublicBody')}</Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>{t('confirmReview')}</span></label>
        <div className="flex justify-end border-t pt-4">
          <Button disabled={!readiness.ready || !confirmed} loading={markReady.isPending} onClick={onConfirm}>{t('markReady')}</Button>
        </div>
      </div>
    </WizardShell>
  );
}

// --- Ready ------------------------------------------------------------------
export function ReadyScreen({ listingId }: { listingId: string }) {
  const t = useTranslations('ready');
  const tpub = useTranslations('publication');
  const router = useRouter();
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  return (
    <div className="mx-auto max-w-xl py-8 text-center">
      <ShieldCheck className="mx-auto h-12 w-12 text-success" aria-hidden />
      <h1 className="mt-4 font-display text-3xl font-medium text-brand-900">{tpub('readyTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{tpub('readyBody')}</p>
      <div className="mx-auto mt-4 inline-flex flex-col items-center gap-2">
        <Badge variant="success">{tpub('readyStatus')}</Badge>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{tpub('privacy')}</p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Button onClick={() => router.push(`/sell/listings/${listingId}/publish`)}>{tpub('publish')}</Button>
        <Button variant="outline" onClick={() => router.push(`/sell/listings/${listingId}/preview`)}>{tpub('preview')}</Button>
        <Button variant="ghost" onClick={() => router.push(`/sell/listings/${listingId}/details`)}>{t('editListing')}</Button>
      </div>
    </div>
  );
}

// --- Resolver: redirect to the recommended next step ------------------------
export function ListingResolver({ listingId }: { listingId: string }) {
  const router = useRouter();
  const get = useListing(listingId);
  useEffect(() => {
    if (get.data) router.replace(`/sell/listings/${listingId}/${get.data.nextStep}`);
  }, [get.data, listingId, router]);
  if (get.error) return <ListingUnavailable />;
  return <WizardLoading />;
}

// --- /sell/new preflight: resume a recent empty draft or create a new one ---
export function NewListingPreflight() {
  const t = useTranslations('listing');
  const router = useRouter();
  const draft = trpc.listing.resumableDraft.useQuery();
  const create = trpc.listing.create.useMutation({ onSuccess: ({ listingId }) => router.replace(`/sell/listings/${listingId}/details`) });
  const [decided, setDecided] = useState(false);
  useEffect(() => {
    if (draft.isSuccess && draft.data === null && !decided && !create.isPending) {
      setDecided(true);
      create.mutate();
    }
  }, [draft.isSuccess, draft.data, decided, create]);

  if (draft.isLoading || create.isPending) return <WizardLoading />;
  if (draft.data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <h1 className="font-display text-2xl font-medium text-brand-900">{t('resumeTitle')}</h1>
        <p className="text-muted-foreground">{t('resumeBody')}</p>
        <div className="flex flex-col items-center gap-2">
          <Button onClick={() => router.replace(`/sell/listings/${draft.data!.listingId}`)}>{t('resumeContinue')}</Button>
          <Button variant="outline" loading={create.isPending} onClick={() => create.mutate()}>{t('resumeCreate')}</Button>
          <Link href="/sell" className="text-sm text-muted-foreground hover:underline">{t('backToListings')}</Link>
        </div>
      </div>
    );
  }
  return <WizardLoading />;
}

// --- Owner-only preview -----------------------------------------------------
export function PreviewScreen({ listingId }: { listingId: string }) {
  const t = useTranslations('preview');
  const ti = useTranslations('investment');
  const router = useRouter();
  const preview = trpc.listing.preview.useQuery({ listingId });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = preview.data?.photoPaths ?? [];
  useEffect(() => {
    if (paths.length === 0) return;
    getSignedUrls(supabase(), DRAFT_PHOTO_BUCKET, paths).then(setUrls).catch(() => {});
  }, [paths.join(',')]);

  if (preview.error) return <ListingUnavailable />;
  if (!preview.data) return <WizardLoading />;
  const d = preview.data;
  const cover = d.coverPhotoPath ? urls[d.coverPhotoPath] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <Alert variant="info" title={t('bannerTitle')}>{t('bannerBody')}</Alert>
      {cover ? (
        <img src={cover} alt={d.title ?? 'cover'} className="aspect-[16/9] w-full rounded-lg bg-muted object-cover" />
      ) : null}
      <div>
        <h1 className="font-display text-3xl font-medium text-brand-900">{d.title}</h1>
        <p className="mt-1 text-xl font-medium">{formatAed(d.askingPriceAed)}</p>
      </div>
      {d.property ? (
        <p className="text-sm text-muted-foreground">
          {[d.property.bedrooms === 0 ? 'Studio' : `${d.property.bedrooms} bd`, `${d.property.bathrooms} ba`, d.property.sizeSqft ? `${d.property.sizeSqft} sq ft` : null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {d.description ? <p className="whitespace-pre-line text-sm">{d.description}</p> : null}
      {d.property?.features?.length ? (
        <ul className="flex flex-wrap gap-2">{d.property.features.map((f) => (<li key={f}><Badge variant="outline">{f.toLowerCase().replace(/_/g, ' ')}</Badge></li>))}</ul>
      ) : null}
      {d.investmentCase ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="mb-1 font-medium">{ti('summaryTitle')}</p>
          <p>{ti('estimatedRoi')}: {d.investmentCase.estimatedRoiPct ?? '—'}%</p>
          <p>{ti('annualised')}: {d.investmentCase.estimatedAnnualisedReturnPct ?? '—'}%</p>
        </div>
      ) : null}
      <div className="flex gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => router.push(`/sell/listings/${listingId}/ready`)}>{t('backToReady')}</Button>
        <Button variant="ghost" onClick={() => router.push(`/sell/listings/${listingId}/details`)}>{t('editListing')}</Button>
      </div>
    </div>
  );
}
