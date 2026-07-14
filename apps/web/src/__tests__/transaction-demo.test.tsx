import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { TransactionDemo } from '@/components/demo/transaction-demo';

beforeEach(() => {
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('TransactionDemo (dev-only Week-5 preview)', () => {
  it('starts on the accepted step with the continue CTA + disclosure', () => {
    renderWithIntl(<TransactionDemo />);
    expect(screen.getByRole('heading', { name: 'Offer accepted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to transaction/i })).toBeInTheDocument();
    expect(screen.getByText(/prototype demonstration/i)).toBeInTheDocument();
  });

  it('advances through the journey via the primary CTA', async () => {
    const user = userEvent.setup();
    renderWithIntl(<TransactionDemo />);
    await user.click(screen.getByRole('button', { name: /continue to transaction/i }));
    expect(screen.getByRole('heading', { name: 'Transaction overview' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm demo deposit/i }));
    expect(screen.getByRole('heading', { name: /deposit confirmed/i })).toBeInTheDocument();
  });

  it('reset returns to the first step', async () => {
    const user = userEvent.setup();
    renderWithIntl(<TransactionDemo />);
    await user.click(screen.getByRole('button', { name: /continue to transaction/i }));
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByRole('heading', { name: 'Offer accepted' })).toBeInTheDocument();
  });
});
