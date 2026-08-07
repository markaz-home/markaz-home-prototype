'use client';

import { useTranslations } from 'next-intl';

/** Placeholder legal destinations, matching the (auth) layout footer. */
const LEGAL = { terms: '#terms', privacy: '#privacy' };

/**
 * The single Terms + Privacy consent control shared by the email sign-up form
 * and the provider profile-setup screen. One checkbox drives BOTH consent
 * flags; the schemas and `profiles` keep separate `acceptTerms`/`acceptPrivacy`
 * fields (and separate accepted-at timestamps), so the record of what was
 * agreed to is unchanged — only the UI is combined.
 */
export function ConsentCheckbox({
  id = 'acceptConsent',
  checked,
  onChange,
  error,
}: {
  id?: string;
  checked: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
}) {
  const t = useTranslations('signup');
  const link = (href: string) => (chunks: React.ReactNode) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-4"
    >
      {chunks}
    </a>
  );
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={!!error}
          className="focus-visible:ring-ring mt-0.5 h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
        <span>{t.rich('consent', { terms: link(LEGAL.terms), privacy: link(LEGAL.privacy) })}</span>
      </label>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
