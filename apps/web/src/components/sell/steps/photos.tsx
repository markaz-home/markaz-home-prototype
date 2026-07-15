'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, Star, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Alert, Button, cn } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { WizardShell, WizardLoading, ListingUnavailable, type WizardListing } from '../wizard';
import {
  DRAFT_PHOTO_BUCKET,
  buildObjectPath,
  uploadObject,
  getSignedUrls,
} from '@/lib/listing-storage';
import { StepHeader, useListing, supabase } from './step-shared';

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
    getSignedUrls(supabase(), DRAFT_PHOTO_BUCKET, paths)
      .then(setUrls)
      .catch(() => {});
  }, [photos.map((p) => p.storagePath).join(',')]);

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;

  async function onFiles(files: FileList) {
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setError(t('errUnsupported'));
          continue;
        }
        if (file.size > 12 * 1024 * 1024) {
          setError(t('errTooLarge'));
          continue;
        }
        const path = buildObjectPath(listingId, 'photo', file.name);
        await uploadObject(supabase(), DRAFT_PHOTO_BUCKET, path, file);
        await register.mutateAsync({
          listingId,
          storagePath: path,
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
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
    <WizardShell
      listing={get.data as unknown as WizardListing}
      current="photos"
      autosave={busy ? 'saving' : 'idle'}
    >
      <div className="space-y-6">
        <StepHeader ns="photos" />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <UploadCloud className="text-muted-foreground mb-2 h-6 w-6" aria-hidden />
          <span className="text-sm font-medium">
            {busy ? t('uploading', { count: photos.length }) : t('uploadCta')}
          </span>
          <span className="text-muted-foreground mt-1 text-xs">{t('uploadHint')}</span>
          <input
            type="file"
            multiple
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => e.target.files && onFiles(e.target.files)}
          />
        </label>
        <p className="text-muted-foreground text-xs">{t('guidance')}</p>

        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, idx) => (
              <li key={p.id} className="overflow-hidden rounded-lg border">
                <img
                  src={urls[p.storagePath] ?? ''}
                  alt={p.originalName ?? `Photograph ${idx + 1}`}
                  className="bg-muted aspect-[4/3] w-full object-cover"
                />
                <div className="flex items-center justify-between p-2">
                  <span className="text-xs">
                    {idx + 1}
                    {p.isCover ? ` · ${t('cover')}` : ''}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={t('moveEarlier')}
                      onClick={() => move(idx, -1)}
                      className="hover:bg-muted rounded p-1"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t('moveLater')}
                      onClick={() => move(idx, 1)}
                      className="hover:bg-muted rounded p-1"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t('setCover')}
                      onClick={async () => {
                        await setCover.mutateAsync({ listingId, photoId: p.id });
                        await utils.listing.get.invalidate({ listingId });
                      }}
                      className="hover:bg-muted rounded p-1"
                    >
                      <Star
                        className={cn('h-3.5 w-3.5', p.isCover && 'fill-warning text-warning')}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={t('remove')}
                      onClick={async () => {
                        const r = await del.mutateAsync({ listingId, photoId: p.id });
                        await import('@/lib/listing-storage')
                          .then((m) =>
                            m.removeObjects(supabase(), DRAFT_PHOTO_BUCKET, r.removedPhotos),
                          )
                          .catch(() => {});
                        await utils.listing.get.invalidate({ listingId });
                      }}
                      className="hover:bg-muted rounded p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length > 0 ? (
          <p className="text-muted-foreground text-xs">{t('coverHelp')}</p>
        ) : null}

        <div className="flex justify-end border-t pt-4">
          <Button
            disabled={photos.length < 1 || !hasCover}
            loading={complete.isPending}
            onClick={async () => {
              await complete.mutateAsync({ listingId });
              router.push(`/sell/listings/${listingId}/trakheesi`);
            }}
          >
            {tl('saveContinue')}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
