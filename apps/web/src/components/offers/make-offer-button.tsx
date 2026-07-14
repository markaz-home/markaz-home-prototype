'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { storeOfferIntent } from '@/lib/offer-intent';

/**
 * Property-page Make an Offer CTA (offers-design-spec §10.1, §31). For an
 * anonymous visitor it opens the sign-in interception, storing a safe intent
 * (publicId + return route only — never an amount). For an authenticated
 * non-owner it resolves eligibility server-side and renders the correct state:
 * Make an offer / View your offer / Under offer.
 */
export function MakeOfferButton({
  publicId,
  slug,
  isAuthenticated,
}: {
  publicId: string;
  slug: string;
  isAuthenticated: boolean;
}) {
  const t = useTranslations('offers');
  const locale = useLocale();
  const [authOpen, setAuthOpen] = useState(false);
  const offerPath = `/properties/${publicId}/${slug}/offer`;
  const returnPath = `/${locale}${offerPath}`;

  // Eligibility is only resolved for authenticated viewers (anon → interception).
  const eligibility = trpc.offers.eligibility.useQuery(
    { publicId },
    { enabled: isAuthenticated, staleTime: 10_000 },
  );

  if (!isAuthenticated) {
    return (
      <>
        <Button
          onClick={() => {
            storeOfferIntent({ publicId, returnPath, locale });
            setAuthOpen(true);
          }}
        >
          <Tag className="h-4 w-4 me-2" aria-hidden /> {t('cta.make')}
        </Button>
        <Dialog open={authOpen} onOpenChange={setAuthOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('auth.title')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('auth.body')}</p>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button asChild className="w-full">
                <Link href="/sign-in">{t('auth.signIn')}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-up">{t('auth.create')}</Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setAuthOpen(false)}>
                {t('auth.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (eligibility.isLoading) {
    return <Button loading>{t('cta.make')}</Button>;
  }

  const data = eligibility.data;
  if (data && !data.eligible && data.reason === 'ACTIVE_THREAD' && 'threadId' in data) {
    return (
      <Button asChild>
        <Link href={`/offers/${data.threadId}`}>{t('cta.view')}</Link>
      </Button>
    );
  }
  if (data && !data.eligible && data.reason === 'UNDER_OFFER') {
    return <Badge variant="outline">{t('cta.underOffer')}</Badge>;
  }
  if (data && !data.eligible && (data.reason === 'UNAVAILABLE' || data.reason === 'OWNER')) {
    return null; // owner branch handled by the page; unavailable hides the CTA
  }

  return (
    <Button asChild>
      <Link href={offerPath}>
        <Tag className="h-4 w-4 me-2" aria-hidden /> {t('cta.make')}
      </Link>
    </Button>
  );
}
