'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud } from 'lucide-react';
import { Alert, Button, FormField, cn } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { WizardShell, WizardLoading, ListingUnavailable, type WizardListing } from '../wizard';
import { OWNERSHIP_BUCKET, buildObjectPath, uploadObject } from '@/lib/listing-storage';
import { StepHeader, useListing, supabase, type GetData } from './step-shared';

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
  const [docType, setDocType] = useState<'TITLE_DEED' | 'OQOOD'>(
    (data.document?.documentType as never) ?? 'TITLE_DEED',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
      return setError(t('errUnsupported'));
    if (file.size > 10 * 1024 * 1024) return setError(t('errTooLarge'));
    setBusy(true);
    try {
      const path = buildObjectPath(listingId, 'doc', file.name);
      await uploadObject(supabase(), OWNERSHIP_BUCKET, path, file);
      await register.mutateAsync({
        listingId,
        documentType: docType,
        storagePath: path,
        originalName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      await utils.listing.get.invalidate({ listingId });
    } catch {
      setError(t('errUpload'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardShell
      listing={data as unknown as WizardListing}
      current="ownership"
      autosave={busy ? 'saving' : 'idle'}
    >
      <div className="space-y-6">
        <StepHeader ns="ownership" />
        <Alert variant="warning" title={t('safetyTitle')}>
          {t('safetyBody')}
        </Alert>
        <FormField id="docType" label={t('titleDeed') + ' / ' + t('oqood')}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['TITLE_DEED', 'OQOOD'] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDocType(d)}
                aria-pressed={docType === d}
                className={cn(
                  'rounded-md border p-3 text-start text-sm',
                  docType === d ? 'border-primary bg-brand-100' : 'border-input',
                )}
              >
                <span className="font-medium">{t(d === 'TITLE_DEED' ? 'titleDeed' : 'oqood')}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {t(d === 'TITLE_DEED' ? 'titleDeedHelp' : 'oqoodHelp')}
                </span>
              </button>
            ))}
          </div>
        </FormField>
        <Alert variant="info" title={t('privateTitle')}>
          {t('privateBody')}
        </Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {data.document ? (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">{data.document.originalName ?? 'document'}</p>
            <p className="text-success text-xs">{t('uploaded')}</p>
            <div className="mt-3 flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                  {t('replace')}
                </span>
              </label>
              <Button
                variant="outline"
                size="sm"
                loading={remove.isPending}
                onClick={async () => {
                  await remove.mutateAsync({ listingId });
                  await utils.listing.get.invalidate({ listingId });
                }}
              >
                {t('remove')}
              </Button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <UploadCloud className="text-muted-foreground mb-2 h-6 w-6" aria-hidden />
            <span className="text-sm font-medium">{busy ? t('uploading') : t('uploadCta')}</span>
            <span className="text-muted-foreground mt-1 text-xs">{t('uploadHint')}</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button
            disabled={!data.document}
            onClick={() => router.push(`/sell/listings/${listingId}/verification`)}
          >
            {tl('saveContinue')}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
