'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { listingSettingsSchema } from '@markaz/domain';
import { Alert, Button, FormField, Input } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { WizardShell, WizardLoading, ListingUnavailable, type WizardListing } from '../wizard';
import { useAutosave } from '../use-autosave';
import { numOrNull, StepHeader, useListing, type GetData } from './step-shared';

// --- Listing settings -------------------------------------------------------
export function SettingsStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  return <SettingsInner key={listingId} listingId={listingId} data={get.data} />;
}
function SettingsInner({ listingId, data }: { listingId: string; data: GetData }) {
  const t = useTranslations('settings');
  const tl = useTranslations('listing');
  const router = useRouter();
  const save = trpc.listing.saveSettings.useMutation();
  const [asking, setAsking] = useState(
    data.askingPriceAed != null ? String(data.askingPriceAed) : '',
  );
  const [minNotif, setMinNotif] = useState(
    data.minNotificationPriceAed != null ? String(data.minNotificationPriceAed) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const autosave = useAutosave(listingId, data.version);
  const firstRender = useRef(true);

  // Debounced autosave of the (partial) price fields.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    autosave.schedule({
      askingPriceAed: numOrNull(asking),
      minNotificationPriceAed: numOrNull(minNotif),
    });
  }, [asking, minNotif, autosave.schedule]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    autosave.cancel();
    setError(null);
    const parsed = listingSettingsSchema.safeParse({
      askingPriceAed: Number(asking.replace(/,/g, '')),
      minNotificationPriceAed: Number(minNotif.replace(/,/g, '')),
    });
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setError(
        code === 'notification_above_asking'
          ? t('errMinAboveAsking')
          : code === 'asking_price_too_high'
            ? t('errAskingTooHigh')
            : t('errAskingInvalid'),
      );
      return;
    }
    try {
      await save.mutateAsync({ listingId, ...parsed.data });
      router.push(`/sell/listings/${listingId}/investment-case`);
    } catch {
      setError(t('errAskingInvalid'));
    }
  }

  return (
    <WizardShell
      listing={data as unknown as WizardListing}
      current="settings"
      autosave={autosave.state}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <StepHeader ns="settings" />
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <FormField id="asking" label={t('askingPrice')} required>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">AED</span>
            <Input
              id="asking"
              inputMode="numeric"
              dir="ltr"
              value={asking}
              onChange={(e) => setAsking(e.target.value)}
              placeholder={t('askingPlaceholder')}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{t('askingHelp')}</p>
        </FormField>
        <FormField id="minNotif" label={t('minNotification')} required>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">AED</span>
            <Input
              id="minNotif"
              inputMode="numeric"
              dir="ltr"
              value={minNotif}
              onChange={(e) => setMinNotif(e.target.value)}
              placeholder={t('minPlaceholder')}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{t('minExplanation')}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t('demoNote')}</p>
        </FormField>
        <div className="bg-muted/40 rounded-md border p-3 text-sm">
          <p className="font-medium">{t('visibilityTitle')}</p>
          <p className="text-muted-foreground">{t('visibilityBody')}</p>
        </div>
        <div className="flex justify-end border-t pt-4">
          <Button type="submit" loading={save.isPending}>
            {tl('saveContinue')}
          </Button>
        </div>
      </form>
    </WizardShell>
  );
}
