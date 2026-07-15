'use client';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { trpc } from '@/trpc/react';
import type { ListingDetail } from '@/trpc/types';

export const numOrNull = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return v.trim() === '' || Number.isNaN(n) ? null : n;
};

export type GetData = ListingDetail;
export const supabase = () => createSupabaseBrowserClient();

export function useListing(listingId: string) {
  // Always refetch on mount: wizard data changes via mutations + simulation polls,
  // so each step must reflect the authoritative server state (incl. readiness).
  return trpc.listing.get.useQuery({ listingId }, { staleTime: 0 });
}

export function StepHeader({
  ns,
}: {
  ns:
    | 'ownership'
    | 'verification'
    | 'settings'
    | 'investment'
    | 'formA'
    | 'photos'
    | 'permit'
    | 'review';
}) {
  const t = useTranslations(ns);
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {t('stepLabel')}
      </p>
      <h1 className="font-display text-brand-900 mt-1 text-2xl font-medium tracking-tight">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mt-1">{t('description')}</p>
    </div>
  );
}
