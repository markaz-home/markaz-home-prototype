'use client';
import { useTranslations } from 'next-intl';
import { cn } from '@markaz/ui';

/** Two-step account setup progress: account details, then email verification. */
export type StepStatus = 'complete' | 'current' | 'upcoming' | 'action';

/**
 * Segmented bar plus a gold step eyebrow, matching the platform onboarding
 * direction. The bar is decorative; the eyebrow carries the visible text and the
 * full "step N of M" context goes to assistive technology.
 */
export function AuthProgress({ current, statuses }: { current: 0 | 1; statuses?: StepStatus[] }) {
  const t = useTranslations('progress');
  const STEPS = [t('stepAccount'), t('stepEmail')] as const;
  const resolved: StepStatus[] =
    statuses ??
    STEPS.map((_, i) => (i < current ? 'complete' : i === current ? 'current' : 'upcoming'));
  const actionRequired = resolved[current] === 'action';

  return (
    <div>
      <div className="flex items-center gap-2" aria-hidden>
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              resolved[i] === 'action'
                ? 'bg-warning'
                : resolved[i] === 'complete' || resolved[i] === 'current'
                  ? 'bg-primary'
                  : // Upcoming steps must stay visible on the near-black card,
                    // so the remaining journey is legible at a glance.
                    'bg-foreground/25',
            )}
          />
        ))}
      </div>
      <p
        className="text-primary mt-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
        aria-hidden
      >
        {t('stepEyebrow', {
          number: String(current + 1).padStart(2, '0'),
          label: STEPS[current],
        })}
        {actionRequired ? <span className="text-warning"> · {t('actionRequired')}</span> : null}
      </p>
      <p className="sr-only" aria-label={t('label')}>
        {t('stepOf', { current: current + 1, total: STEPS.length, label: STEPS[current] })}
        {actionRequired ? ` · ${t('actionRequired')}` : ''}
      </p>
    </div>
  );
}
