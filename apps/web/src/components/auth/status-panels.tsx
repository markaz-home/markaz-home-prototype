'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';

/** Success status screen (design spec §19.16). Focus moves to heading. */
export function SuccessPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <CheckCircle2 className="text-success h-9 w-9" aria-hidden />
      <div className="space-y-2">
        <h1 tabIndex={-1} className="font-display text-primary text-3xl font-medium tracking-tight">
          {title}
        </h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Blocking recoverable error screen (design spec §19.17). */
export function ErrorPanel({
  title,
  description,
  reference,
  variant = 'error',
  children,
}: {
  title: string;
  description?: string;
  reference?: string;
  variant?: 'error' | 'denied';
  children?: React.ReactNode;
}) {
  const Icon = variant === 'denied' ? ShieldAlert : AlertTriangle;
  const t = useTranslations('auth');
  return (
    <div className="space-y-5">
      <Icon className="text-destructive h-9 w-9" aria-hidden />
      <div className="space-y-2">
        <h1 tabIndex={-1} className="font-display text-primary text-3xl font-medium tracking-tight">
          {title}
        </h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        {reference ? (
          <p className="text-muted-foreground text-xs" dir="ltr">
            {t('reference')}: {reference}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export { Button };
