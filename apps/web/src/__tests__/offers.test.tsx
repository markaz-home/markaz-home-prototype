import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

/* ------------------------------------------------------------------ mocks */
// vi.mock factories are hoisted; share state through vi.hoisted (TDZ-safe).
const h = vi.hoisted(() => ({
  storeOfferIntent: vi.fn(),
  replace: vi.fn(),
  submitMutateAsync: vi.fn(),
  Q: {} as Record<string, unknown>,
}));
const { storeOfferIntent, replace, submitMutateAsync, Q } = h;

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/offer-intent', () => ({ storeOfferIntent: h.storeOfferIntent }));
vi.mock('@markaz/realtime', () => ({ useOfferThreadChannel: () => ({ status: 'connected' }) }));
vi.mock('@/trpc/react', () => ({
  trpc: {
    useUtils: () => ({
      offers: {
        getThread: { invalidate: vi.fn() },
        getBuyerThreads: { invalidate: vi.fn() },
        getSellerInbox: { invalidate: vi.fn() },
        getUnreadCounts: { invalidate: vi.fn() },
        notifications: { invalidate: vi.fn() },
      },
    }),
    offers: {
      eligibility: { useQuery: () => h.Q.eligibility },
      submitInitialProposal: { useMutation: () => ({ mutateAsync: h.submitMutateAsync, isPending: false }) },
      getBuyerThreads: { useQuery: () => h.Q.buyerThreads },
      getSellerInbox: { useQuery: () => h.Q.sellerInbox },
      getThread: { useQuery: () => h.Q.thread },
      submitBuyerCounter: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      submitSellerCounter: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      acceptSellerCounter: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      acceptBuyerProposal: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      reject: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      rejectSellerCounter: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      withdraw: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    transactions: {
      createFromAcceptedOffer: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { MakeOfferButton } from '@/components/offers/make-offer-button';
import { OfferForm } from '@/components/offers/offer-form';
import { OffersHub } from '@/components/offers/offers-hub';
import { OfferThread } from '@/components/offers/offer-thread';

const property = { headline: 'Bright 2-bedroom apartment in Marina Gate', askingPriceAed: 2_400_000, bedrooms: 2, bathrooms: 2, community: 'Dubai Marina', emirate: 'Dubai', coverUrl: null, publicId: 'mkz-x', slug: 's' };

beforeEach(() => {
  storeOfferIntent.mockReset();
  replace.mockReset();
  submitMutateAsync.mockReset();
  submitMutateAsync.mockResolvedValue({ threadId: 'thread-1', created: true });
  for (const k of Object.keys(Q)) delete Q[k];
});

describe('MakeOfferButton', () => {
  it('anonymous: shows the CTA and opens the sign-in interception', async () => {
    Q.eligibility = { isLoading: false, data: undefined };
    const user = userEvent.setup();
    renderWithIntl(<MakeOfferButton publicId="mkz-x" slug="s" isAuthenticated={false} />);
    const btn = screen.getByRole('button', { name: /make an offer/i });
    await user.click(btn);
    expect(storeOfferIntent).toHaveBeenCalledOnce();
    expect(screen.getByText('Sign in to make an offer')).toBeInTheDocument();
  });

  it('authenticated with an active thread shows "View your offer"', () => {
    Q.eligibility = { isLoading: false, data: { eligible: false, reason: 'ACTIVE_THREAD', threadId: 't1' } };
    renderWithIntl(<MakeOfferButton publicId="mkz-x" slug="s" isAuthenticated />);
    expect(screen.getByRole('link', { name: /view your offer/i })).toBeInTheDocument();
  });
});

describe('OfferForm', () => {
  it('shows the owner ineligible state', () => {
    Q.eligibility = { isLoading: false, data: { eligible: false, reason: 'OWNER' } };
    renderWithIntl(<OfferForm publicId="mkz-x" slug="s" />);
    expect(screen.getByText(/this is your listing/i)).toBeInTheDocument();
  });

  it('renders the form and shows a non-blocking low-offer warning beyond 20% below asking', async () => {
    Q.eligibility = { isLoading: false, data: { eligible: true, reason: 'OK', property } };
    const user = userEvent.setup();
    renderWithIntl(<OfferForm publicId="mkz-x" slug="s" />);
    expect(screen.getByRole('heading', { name: 'Make an offer' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your offer'), '1700000'); // ~29% below
    expect(await screen.findByText(/significantly below the asking price/i)).toBeInTheDocument();
  });
});

describe('OffersHub', () => {
  it('buyer empty state offers a browse CTA', () => {
    Q.buyerThreads = { isLoading: false, isError: false, data: [], refetch: vi.fn() };
    renderWithIntl(<OffersHub initialView="made" />);
    expect(screen.getByText('You have not made any offers yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse properties/i })).toBeInTheDocument();
  });

  it('renders buyer offer cards with status', () => {
    Q.buyerThreads = {
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      data: [
        { threadId: 't1', statusKey: 'waitingSeller', isActionable: false, lastActivityAt: new Date().toISOString(), property, currentProposal: { amountAed: 2_250_000 }, comparison: { pct: 6.3, direction: 'BELOW' } },
      ],
    };
    renderWithIntl(<OffersHub initialView="made" />);
    expect(screen.getByText('Waiting for seller')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view offer/i })).toBeInTheDocument();
  });
});

describe('OfferThread', () => {
  const baseThread = {
    threadId: 't1', version: 1, status: 'AWAITING_SELLER', statusKey: 'responseNeeded', nextActor: 'SELLER',
    isActionable: true, closedReason: null, expiresAt: null, lastActivityAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    property, currentProposal: { id: 'p1', bySide: 'BUYER', byYou: false, amountAed: 2_300_000, status: 'CURRENT', expiresAt: null, createdAt: new Date().toISOString() },
    comparison: { absDiff: 100_000, pct: 4.2, direction: 'BELOW' },
  };

  it('seller perspective shows Accept / Counter / Reject', () => {
    Q.thread = { isLoading: false, isError: false, data: { thread: { ...baseThread, perspective: 'SELLER', buyerLabel: '01', threshold: 'AT_OR_ABOVE' }, timeline: [] } };
    renderWithIntl(<OfferThread threadId="t1" />);
    expect(screen.getByRole('button', { name: 'Accept offer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make counteroffer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject offer' })).toBeInTheDocument();
  });

  it('accepted thread shows the Week-5 handoff, no transaction UI', () => {
    Q.thread = { isLoading: false, isError: false, data: { thread: { ...baseThread, perspective: 'SELLER', buyerLabel: '01', threshold: null, status: 'ACCEPTED', statusKey: 'accepted', nextActor: 'NONE', isActionable: false }, timeline: [] } };
    renderWithIntl(<OfferThread threadId="t1" />);
    expect(screen.getByRole('heading', { name: 'Offer accepted' })).toBeInTheDocument();
    expect(screen.getByText(/transaction setup will continue in the next stage/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay deposit|create transaction/i })).toBeNull();
  });

  it('unavailable / forbidden thread uses the unified safe copy', () => {
    Q.thread = { isLoading: false, isError: true, data: undefined };
    renderWithIntl(<OfferThread threadId="t1" />);
    expect(screen.getByText('This offer is not available')).toBeInTheDocument();
  });
});
