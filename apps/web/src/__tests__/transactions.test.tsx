import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

const h = vi.hoisted(() => ({
  confirmDetailsMutate: vi.fn(),
  Q: {} as Record<string, unknown>,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@markaz/realtime', () => ({ useTransactionChannel: () => ({ status: 'connected' }) }));
vi.mock('@/trpc/react', () => {
  const mut = () => ({ mutate: vi.fn(), isPending: false });
  return {
  trpc: {
    useUtils: () => ({
      transactions: {
        get: { invalidate: vi.fn() },
        listMine: { invalidate: vi.fn() },
        getActionCounts: { invalidate: vi.fn() },
      },
    }),
    transactions: {
      listMine: { useQuery: () => h.Q.listMine },
      get: { useQuery: () => h.Q.get },
      confirmDetails: { useMutation: () => ({ mutate: h.confirmDetailsMutate, isPending: false }) },
      selectRoute: { useMutation: mut },
      setFinancing: { useMutation: mut },
      confirmDeposit: { useMutation: mut },
      markDocumentsComplete: { useMutation: mut },
      reviewSummary: { useMutation: mut },
      runDueDiligence: { useMutation: mut },
      proposeTransferDate: { useMutation: mut },
      confirmReadiness: { useMutation: mut },
      createAppointment: { useMutation: mut },
      confirmCompletion: { useMutation: mut },
      requestCancellation: { useMutation: mut },
      resolveCancellation: { useMutation: mut },
    },
  },
  };
});

import { TransactionsHub } from '@/components/transactions/transactions-hub';
import { TransactionWorkspace } from '@/components/transactions/transaction-workspace';

function r(ui: React.ReactElement, locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={loadMessages(locale)} timeZone="Asia/Dubai" now={new Date('2026-07-14T09:00:00Z')}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const detail = (over: Record<string, unknown> = {}) => ({
  isLoading: false,
  isError: false,
  data: {
    id: 'tx1',
    reference: 'MKZ-TXN-2026-000001',
    status: 'INITIATED',
    statusKey: 'status.initiated',
    nextActor: 'BOTH',
    nextActorKey: 'nextActor.both',
    perspective: 'BUYER',
    property: { publicId: 'p1', slug: 's', headline: 'Marina Villa', community: 'Dubai Marina', emirate: 'Dubai', bedrooms: 2, bathrooms: 2, propertyType: 'APARTMENT', coverUrl: null },
    acceptedAmountAed: 2_000_000,
    stageIndex: 0,
    completedStages: 0,
    totalStages: 6,
    progress: { completed: 0, total: 8, ratio: 0 },
    lastActivityAt: '2026-07-10T00:00:00Z',
    version: 1,
    purchaseRoute: null,
    financingStatus: null,
    depositAmountAed: 200_000,
    depositConfirmedAt: null,
    transferPreferredDate: null,
    transferAppointmentAt: null,
    cancellation: null,
    tasks: [
      { code: 'BUYER_CONFIRM_DETAILS', stage: 'CONFIRMATION', actor: 'BUYER', status: 'ACTION_REQUIRED', required: true, mine: true, ownershipKey: 'task.you' },
      { code: 'SELLER_CONFIRM_DETAILS', stage: 'CONFIRMATION', actor: 'SELLER', status: 'ACTION_REQUIRED', required: true, mine: false, ownershipKey: 'task.seller' },
    ],
    ownDocuments: [],
    otherChecklist: {},
    timeline: [{ type: 'TRANSACTION_CREATED', actor: null, createdAt: '2026-07-10T00:00:00Z' }],
    ...over,
  },
});

beforeEach(() => {
  h.confirmDetailsMutate.mockReset();
  for (const k of Object.keys(h.Q)) delete h.Q[k];
});

describe('TransactionsHub', () => {
  it('shows the empty state when there are no transactions', () => {
    h.Q.listMine = { isLoading: false, isError: false, data: [] };
    r(<TransactionsHub />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByText(/Transaction process simulated/i)).toBeInTheDocument();
  });

  it('renders a transaction card with perspective and CTA', () => {
    h.Q.listMine = {
      isLoading: false,
      isError: false,
      data: [detail().data],
    };
    r(<TransactionsHub />);
    expect(screen.getByText('You are buying')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View transaction' })).toHaveAttribute('href', '/transactions/tx1');
  });
});

describe('TransactionWorkspace', () => {
  it('shows the unavailable state on error', () => {
    h.Q.get = { isLoading: false, isError: true, data: undefined };
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.getByText('This transaction is not available')).toBeInTheDocument();
  });

  it('renders the disclosure, progress tracker and the buyer confirm-details action', async () => {
    h.Q.get = detail();
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.getByText(/Transaction process simulated/i)).toBeInTheDocument();
    expect(screen.getByLabelText('progress')).toBeInTheDocument();
    // The buyer's confirm-details control is offered.
    const btn = screen.getByRole('button', { name: 'Confirm transaction details' });
    const ack = screen.getByRole('checkbox');
    expect(btn).toBeDisabled();
    await userEvent.click(ack);
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(h.confirmDetailsMutate).toHaveBeenCalledWith({ transactionId: 'tx1', expectedVersion: 1 });
  });

  it('shows the completed-in-demo state without transaction workflow buttons', () => {
    h.Q.get = detail({ status: 'COMPLETED_DEMO', statusKey: 'status.completed', stageIndex: 6, completedStages: 6, nextActor: 'NONE', nextActorKey: 'nextActor.none' });
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.getByText('Transaction completed in demo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay|deposit|confirm/i })).toBeNull();
  });
});
