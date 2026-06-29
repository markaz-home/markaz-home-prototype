'use client';
import { useState } from 'react';
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
import { WizardShell, WizardLoading, ListingUnavailable, type WizardListing, type AutosaveState } from '../wizard';

import type { ListingDetail } from '@/trpc/types';

const BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const BATHROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type GetData = ListingDetail;

export function DetailsStep({ listingId }: { listingId: string }) {
  const get = trpc.listing.get.useQuery({ listingId }, { staleTime: 0, refetchOnMount: 'always' });
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
  const [autosave, setAutosave] = useState<AutosaveState>('idle');
  const [errors, setErrors] = useState<string[]>([]);

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
    setForm((f) => ({ ...f, features: f.features.includes(a) ? f.features.filter((x) => x !== a) : [...f.features, a] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
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
      setErrors(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return;
    }
    setAutosave('saving');
    try {
      await save.mutateAsync({ listingId, ...(parsed.data as PropertyDetailsInput) });
      setAutosave('saved');
      router.push(`/sell/listings/${listingId}/ownership`);
    } catch {
      setAutosave('error');
    }
  }

  const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

  return (
    <WizardShell listing={data as unknown as WizardListing} current="details" autosave={autosave}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('stepLabel')}</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-brand-900">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>

        {errors.length > 0 ? (
          <Alert variant="destructive" title={tv('errorSummaryTitle')}>
            <ul className="mt-1 list-inside list-disc text-sm">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField id="propertyType" label={t('propertyType')} required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  type="button"
                  key={pt}
                  onClick={() => set('propertyType', pt)}
                  className={cn('rounded-md border p-3 text-sm', form.propertyType === pt ? 'border-primary bg-brand-100 font-medium' : 'border-input')}
                  aria-pressed={form.propertyType === pt}
                >
                  {t(`type${pt.charAt(0)}${pt.slice(1).toLowerCase()}` as never)}
                </button>
              ))}
            </div>
          </FormField>

          <FormField id="emirate" label={t('emirate')}>
            <Input id="emirate" value="Dubai" readOnly aria-readonly />
            <p className="mt-1 text-xs text-muted-foreground">{t('emirateHelp')}</p>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="community" label={t('community')} required>
              <Input id="community" value={form.community} onChange={(e) => set('community', e.target.value)} placeholder={t('communityPlaceholder')} />
            </FormField>
            <FormField id="building" label={t('building')}>
              <Input id="building" value={form.buildingOrProject} onChange={(e) => set('buildingOrProject', e.target.value)} placeholder={t('buildingPlaceholder')} />
            </FormField>
          </div>

          <FormField id="unit" label={t('unit')} required>
            <Input id="unit" value={form.unitIdentifier} onChange={(e) => set('unitIdentifier', e.target.value)} placeholder={t('unitPlaceholder')} />
            <p className="mt-1 text-xs text-muted-foreground">{t('unitHelp')}</p>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField id="bedrooms" label={t('bedrooms')} required>
              <select id="bedrooms" className={selectCls} value={form.bedrooms} onChange={(e) => set('bedrooms', Number(e.target.value))}>
                {BEDROOM_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n === 0 ? t('studio') : n}</option>
                ))}
              </select>
            </FormField>
            <FormField id="bathrooms" label={t('bathrooms')} required>
              <select id="bathrooms" className={selectCls} value={form.bathrooms} onChange={(e) => set('bathrooms', Number(e.target.value))}>
                {BATHROOM_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </FormField>
            <FormField id="size" label={t('size')} required>
              <Input id="size" type="number" inputMode="numeric" value={form.sizeSqft} onChange={(e) => set('sizeSqft', e.target.value)} placeholder={t('sizePlaceholder')} />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField id="furnishing" label={t('furnishing')} required>
              <select id="furnishing" className={selectCls} value={form.furnishingStatus} onChange={(e) => set('furnishingStatus', e.target.value)}>
                <option value="" disabled>—</option>
                {FURNISHING_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`furnishing${s === 'PARTLY_FURNISHED' ? 'Partly' : s === 'FURNISHED' ? 'Furnished' : 'Unfurnished'}`)}</option>
                ))}
              </select>
            </FormField>
            <FormField id="occupancy" label={t('occupancy')} required>
              <select id="occupancy" className={selectCls} value={form.occupancyStatus} onChange={(e) => set('occupancyStatus', e.target.value)}>
                <option value="" disabled>—</option>
                {OCCUPANCY_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`occupancy${s === 'OWNER_OCCUPIED' ? 'Owner' : s === 'TENANT_OCCUPIED' ? 'Tenant' : 'Vacant'}`)}</option>
                ))}
              </select>
            </FormField>
            <FormField id="completion" label={t('completion')} required>
              <select id="completion" className={selectCls} value={form.completionStatus} onChange={(e) => set('completionStatus', e.target.value)}>
                <option value="" disabled>—</option>
                {COMPLETION_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(s === 'READY' ? 'completionReady' : 'completionOffPlan')}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField id="parking" label={t('parking')}>
            <Input id="parking" type="number" inputMode="numeric" value={form.parkingSpaces} onChange={(e) => set('parkingSpaces', e.target.value)} placeholder={t('parkingPlaceholder')} className="max-w-[160px]" />
          </FormField>

          <FormField id="description" label={t('descriptionLabel')} required>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">{form.description.length} / 2000 · {t('descriptionHelp')}</p>
          </FormField>

          <FormField id="features" label={t('amenities')}>
            <p className="mb-2 text-xs text-muted-foreground">{t('amenitiesHelp')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.features.includes(a)} onChange={() => toggleFeature(a)} />
                  <span>{a.toLowerCase().replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="submit" loading={save.isPending}>{tl('saveContinue')}</Button>
          </div>
        </form>
      </div>
    </WizardShell>
  );
}
