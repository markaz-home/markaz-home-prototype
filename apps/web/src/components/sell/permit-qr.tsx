'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Where a scan should land.
 *
 * A phone resolves `localhost` to itself, so a code built from a loopback origin
 * scans to nothing. Prefer an explicitly configured public URL; otherwise use the
 * origin the page is actually being served from — opening the app on the machine's
 * LAN address is then enough to make the code scannable from a phone.
 */
function qrOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (!LOOPBACK.has(url.hostname)) return url.origin;
    } catch {
      // Fall through to the page origin.
    }
  }
  return window.location.origin;
}

function isLoopback(origin: string): boolean {
  try {
    return LOOPBACK.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * The Madmoun-style permit code. It encodes the public verification URL for the
 * permit — scanning it opens `/permit/{number}`, which confirms the advert
 * carries an approved permit, the way a real Madmoun scan resolves to the
 * Land Department's verification page.
 *
 * The encoder is imported lazily so its ~15 KB stays out of the wizard bundle
 * until a listing actually reaches the approved-permit state.
 */
export function PermitQr({ permitNumber, size = 112 }: { permitNumber: string; size?: number }) {
  const locale = useLocale();
  const t = useTranslations('permitQr');
  const [src, setSrc] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = `${qrOrigin()}/${locale}/permit/${encodeURIComponent(permitNumber)}`;
    setSrc(null);
    setFailed(false);
    setTarget(url);
    void import('qrcode')
      .then(async (QR) => {
        const dataUrl = await QR.toDataURL(url, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: size * 2,
          color: { dark: '#0c0c0c', light: '#ffffff' },
        });
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [permitNumber, locale, size]);

  const localOnly = target ? isLoopback(target) : false;

  return (
    <div className="max-w-48 shrink-0">
      <div
        className="grid place-items-center overflow-hidden rounded-md bg-white"
        style={{ width: size, height: size }}
        // The encoded destination, so what a scan resolves to is assertable.
        data-qr-target={target ?? undefined}
        aria-live="polite"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={size} height={size} className="h-full w-full" />
        ) : failed ? (
          <span className="text-destructive flex flex-col items-center gap-1 px-2 text-center text-xs">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            {t('unavailable')}
          </span>
        ) : (
          <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t('generating')}
          </span>
        )}
      </div>
      {localOnly ? (
        <p className="text-warning mt-2 text-xs leading-relaxed" role="status">
          {t('localOnly')}
        </p>
      ) : null}
      {target ? (
        <a
          href={target}
          className="text-primary mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline"
        >
          {t('openLink')}
        </a>
      ) : null}
    </div>
  );
}
