import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect }));

import BrowsePage from '@/app/[locale]/(marketplace)/browse/page';

beforeEach(() => {
  redirect.mockReset();
});

describe('legacy browse route', () => {
  it.each(['en', 'ar'])('redirects the %s route to the localized marketplace', async (locale) => {
    await BrowsePage({ params: Promise.resolve({ locale }) });

    expect(redirect).toHaveBeenCalledWith(`/${locale}/properties`);
  });
});
