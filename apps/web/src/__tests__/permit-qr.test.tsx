import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

const h = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ toDataURL: h.toDataURL }));

import { PermitQr } from '@/components/sell/permit-qr';

function renderQr() {
  return render(
    <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
      <PermitQr permitNumber="DEMO-TRK-12345678" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  h.toDataURL.mockReset().mockResolvedValue('data:image/png;base64,qr');
});

describe('PermitQr', () => {
  it('warns when a QR points at localhost and provides the direct destination', async () => {
    renderQr();

    expect(
      await screen.findByText(
        /cannot be scanned from another device while the app uses localhost/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open verification page' })).toHaveAttribute(
      'href',
      expect.stringContaining('/en/permit/DEMO-TRK-12345678'),
    );
  });

  it('renders an intentional error state when QR generation fails', async () => {
    h.toDataURL.mockRejectedValue(new Error('encoder failed'));
    renderQr();

    expect(await screen.findByText('Code unavailable')).toBeInTheDocument();
  });
});
