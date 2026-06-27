import { CheckCircle2 } from 'lucide-react';

/** Restrained deep-blue brand panel for customer auth (design spec §9.3). */
export function CustomerSupportPanel() {
  return (
    <div className="flex h-full flex-col justify-center rounded-xl bg-brand-900 p-8 text-brand-100">
      <h2 className="font-display text-2xl font-medium text-white">
        One account. Every property journey.
      </h2>
      <p className="mt-3 text-brand-300">
        Browse, make offers, list your property, and follow each step in one place.
      </p>
      <ul className="mt-8 space-y-3 text-sm">
        {['Clear account setup', 'Secure email verification', 'Guided demo identity step'].map(
          (item) => (
            <li key={item} className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
              {item}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
