'use client';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@markaz/ui';

/** 3-step onboarding progress (design spec §9.7). */
export type StepStatus = 'complete' | 'current' | 'upcoming' | 'action';

export function AuthProgress({
  current,
  statuses,
}: {
  current: 0 | 1 | 2;
  statuses?: StepStatus[];
}) {
  const t = useTranslations('progress');
  const STEPS = [t('stepAccount'), t('stepEmail'), t('stepIdentity')] as const;
  const resolved: StepStatus[] =
    statuses ??
    STEPS.map((_, i) => (i < current ? 'complete' : i === current ? 'current' : 'upcoming'));

  return (
    <div>
      <ol
        className="hidden items-center gap-2 text-xs font-medium sm:flex"
        aria-label="Account setup progress"
      >
        {STEPS.map((label, i) => {
          const s = resolved[i];
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={s === 'current' ? 'step' : undefined}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
                  s === 'complete' && 'border-success bg-success text-success-foreground',
                  s === 'current' && 'border-primary text-primary',
                  s === 'action' && 'border-warning text-warning',
                  s === 'upcoming' && 'border-border text-muted-foreground',
                )}
              >
                {s === 'complete' ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className={cn(s === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>
                {label}
                {s === 'action' ? (
                  <span className="text-warning"> · {t('actionRequired')}</span>
                ) : null}
              </span>
              {i < 2 ? <span className="bg-border mx-1 h-px w-6" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <div className="sm:hidden">
        <p className="text-muted-foreground text-xs font-medium">
          {t('stepOf', { current: current + 1, total: 3, label: STEPS[current] })}
        </p>
        <div className="bg-border mt-1.5 h-1 w-full rounded-full" aria-hidden>
          <div
            className="bg-primary h-1 rounded-full transition-all"
            style={{ width: `${((current + 1) / 3) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
