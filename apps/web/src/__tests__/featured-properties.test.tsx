import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

const h = vi.hoisted(() => ({ Q: {} as Record<string, unknown> }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/trpc/react', () => ({
  trpc: {
    marketplace: { featured: { useQuery: () => h.Q.internal } },
    externalProperties: { featured: { useQuery: () => h.Q.external } },
  },
}));

import { FeaturedProperties } from '@/components/landing/featured-properties';

function renderFeatured(locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={loadMessages(locale)}>
      <FeaturedProperties />
    </NextIntlClientProvider>,
  );
}

const internalCard = {
  publicId: 'markaz-1',
  slug: 'marina-apartment',
  isLive: true,
  headline: 'Two-bedroom apartment in Dubai Marina',
  askingPriceAed: 2_000_000,
  propertyType: 'APARTMENT',
  emirate: 'Dubai',
  community: 'Dubai Marina',
  bedrooms: 2,
  bathrooms: 2,
  sizeSqft: 1200,
  coverUrl: null,
  investmentCaseAvailable: false,
};

const externalCard = {
  source: 'BAYUT_API' as const,
  providerId: 'bayut-1',
  title: 'External villa in Dubai Hills',
  askingPriceAed: 5_500_000,
  propertyType: 'Villa',
  emirate: 'Dubai',
  community: 'Dubai Hills Estate',
  bedrooms: 4,
  bathrooms: 5,
  sizeSqft: 4200,
  coverUrl: null,
  externalUrl: 'https://www.bayut.com/property/details-1.html',
  verified: true,
};

beforeEach(() => {
  for (const key of Object.keys(h.Q)) delete h.Q[key];
});

describe('FeaturedProperties', () => {
  it('keeps first-party and external cards visibly distinct', () => {
    h.Q.internal = { isLoading: false, data: [internalCard] };
    h.Q.external = {
      isLoading: false,
      data: { enabled: true, available: true, provider: 'BAYUT_API', items: [externalCard] },
    };

    renderFeatured();

    expect(screen.getByText('Listed on MARKAZ')).toBeInTheDocument();
    expect(screen.getByText('External via BayutAPI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Two-bedroom apartment/i })).toHaveAttribute(
      'href',
      '/properties/markaz-1/marina-apartment',
    );
    const externalLink = screen.getByRole('link', { name: /External villa/i });
    expect(externalLink).toHaveAttribute('href', 'https://www.bayut.com/property/details-1.html');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', expect.stringContaining('nofollow'));
    expect(screen.getByText(/unaffiliated third-party API/i)).toBeInTheDocument();
  });

  it('fails closed without disrupting the rest of the landing page', () => {
    h.Q.internal = { isLoading: false, isError: true, data: undefined };
    h.Q.external = { isLoading: false, isError: false, data: { items: [] } };

    renderFeatured();

    expect(screen.queryByRole('heading', { name: 'Featured properties' })).not.toBeInTheDocument();
  });

  it('renders the Arabic source disclosure from the shared message catalogue', () => {
    h.Q.internal = { isLoading: false, data: [] };
    h.Q.external = {
      isLoading: false,
      data: { enabled: true, available: true, provider: 'BAYUT_API', items: [externalCard] },
    };

    renderFeatured('ar');

    expect(screen.getByText('مصدر خارجي عبر BayutAPI')).toBeInTheDocument();
    expect(screen.getByText(/غير تابعة لـ MARKAZ/)).toBeInTheDocument();
  });
});
