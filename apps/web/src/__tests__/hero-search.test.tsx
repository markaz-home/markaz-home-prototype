import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/trpc/react', () => ({
  trpc: {
    marketplace: {
      getFilterOptions: {
        useQuery: () => ({ data: { emirates: ['Dubai'], communities: ['Dubai Marina'] } }),
      },
    },
    externalProperties: {
      featured: {
        useQuery: () => ({
          data: { items: [{ community: 'Dubai Hills Estate' }, { community: 'Palm Jumeirah' }] },
        }),
      },
    },
  },
}));

import {
  HeroSearch,
  buildPropertySearchQuery,
  rankPlaceSuggestions,
} from '@/components/landing/hero-search';

function renderHero() {
  push.mockClear();
  return render(
    <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
      <HeroSearch />
    </NextIntlClientProvider>,
  );
}

describe('buildPropertySearchQuery', () => {
  it('omits every untouched control', () => {
    expect(buildPropertySearchQuery({ q: '  ', type: '', price: '', beds: '' })).toBe('');
  });

  it('maps a price band onto the marketplace min/max pair', () => {
    expect(buildPropertySearchQuery({ q: '', type: '', price: '1to3m', beds: '' })).toBe(
      'minPrice=1000000&maxPrice=3000000',
    );
    expect(buildPropertySearchQuery({ q: '', type: '', price: 'under1m', beds: '' })).toBe(
      'maxPrice=1000000',
    );
    expect(buildPropertySearchQuery({ q: '', type: '', price: '5plus', beds: '' })).toBe(
      'minPrice=5000000',
    );
  });

  it('trims the search text and passes the browse filter values through', () => {
    expect(
      buildPropertySearchQuery({ q: '  Dubai Marina ', type: 'VILLA', price: '', beds: 'studio' }),
    ).toBe('q=Dubai+Marina&type=VILLA&beds=studio');
  });
});

describe('rankPlaceSuggestions', () => {
  const places = ['Dubai Marina', 'Marina Promenade', 'Palm Jumeirah', 'Dubai Hills Estate'];

  it('suggests nothing until something is typed', () => {
    expect(rankPlaceSuggestions(places, '   ')).toEqual([]);
  });

  it('puts prefix matches before matches found mid-name', () => {
    expect(rankPlaceSuggestions(places, 'marina')).toEqual(['Marina Promenade', 'Dubai Marina']);
  });

  it('ignores case and still lists a name typed out in full', () => {
    expect(rankPlaceSuggestions(places, 'PALM')).toEqual(['Palm Jumeirah']);
    expect(rankPlaceSuggestions(places, 'Palm Jumeirah')).toEqual(['Palm Jumeirah']);
  });

  it('matches a district named mid-string, as typed without its article', () => {
    expect(rankPlaceSuggestions(['The Meadows', 'The Lakes'], 'meadows')).toEqual(['The Meadows']);
  });
});

describe('HeroSearch', () => {
  it('completes a place from live inventory as you type', async () => {
    const user = userEvent.setup();
    renderHero();

    const input = screen.getByRole('combobox', { name: 'Search' });
    await user.type(input, 'dubai h');
    await user.click(await screen.findByRole('option', { name: 'Dubai Hills Estate' }));

    expect(input).toHaveValue('Dubai Hills Estate');
    await user.click(screen.getByRole('button', { name: 'Search properties' }));
    expect(push).toHaveBeenCalledWith('/properties?q=Dubai+Hills+Estate');
  });

  it('sends the chosen dropdown filters to the public marketplace', async () => {
    const user = userEvent.setup();
    renderHero();

    await user.click(screen.getByRole('button', { name: /Property type/ }));
    await user.click(screen.getByRole('option', { name: 'Villa' }));
    await user.click(screen.getByRole('button', { name: /Bedrooms/ }));
    await user.click(screen.getByRole('option', { name: 'Studio' }));
    await user.click(screen.getByRole('button', { name: 'Search properties' }));

    expect(push).toHaveBeenCalledWith('/properties?type=VILLA&beds=studio');
  });

  it('opens and picks from a dropdown with the keyboard', async () => {
    const user = userEvent.setup();
    renderHero();

    const trigger = screen.getByRole('button', { name: /Price range/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(trigger).toHaveTextContent('Up to AED 1M');
    await user.click(screen.getByRole('button', { name: 'Search properties' }));
    expect(push).toHaveBeenCalledWith('/properties?maxPrice=1000000');
  });
});
