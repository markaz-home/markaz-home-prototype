'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, cn } from '@markaz/ui';

/** Public photo gallery (design spec §25). Cover + thumbnails open a keyboard- and
 * touch-navigable full-screen viewer. Failed images degrade to a neutral tile. */
export function PropertyGallery({ photos, headline }: { photos: string[]; headline: string }) {
  const t = useTranslations('property');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const total = photos.length;
  const go = useCallback((next: number) => setIndex((next + total) % total), [total]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, go]);

  function openAt(i: number) {
    setIndex(i);
    setOpen(true);
  }

  function markFailed(i: number) {
    setFailed((prev) => new Set(prev).add(i));
  }

  if (total === 0) {
    return (
      <div className="bg-muted text-muted-foreground flex aspect-[16/9] w-full items-center justify-center rounded-lg text-sm">
        {t('photographsUnavailable')}
      </div>
    );
  }

  const thumbs = photos.slice(1, 5);
  const extra = total - 5;

  return (
    <>
      {/* Balanced gallery: large cover (left half) + a 2×2 grid of thumbnails
          (right half) at equal height on sm+; cover-only on mobile. */}
      <div className="grid gap-2 sm:h-[360px] sm:grid-cols-4 sm:grid-rows-2 lg:h-[440px]">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:h-full"
        >
          <PhotoImg
            src={photos[0]!}
            alt={`${headline} — 1`}
            failed={failed.has(0)}
            onError={() => markFailed(0)}
          />
        </button>
        {thumbs.map((src, i) => {
          const realIndex = i + 1;
          const isLast = i === thumbs.length - 1 && extra > 0;
          return (
            <button
              key={realIndex}
              type="button"
              onClick={() => openAt(realIndex)}
              className="bg-muted relative hidden aspect-[4/3] overflow-hidden rounded-lg sm:block sm:aspect-auto sm:h-full"
            >
              <PhotoImg
                src={src}
                alt={`${headline} — ${realIndex + 1}`}
                failed={failed.has(realIndex)}
                onError={() => markFailed(realIndex)}
              />
              {isLast && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                  +{extra + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="text-primary text-sm font-medium underline-offset-2 hover:underline"
        >
          {t('viewAllPhotos', { count: total })}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-0 bg-neutral-950 p-0 text-white">
          <div className="relative flex aspect-[3/2] items-center justify-center">
            <PhotoImg
              src={photos[index]!}
              alt={`${headline} — ${index + 1}`}
              failed={failed.has(index)}
              onError={() => markFailed(index)}
              contain
            />
            {failed.has(index) && (
              <p className="absolute bottom-2 text-xs text-white/70">
                {t('imageFailed', { n: index + 1 })}
              </p>
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t('photoCount', { current: index, total })}
                  onClick={() => go(index - 1)}
                  className="absolute start-2 rounded-full bg-black/50 p-2 hover:bg-black/70"
                >
                  <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={t('photoCount', { current: index + 2, total })}
                  onClick={() => go(index + 1)}
                  className="absolute end-2 rounded-full bg-black/50 p-2 hover:bg-black/70"
                >
                  <ChevronRight className="h-6 w-6 rtl:rotate-180" />
                </button>
              </>
            )}
            <span className="absolute bottom-2 end-3 rounded bg-black/60 px-2 py-0.5 text-xs">
              {t('photoCount', { current: index + 1, total })}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PhotoImg({
  src,
  alt,
  failed,
  onError,
  contain,
}: {
  src: string;
  alt: string;
  failed: boolean;
  onError: () => void;
  contain?: boolean;
}) {
  const t = useTranslations('property');
  if (failed) {
    return (
      <span className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
        {t('imageUnavailable')}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={onError}
      loading="lazy"
      className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover')}
    />
  );
}
