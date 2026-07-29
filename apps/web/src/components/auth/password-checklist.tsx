'use client';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { checkPasswordRequirements, passwordStrength } from '@markaz/domain';
import { cn } from '@markaz/ui';

const RULES = ['length', 'uppercase', 'lowercase', 'number', 'special'] as const;
const RULE_FIELD = {
  length: 'minLength',
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  number: 'number',
  special: 'special',
} as const;

/**
 * Live password requirements (authoritative) + a restrained 3-segment strength
 * line (supplementary). Design spec §10.6/§10.7. `submitted` turns unmet rows red.
 */
export function PasswordChecklist({
  password,
  submitted = false,
}: {
  password: string;
  submitted?: boolean;
}) {
  const t = useTranslations('password');
  const req = checkPasswordRequirements(password);
  const strength = passwordStrength(password); // 0..3
  const strengthLabel =
    strength === 0
      ? ''
      : strength === 1
        ? t('incomplete')
        : strength === 2
          ? t('meets')
          : t('strong');

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex h-1.5 flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'flex-1 rounded-full',
                i <= strength
                  ? strength === 1
                    ? 'bg-destructive'
                    : strength === 2
                      ? 'bg-warning'
                      : 'bg-success'
                  : 'bg-border',
              )}
            />
          ))}
        </div>
        {strengthLabel ? (
          <span className="text-muted-foreground text-xs">{strengthLabel}</span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs font-medium">{t('requirementsTitle')}</p>
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = req[RULE_FIELD[rule]];
          // An untouched, empty field is not a failure — stay neutral until
          // there is something to judge, even after a submit attempt.
          const failed = !ok && submitted && password.length > 0;
          return (
            <li
              key={rule}
              className={cn(
                'flex items-center gap-1.5',
                ok ? 'text-success' : failed ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : failed ? (
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                // Plain bullet until the rule is met or the form is submitted.
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                  <span className="h-1 w-1 rounded-full bg-current" />
                </span>
              )}
              <span>{t(rule)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
