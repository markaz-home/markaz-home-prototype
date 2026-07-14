import type { ReactNode } from 'react';
import { Lock, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@markaz/ui';

/** A labelled fact. Values that must stay LTR (amounts, references) pass `ltr`. */
export function Field({ label, value, ltr }: { label: string; value: ReactNode; ltr?: boolean }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={cn('text-sm font-medium', ltr && 'font-mono')} dir={ltr ? 'ltr' : undefined}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</dl>;
}

/**
 * Public/Private data section (spec §37) — a card that visibly labels the
 * visibility class of the fields it contains, so an admin can never confuse
 * owner-only data with public marketplace data.
 */
export function DataSection({
  title,
  visibility,
  children,
}: {
  title: string;
  visibility?: 'public' | 'private';
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {visibility === 'private' ? (
            <Lock className="h-4 w-4 text-amber-700" aria-hidden />
          ) : visibility === 'public' ? (
            <Globe className="text-brand-600 h-4 w-4" aria-hidden />
          ) : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
