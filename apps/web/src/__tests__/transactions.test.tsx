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
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
        confirmDetails: {
          useMutation: () => ({ mutate: h.confirmDetailsMutate, isPending: false }),
        },
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
import { Portfolio } from '@/components/transactions/portfolio';

function r(ui: React.ReactElement, locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={loadMessages(locale)}
      timeZone="Asia/Dubai"
      now={new Date('2026-07-14T09:00:00Z')}
    >
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
    property: {
      publicId: 'p1',
      slug: 's',
      headline: 'Marina Villa',
      community: 'Dubai Marina',
      emirate: 'Dubai',
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'APARTMENT',
      coverUrl: null,
    },
    acceptedAmountAed: 2_000_000,
    activeStage: 'CONFIRMATION',
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
      {
        code: 'BUYER_CONFIRM_DETAILS',
        stage: 'CONFIRMATION',
        actor: 'BUYER',
        status: 'ACTION_REQUIRED',
        required: true,
        mine: true,
        ownershipKey: 'task.you',
      },
      {
        code: 'SELLER_CONFIRM_DETAILS',
        stage: 'CONFIRMATION',
        actor: 'SELLER',
        status: 'ACTION_REQUIRED',
        required: true,
        mine: false,
        ownershipKey: 'task.seller',
      },
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
    expect(screen.queryByText(/Transaction process simulated/i)).not.toBeInTheDocument();
  });

  it('renders a transaction card with perspective and CTA', () => {
    h.Q.listMine = {
      isLoading: false,
      isError: false,
      data: [detail().data],
    };
    r(<TransactionsHub />);
    expect(screen.getByText('You are buying')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View transaction' })).toHaveAttribute(
      'href',
      '/transactions/tx1/confirm',
    );
  });
});

describe('Portfolio', () => {
  it('shows completed transactions from both customer perspectives', () => {
    h.Q.listMine = {
      isLoading: false,
      isError: false,
      data: [
        {
          ...detail().data,
          status: 'COMPLETED_DEMO',
          perspective: 'SELLER',
          completedAt: '2026-07-14T09:00:00Z',
        },
      ],
    };

    r(<Portfolio />);

    expect(screen.getByText('Sold')).toBeInTheDocument();
    expect(screen.getByText('Marina Villa')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/transactions/tx1');
  });
});

describe('TransactionWorkspace', () => {
  it('shows the unavailable state on error', () => {
    h.Q.get = { isLoading: false, isError: true, data: undefined };
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.getByText('This transaction is not available')).toBeInTheDocument();
  });

  it('renders the progress tracker and the buyer confirm-details action without the old disclosure', async () => {
    h.Q.get = detail();
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.queryByText(/Transaction process simulated/i)).not.toBeInTheDocument();
    expect(screen.getByText('Stage 1 of 6')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Transactions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your next steps' })).toBeInTheDocument();
    const stageDetails = screen.getByText('Stage details').closest('details');
    expect(stageDetails).not.toHaveAttribute('open');
    // The buyer's confirm-details control is offered.
    const btn = screen.getByRole('button', { name: 'Confirm transaction details' });
    const ack = screen.getByRole('checkbox');
    expect(btn).toBeDisabled();
    await userEvent.click(ack);
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(h.confirmDetailsMutate).toHaveBeenCalledWith({
      transactionId: 'tx1',
      expectedVersion: 1,
    });
  });

  it('shows one specific waiting message instead of repeating it in a sidebar', () => {
    h.Q.get = detail({
      status: 'CONFIRMATION',
      statusKey: 'status.confirmation',
      nextActor: 'SELLER',
      nextActorKey: 'nextActor.waitingSeller',
      reminderAt: '2026-07-15T09:00:00Z',
      tasks: [
        {
          code: 'BUYER_CONFIRM_DETAILS',
          stage: 'CONFIRMATION',
          actor: 'BUYER',
          status: 'COMPLETED_DEMO',
          required: true,
          mine: true,
          ownershipKey: 'task.you',
        },
        {
          code: 'SELLER_CONFIRM_DETAILS',
          stage: 'CONFIRMATION',
          actor: 'SELLER',
          status: 'ACTION_REQUIRED',
          required: true,
          mine: false,
          ownershipKey: 'task.seller',
        },
      ],
    });

    r(<TransactionWorkspace transactionId="tx1" />);

    expect(screen.getAllByText('Waiting for the seller')).toHaveLength(1);
    expect(screen.getByText('Seller confirms transaction details')).toBeInTheDocument();
  });

  it('shows the completed-in-demo state without transaction workflow buttons', () => {
    h.Q.get = detail({
      status: 'COMPLETED_DEMO',
      statusKey: 'status.completed',
      stageIndex: 6,
      completedStages: 6,
      nextActor: 'NONE',
      nextActorKey: 'nextActor.none',
    });
    r(<TransactionWorkspace transactionId="tx1" />);
    expect(screen.getByText('Transaction completed in demo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay|deposit|confirm/i })).toBeNull();
  });

  it('gives a buyer a clear closed journey with valid next steps after cancellation', () => {
    h.Q.get = detail({
      status: 'CANCELLED',
      statusKey: 'status.cancelled',
      nextActor: 'NONE',
      nextActorKey: 'nextActor.none',
      cancellation: { requestedBySide: 'BUYER', reason: 'BUYER_UNABLE' },
    });

    r(<TransactionWorkspace transactionId="tx1" />);

    expect(screen.getByRole('heading', { name: 'Transaction cancelled' })).toBeInTheDocument();
    expect(screen.getByText('Reason: Buyer unable to proceed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse other properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
    expect(screen.getByRole('link', { name: 'Back to transactions' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.queryByRole('link', { name: 'Manage paused listing' })).toBeNull();
  });

  it('links a seller to the real listings route after cancellation', () => {
    h.Q.get = detail({
      status: 'CANCELLED',
      statusKey: 'status.cancelled',
      nextActor: 'NONE',
      nextActorKey: 'nextActor.none',
      perspective: 'SELLER',
      cancellation: { requestedBySide: 'BUYER', reason: 'BUYER_UNABLE' },
    });

    r(<TransactionWorkspace transactionId="tx1" />);

    expect(screen.getByRole('link', { name: 'Manage paused listing' })).toHaveAttribute(
      'href',
      '/sell',
    );
  });

  it('shows the cancellation reason and response actions to the other participant', () => {
    h.Q.get = detail({
      status: 'CANCELLATION_PENDING',
      statusKey: 'status.cancellationPending',
      nextActor: 'SELLER',
      nextActorKey: 'nextActor.waitingSeller',
      perspective: 'SELLER',
      cancellation: { requestedBySide: 'BUYER', reason: 'BUYER_UNABLE' },
    });

    r(<TransactionWorkspace transactionId="tx1" />);

    expect(screen.getByText(/Buyer requested cancellation/i)).toBeInTheDocument();
    expect(screen.getByText('Reason: Buyer unable to proceed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep transaction active' })).toBeInTheDocument();
  });

  it('shows the requester that cancellation is awaiting a response', () => {
    h.Q.get = detail({
      status: 'CANCELLATION_PENDING',
      statusKey: 'status.cancellationPending',
      nextActor: 'SELLER',
      nextActorKey: 'nextActor.waitingSeller',
      cancellation: { requestedBySide: 'BUYER', reason: 'BUYER_UNABLE' },
    });

    r(<TransactionWorkspace transactionId="tx1" />);

    expect(screen.getByText(/Your cancellation request was sent/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the other participant’s response/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm cancellation' })).toBeNull();
  });
});
