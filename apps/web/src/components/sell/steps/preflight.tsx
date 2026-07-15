'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter, Link } from '@/i18n/navigation';
import { WizardLoading } from '../wizard';

// --- /sell/new preflight: resume a recent empty draft or create a new one ---
export function NewListingPreflight() {
  const t = useTranslations('listing');
  const router = useRouter();
  const draft = trpc.listing.resumableDraft.useQuery();
  const create = trpc.listing.create.useMutation({
    onSuccess: ({ listingId }) => router.replace(`/sell/listings/${listingId}/details`),
  });
  const [decided, setDecided] = useState(false);
  useEffect(() => {
    if (draft.isSuccess && draft.data === null && !decided && !create.isPending) {
      setDecided(true);
      create.mutate();
    }
  }, [draft.isSuccess, draft.data, decided, create]);

  if (draft.isLoading || create.isPending) return <WizardLoading />;
  if (draft.data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <h1 className="font-display text-brand-900 text-2xl font-medium">{t('resumeTitle')}</h1>
        <p className="text-muted-foreground">{t('resumeBody')}</p>
        <div className="flex flex-col items-center gap-2">
          <Button onClick={() => router.replace(`/sell/listings/${draft.data!.listingId}`)}>
            {t('resumeContinue')}
          </Button>
          <Button variant="outline" loading={create.isPending} onClick={() => create.mutate()}>
            {t('resumeCreate')}
          </Button>
          <Link href="/sell" className="text-muted-foreground text-sm hover:underline">
            {t('backToListings')}
          </Link>
        </div>
      </div>
    );
  }
  return <WizardLoading />;
}
