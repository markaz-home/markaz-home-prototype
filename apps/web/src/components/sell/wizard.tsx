'use client';
import { useTranslations } from 'next-intl';
import { Check, Lock, Loader2, AlertTriangle } from 'lucide-react';
import type { WizardStep, SectionStatus } from '@markaz/domain';
import { Alert, Badge, Spinner, cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';

/** Ordered wizard steps (design spec §6) with their i18n label + section keys. */
export const WIZARD_STEP_CONFIG: {
  key: WizardStep;
  labelKey: string;
  section?: string;
  optional?: boolean;
}[] = [
  { key: 'details', labelKey: 'stepDetails', section: 'details' },
  { key: 'ownership', labelKey: 'stepOwnership', section: 'ownership' },
  { key: 'verification', labelKey: 'stepVerification', section: 'verification' },
  { key: 'settings', labelKey: 'stepSettings', section: 'settings' },
  { key: 'investment-case', labelKey: 'stepInvestment', section: 'investment', optional: true },
  { key: 'form-a', labelKey: 'stepFormA', section: 'formA' },
  { key: 'photos', labelKey: 'stepPhotos', section: 'photos' },
  { key: 'trakheesi', labelKey: 'stepTrakheesi', section: 'permit' },
  { key: 'review', labelKey: 'stepReview' },
];

const STEP_INDEX: Record<string, number> = Object.fromEntries(
  WIZARD_STEP_CONFIG.map((s, i) => [s.key, i]),
);

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  const t = useTranslations('listing');
  if (state === 'idle') return null;
  if (state === 'saving')
    return (
      <span
        className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
        role="status"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {t('saving')}
      </span>
    );
  if (state === 'saved')
    return (
      <span className="text-muted-foreground text-xs" role="status">
        {t('savedJustNow')}
      </span>
    );
  return (
    <span className="text-destructive text-xs" role="status">
      {t('saveFailed')}
    </span>
  );
}

/** Calm pale-blue simulation disclosure shown on every simulated screen (§5.5). */
export function SimDisclosure({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-brand-200 bg-brand-100/50 rounded-lg border p-4 text-sm">
      <p className="text-brand-900 flex items-center gap-2 font-medium">
        <Badge variant="warning" className="uppercase tracking-wide">
          Demo
        </Badge>
        {title}
      </p>
      <p className="text-muted-foreground mt-1">{body}</p>
    </div>
  );
}

const STATUS_LABEL: Record<SectionStatus, string> = {
  NOT_STARTED: 'sectionMissing',
  IN_PROGRESS: 'sectionInProgress',
  COMPLETE: 'sectionComplete',
  OPTIONAL_SKIPPED: 'sectionSkipped',
  PENDING: 'sectionPending',
  FAILED: 'sectionFailed',
  REQUIRES_ATTENTION: 'sectionAttention',
};
const STATUS_VARIANT: Record<
  SectionStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  NOT_STARTED: 'outline',
  IN_PROGRESS: 'default',
  COMPLETE: 'success',
  OPTIONAL_SKIPPED: 'outline',
  PENDING: 'default',
  FAILED: 'destructive',
  REQUIRES_ATTENTION: 'warning',
};

export function SectionBadge({ status }: { status: SectionStatus }) {
  const t = useTranslations('listing');
  return <Badge variant={STATUS_VARIANT[status]}>{t(STATUS_LABEL[status])}</Badge>;
}

export interface WizardListing {
  id: string;
  state: string;
  title: string;
  property: {
    propertyType: string | null;
    community: string | null;
    buildingOrProject: string | null;
  } | null;
  sections: Record<string, SectionStatus>;
  nextStep: WizardStep;
}

function PropertyIdentity({ listing }: { listing: WizardListing }) {
  const t = useTranslations('listing');
  const td = useTranslations('details');
  const p = listing.property;
  if (!p || (!p.community && !p.buildingOrProject)) {
    return <p className="text-muted-foreground text-sm">{t('newPropertyListing')}</p>;
  }
  const typeLabel = p.propertyType
    ? td(`type${p.propertyType.charAt(0)}${p.propertyType.slice(1).toLowerCase()}` as never)
    : '';
  const bits = [p.buildingOrProject, typeLabel, p.community].filter(Boolean);
  return <p className="text-brand-900 text-sm font-medium">{bits.join(' · ')}</p>;
}

/** Wizard chrome: property identity + autosave + stepper. Used by every step page. */
export function WizardShell({
  listing,
  current,
  autosave = 'idle',
  children,
}: {
  listing: WizardListing;
  current: WizardStep;
  autosave?: AutosaveState;
  children: React.ReactNode;
}) {
  const t = useTranslations('listing');
  const furthestIdx = STEP_INDEX[listing.nextStep] ?? 0;
  const currentIdx = STEP_INDEX[current] ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/sell" className="text-muted-foreground hover:text-foreground text-sm">
          {t('backToListings')}
        </Link>
        <AutosaveIndicator state={autosave} />
      </div>
      <div className="mb-6">
        <PropertyIdentity listing={listing} />
        <p className="text-muted-foreground mt-1 text-xs">
          {t('stepOf', { current: currentIdx + 1, total: 9 })}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Listing steps" className="hidden lg:block">
          <ol className="space-y-1">
            {WIZARD_STEP_CONFIG.map((s, i) => {
              const status = s.section ? listing.sections[s.section] : undefined;
              const accessible = i <= furthestIdx;
              const isCurrent = s.key === current;
              const content = (
                <span
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                    isCurrent && 'bg-brand-100 text-brand-900 font-medium',
                    !isCurrent && accessible && 'text-foreground hover:bg-muted',
                    !accessible && 'text-muted-foreground',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {status === 'COMPLETE' ? (
                    <Check className="text-success h-4 w-4" aria-hidden />
                  ) : status === 'FAILED' || status === 'REQUIRES_ATTENTION' ? (
                    <AlertTriangle className="text-warning h-4 w-4" aria-hidden />
                  ) : status === 'PENDING' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : !accessible ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <span className="h-4 w-4 text-center text-xs">{i + 1}</span>
                  )}
                  <span>
                    {t(s.labelKey)}
                    {s.optional ? (
                      <span className="text-muted-foreground ms-1 text-xs">· {t('optional')}</span>
                    ) : null}
                  </span>
                </span>
              );
              return (
                <li key={s.key}>
                  {accessible && !isCurrent ? (
                    <Link href={`/sell/listings/${listing.id}/${s.key}`}>{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function WizardLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ListingUnavailable() {
  const t = useTranslations('listing');
  return (
    <div className="mx-auto max-w-lg py-12">
      <Alert variant="warning" title={t('unavailableTitle')}>
        <p className="mt-1">{t('unavailableBody')}</p>
        <Link
          href="/sell"
          className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
        >
          {t('backToListings')}
        </Link>
      </Alert>
    </div>
  );
}

/** AED formatting helper (whole dirhams, grouped, value bidi-isolated in RTL). */
export function formatAed(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `AED ${new Intl.NumberFormat('en-US').format(value)}`;
}
