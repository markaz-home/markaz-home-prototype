'use client';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { checkPasswordRequirements, passwordStrength } from '@markaz/domain';
import { cn as cx } from '@markaz/ui';

const RULES = ['minLength', 'uppercase', 'lowercase', 'number', 'special'] as const;

/** Live password requirements + a coarse strength meter (UX only). */
export function PasswordChecklist({ password }: { password: string }) {
  const t = useTranslations('password');
  const req = checkPasswordRequirements(password);
  const strength = passwordStrength(password);
  const labels = ['', t('strengthWeak'), t('strengthFair'), t('strengthGood'), t('strengthStrong')];

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cx(
                'flex-1 rounded-full',
                i <= strength
                  ? strength <= 1
                    ? 'bg-destructive'
                    : strength === 2
                      ? 'bg-warning'
                      : 'bg-success'
                  : 'bg-border',
              )}
            />
          ))}
        </div>
        {password ? <span className="text-xs text-muted-foreground">{labels[strength]}</span> : null}
      </div>
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = req[rule];
          return (
            <li
              key={rule}
              className={cx('flex items-center gap-1.5', ok ? 'text-success' : 'text-muted-foreground')}
            >
              {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
              <span>{t(`rule_${rule}`)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
