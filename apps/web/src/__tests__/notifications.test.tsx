import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

/* ------------------------------------------------------------------ mocks */
const h = vi.hoisted(() => ({
  markReadMutate: vi.fn(),
  markAllMutate: vi.fn(),
  invalidateNotifs: vi.fn(),
  invalidateCounts: vi.fn(),
  Q: {} as Record<string, unknown>,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock('@/trpc/react', () => ({
  trpc: {
    useUtils: () => ({
      offers: {
        notifications: { invalidate: h.invalidateNotifs },
        getUnreadCounts: { invalidate: h.invalidateCounts },
      },
    }),
    offers: {
      notifications: { useQuery: () => h.Q.notifications },
      getUnreadCounts: { useQuery: () => h.Q.counts },
      markNotificationRead: { useMutation: () => ({ mutate: h.markReadMutate }) },
      markAllNotificationsRead: { useMutation: () => ({ mutate: h.markAllMutate, isPending: false }) },
    },
  },
}));

import { NotificationsList } from '@/components/offers/notifications-list';

function renderList(locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={loadMessages(locale)} timeZone="Asia/Dubai" now={new Date('2026-07-14T09:00:00Z')}>
      <NotificationsList />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  h.markReadMutate.mockReset();
  h.markAllMutate.mockReset();
  h.invalidateNotifs.mockReset();
  h.invalidateCounts.mockReset();
  for (const k of Object.keys(h.Q)) delete h.Q[k];
});

describe('NotificationsList', () => {
  it('shows a loading skeleton while notifications load', () => {
    h.Q.notifications = { data: undefined, isLoading: true };
    h.Q.counts = { data: { unread: 0, actionNeeded: 0 } };
    renderList();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no notifications', () => {
    h.Q.notifications = { data: [], isLoading: false };
    h.Q.counts = { data: { unread: 0, actionNeeded: 0 } };
    renderList();
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
  });

  it('renders translated labels and links actionable notifications to their thread', () => {
    h.Q.notifications = {
      data: [
        { id: 'n1', kind: 'OFFER_ACCEPTED', threadId: 't1', read: false, createdAt: '2026-07-14T08:00:00Z' },
        { id: 'n2', kind: 'OFFER_EXPIRED', threadId: null, read: true, createdAt: '2026-07-13T08:00:00Z' },
      ],
      isLoading: false,
    };
    h.Q.counts = { data: { unread: 1, actionNeeded: 1 } };
    renderList();
    const link = screen.getByRole('link', { name: /Your offer was accepted/i });
    expect(link).toHaveAttribute('href', '/offers/t1');
    expect(screen.getByText('An offer expired.')).toBeInTheDocument();
  });

  it('shows "Mark all as read" only when there are unread notifications and calls the mutation', async () => {
    h.Q.notifications = {
      data: [{ id: 'n1', kind: 'OFFER_RECEIVED', threadId: 't1', read: false, createdAt: '2026-07-14T08:00:00Z' }],
      isLoading: false,
    };
    h.Q.counts = { data: { unread: 2, actionNeeded: 0 } };
    renderList();
    const btn = screen.getByRole('button', { name: 'Mark all as read' });
    await userEvent.click(btn);
    expect(h.markAllMutate).toHaveBeenCalledTimes(1);
  });

  it('marks an unread notification read when its link is opened', async () => {
    h.Q.notifications = {
      data: [{ id: 'n1', kind: 'OFFER_RECEIVED', threadId: 't1', read: false, createdAt: '2026-07-14T08:00:00Z' }],
      isLoading: false,
    };
    h.Q.counts = { data: { unread: 1, actionNeeded: 0 } };
    renderList();
    await userEvent.click(screen.getByRole('link', { name: /New offer received/i }));
    expect(h.markReadMutate).toHaveBeenCalledWith({ id: 'n1' }, expect.anything());
  });

  it('hides "Mark all as read" when everything is read', () => {
    h.Q.notifications = {
      data: [{ id: 'n1', kind: 'OFFER_ACCEPTED', threadId: 't1', read: true, createdAt: '2026-07-14T08:00:00Z' }],
      isLoading: false,
    };
    h.Q.counts = { data: { unread: 0, actionNeeded: 0 } };
    renderList();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });
});
