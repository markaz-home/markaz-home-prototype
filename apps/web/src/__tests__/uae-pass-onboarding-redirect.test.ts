import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));

import UaePassPage from '@/app/[locale]/(auth)/onboarding/uae-pass/page';

beforeEach(() => {
  redirect.mockReset();
});

describe('retired UAE PASS onboarding route', () => {
  it.each(['en', 'ar'])('redirects the %s route to the dashboard', async (locale) => {
    await UaePassPage({ params: Promise.resolve({ locale }) });
    expect(redirect).toHaveBeenCalledWith(`/${locale}/dashboard`);
  });
});
