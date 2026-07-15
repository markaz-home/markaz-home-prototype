'use client';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { WizardLoading, ListingUnavailable } from '../wizard';
import { useListing } from './step-shared';

// --- Resolver: redirect to the recommended next step ------------------------
export function ListingResolver({ listingId }: { listingId: string }) {
  const router = useRouter();
  const get = useListing(listingId);
  useEffect(() => {
    if (get.data) router.replace(`/sell/listings/${listingId}/${get.data.nextStep}`);
  }, [get.data, listingId, router]);
  if (get.error) return <ListingUnavailable />;
  return <WizardLoading />;
}
