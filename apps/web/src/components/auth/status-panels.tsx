import * as React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
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
      <CheckCircle2 className="h-9 w-9 text-success" aria-hidden />
      <div className="space-y-2">
        <h1 tabIndex={-1} className="font-display text-3xl font-medium tracking-tight text-brand-900">
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
  return (
    <div className="space-y-5">
      <Icon className="h-9 w-9 text-destructive" aria-hidden />
      <div className="space-y-2">
        <h1 tabIndex={-1} className="font-display text-3xl font-medium tracking-tight text-brand-900">
          {title}
        </h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        {reference ? (
          <p className="text-xs text-muted-foreground" dir="ltr">
            Reference: {reference}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export { Button };
