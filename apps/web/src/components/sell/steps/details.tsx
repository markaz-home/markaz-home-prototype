'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  propertyDetailsSchema,
  PROPERTY_TYPES,
  FURNISHING_STATUSES,
  OCCUPANCY_STATUSES,
  COMPLETION_STATUSES,
  AMENITIES,
  type PropertyDetailsInput,
} from '@markaz/domain';
import { Alert, Button, FormField, Input, cn } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { WizardShell, WizardLoading, ListingUnavailable, type WizardListing } from '../wizard';
import { useAutosave } from '../use-autosave';

const numOrNull = (v: string) => {
  if (v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// zod error code → `details.err.*` i18n key (design spec §24 exact copy).
const ERR_KEY: Record<string, string> = {
  property_type_required: 'propertyType',
  emirate_unsupported: 'emirate',
  community_required: 'community',
  community_too_long: 'community',
  building_required: 'building',
  building_too_long: 'building',
  unit_identifier_required: 'unit',
  unit_identifier_too_long: 'unit',
  bedrooms_required: 'bedrooms',
  bedrooms_invalid: 'bedrooms',
  bathrooms_required: 'bathrooms',
  bathrooms_invalid: 'bathrooms',
  size_invalid: 'size',
  furnishing_required: 'furnishing',
  occupancy_required: 'occupancy',
  completion_required: 'completion',
  parking_invalid: 'parking',
  description_too_short: 'descriptionShort',
  description_too_long: 'descriptionLong',
  amenities_too_many: 'amenities',
};

import type { ListingDetail } from '@/trpc/types';

const BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const BATHROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type GetData = ListingDetail;

export function DetailsStep({ listingId }: { listingId: string }) {
  const get = trpc.listing.get.useQuery({ listingId }, { staleTime: 0 });
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  return <DetailsForm key={listingId} listingId={listingId} data={get.data} />;
}

function DetailsForm({ listingId, data }: { listingId: string; data: GetData }) {
  const t = useTranslations('details');
  const tl = useTranslations('listing');
  const tv = useTranslations('validation');
  const router = useRouter();
  const save = trpc.listing.saveDetails.useMutation();
  const autosave = useAutosave(listingId, data.version);
  const firstRender = useRef(true);
  // Localized per-field errors, keyed by field (the ERR_KEY value).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const p = data.property;
  const [form, setForm] = useState({
    propertyType: p?.propertyType ?? '',
    community: p?.community ?? '',
    buildingOrProject: p?.buildingOrProject ?? '',
    unitIdentifier: p?.unitIdentifier ?? '',
    bedrooms: p?.bedrooms ?? 1,
    bathrooms: p?.bathrooms ?? 1,
    sizeSqft: p?.sizeSqft != null ? String(p.sizeSqft) : '',
    furnishingStatus: p?.furnishingStatus ?? '',
    occupancyStatus: p?.occupancyStatus ?? '',
    completionStatus: p?.completionStatus ?? '',
    parkingSpaces: p?.parkingSpaces != null ? String(p.parkingSpaces) : '',
    description: data.description ?? '',
    features: (p?.features ?? []) as string[],
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleFeature(a: string) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(a) ? f.features.filter((x) => x !== a) : [...f.features, a],
    }));
  }

  // Debounced autosave: persist partial details 800ms after the last edit.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    autosave.schedule({
      property: {
        propertyType: form.propertyType || null,
        community: form.community || null,
        buildingOrProject: form.buildingOrProject || null,
        unitIdentifier: form.unitIdentifier || null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        sizeSqft: numOrNull(form.sizeSqft),
        furnishingStatus: form.furnishingStatus || null,
        occupancyStatus: form.occupancyStatus || null,
        completionStatus: form.completionStatus || null,
        parkingSpaces: numOrNull(form.parkingSpaces),
        features: form.features,
      },
      description: form.description || null,
    });
  }, [form, autosave.schedule]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    autosave.cancel(); // the explicit save below supersedes any pending autosave
    setFieldErrors({});
    setSaveError(null);
    const parsed = propertyDetailsSchema.safeParse({
      propertyType: form.propertyType,
      emirate: 'DUBAI',
      community: form.community,
      buildingOrProject: form.buildingOrProject,
      unitIdentifier: form.unitIdentifier,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      sizeSqft: Number(form.sizeSqft),
      furnishingStatus: form.furnishingStatus,
      occupancyStatus: form.occupancyStatus,
      completionStatus: form.completionStatus,
      parkingSpaces: form.parkingSpaces === '' ? undefined : Number(form.parkingSpaces),
      description: form.description,
      features: form.features,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = ERR_KEY[String(issue.message)] ?? 'generic';
        if (!fe[key]) fe[key] = t(`err.${key}`);
      }
      setFieldErrors(fe);
      return;
    }
    try {
      await save.mutateAsync({ listingId, ...(parsed.data as PropertyDetailsInput) });
      router.push(`/sell/listings/${listingId}/ownership`);
    } catch {
      setSaveError(t('err.generic'));
    }
  }

  const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

  return (
    <WizardShell
      listing={data as unknown as WizardListing}
      current="details"
      autosave={autosave.state}
    >
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {t('stepLabel')}
          </p>
          <h1 className="font-display text-brand-900 mt-1 text-2xl font-medium tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>

        {Object.keys(fieldErrors).length > 0 || saveError ? (
          <Alert variant="destructive" title={tv('errorSummaryTitle')}>
            <ul className="mt-1 list-inside list-disc text-sm">
              {Object.entries(fieldErrors).map(([k, m]) => (
                <li key={k}>{m}</li>
              ))}
              {saveError ? <li>{saveError}</li> : null}
            </ul>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            id="propertyType"
            label={t('propertyType')}
            error={fieldErrors.propertyType}
            required
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  type="button"
                  key={pt}
                  onClick={() => set('propertyType', pt)}
                  className={cn(
                    'rounded-md border p-3 text-sm',
                    form.propertyType === pt
                      ? 'border-primary bg-brand-100 font-medium'
                      : 'border-input',
                  )}
                  aria-pressed={form.propertyType === pt}
                >
                  {t(`type${pt.charAt(0)}${pt.slice(1).toLowerCase()}` as never)}
                </button>
              ))}
            </div>
          </FormField>

          <FormField id="emirate" label={t('emirate')}>
            <Input id="emirate" value="Dubai" readOnly aria-readonly />
            <p className="text-muted-foreground mt-1 text-xs">{t('emirateHelp')}</p>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="community" label={t('community')} error={fieldErrors.community} required>
              <Input
                id="community"
                value={form.community}
                onChange={(e) => set('community', e.target.value)}
                placeholder={t('communityPlaceholder')}
              />
            </FormField>
            <FormField id="building" label={t('building')} error={fieldErrors.building}>
              <Input
                id="building"
                value={form.buildingOrProject}
                onChange={(e) => set('buildingOrProject', e.target.value)}
                placeholder={t('buildingPlaceholder')}
              />
            </FormField>
          </div>

          <FormField id="unit" label={t('unit')} error={fieldErrors.unit} required>
            <Input
              id="unit"
              value={form.unitIdentifier}
              onChange={(e) => set('unitIdentifier', e.target.value)}
              placeholder={t('unitPlaceholder')}
            />
            <p className="text-muted-foreground mt-1 text-xs">{t('unitHelp')}</p>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField id="bedrooms" label={t('bedrooms')} error={fieldErrors.bedrooms} required>
              <select
                id="bedrooms"
                className={selectCls}
                value={form.bedrooms}
                onChange={(e) => set('bedrooms', Number(e.target.value))}
              >
                {BEDROOM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? t('studio') : n}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="bathrooms" label={t('bathrooms')} error={fieldErrors.bathrooms} required>
              <select
                id="bathrooms"
                className={selectCls}
                value={form.bathrooms}
                onChange={(e) => set('bathrooms', Number(e.target.value))}
              >
                {BATHROOM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="size" label={t('size')} error={fieldErrors.size} required>
              <Input
                id="size"
                type="number"
                inputMode="numeric"
                value={form.sizeSqft}
                onChange={(e) => set('sizeSqft', e.target.value)}
                placeholder={t('sizePlaceholder')}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              id="furnishing"
              label={t('furnishing')}
              error={fieldErrors.furnishing}
              required
            >
              <select
                id="furnishing"
                className={selectCls}
                value={form.furnishingStatus}
                onChange={(e) => set('furnishingStatus', e.target.value)}
              >
                <option value="" disabled>
                  —
                </option>
                {FURNISHING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(
                      `furnishing${s === 'PARTLY_FURNISHED' ? 'Partly' : s === 'FURNISHED' ? 'Furnished' : 'Unfurnished'}`,
                    )}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="occupancy" label={t('occupancy')} error={fieldErrors.occupancy} required>
              <select
                id="occupancy"
                className={selectCls}
                value={form.occupancyStatus}
                onChange={(e) => set('occupancyStatus', e.target.value)}
              >
                <option value="" disabled>
                  —
                </option>
                {OCCUPANCY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(
                      `occupancy${s === 'OWNER_OCCUPIED' ? 'Owner' : s === 'TENANT_OCCUPIED' ? 'Tenant' : 'Vacant'}`,
                    )}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="completion"
              label={t('completion')}
              error={fieldErrors.completion}
              required
            >
              <select
                id="completion"
                className={selectCls}
                value={form.completionStatus}
                onChange={(e) => set('completionStatus', e.target.value)}
              >
                <option value="" disabled>
                  —
                </option>
                {COMPLETION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(s === 'READY' ? 'completionReady' : 'completionOffPlan')}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField id="parking" label={t('parking')} error={fieldErrors.parking}>
            <Input
              id="parking"
              type="number"
              inputMode="numeric"
              value={form.parkingSpaces}
              onChange={(e) => set('parkingSpaces', e.target.value)}
              placeholder={t('parkingPlaceholder')}
              className="max-w-[160px]"
            />
          </FormField>

          <FormField
            id="description"
            label={t('descriptionLabel')}
            error={fieldErrors.descriptionShort ?? fieldErrors.descriptionLong}
            required
          >
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t('descriptionPlaceholder')}
              className="border-input bg-background w-full rounded-md border p-3 text-sm"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {form.description.length} / 2000 · {t('descriptionHelp')}
            </p>
          </FormField>

          <FormField id="features" label={t('amenities')} error={fieldErrors.amenities}>
            <p className="text-muted-foreground mb-2 text-xs">{t('amenitiesHelp')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.features.includes(a)}
                    onChange={() => toggleFeature(a)}
                  />
                  <span>{a.toLowerCase().replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="submit" loading={save.isPending}>
              {tl('saveContinue')}
            </Button>
          </div>
        </form>
      </div>
    </WizardShell>
  );
}
