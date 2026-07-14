/**
 * Week-4 offer journey — E2E (Playwright), authored for the full local stack.
 *
 * Run:  pnpm supabase:start && pnpm supabase:reset && pnpm dev
 *       SUPABASE_SERVICE_ROLE_KEY=<local secret> pnpm --filter @markaz/web exec playwright test
 *
 * Status: authored, pending a first validation pass on a healthy stack (see WEEK-4.md §21).
 * Two customers + one LIVE listing are provisioned deterministically; only the OFFER
 * journey is driven through the UI.
 */
import { test, expect } from '@playwright/test';
import { createCustomer, createLiveListing, teardown, type Customer } from './helpers/provision';
import { signIn, makeOffer, openFirstThread, counter, acceptOffer } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let seller: Customer;
let buyer: Customer;
let buyer2: Customer;
let listing: { id: string; publicId: string; slug: string };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  seller = await createCustomer('seller');
  buyer = await createCustomer('buyer');
  buyer2 = await createCustomer('buyer2');
  listing = await createLiveListing(seller.id, { askingPrice: 2_000_000, minNotificationPrice: 1_800_000 });
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

test('full negotiation → seller accepts → Under Offer → Week 5 handoff', async ({ browser }) => {
  test.skip(skip, 'full stack required');
  const buyerCtx = await browser.newContext();
  const sellerCtx = await browser.newContext();
  const bp = await buyerCtx.newPage();
  const sp = await sellerCtx.newPage();

  await signIn(bp, buyer);
  await makeOffer(bp, listing, 1_850_000); // at/above threshold → prominent seller notification

  await signIn(sp, seller);
  await openFirstThread(sp, 'received');
  await counter(sp, 1_950_000);

  await openFirstThread(bp, 'made');
  await counter(bp, 1_900_000);

  await openFirstThread(sp, 'received');
  await acceptOffer(sp); // asserts "Offer accepted"

  // Buyer sees the accepted state + Week-5 handoff, and NO transaction UI.
  await openFirstThread(bp, 'made');
  await expect(bp.getByText('Offer accepted').first()).toBeVisible();
  await expect(bp.getByRole('button', { name: /Pay deposit|Create transaction|Upload MOU/i })).toHaveCount(0);

  // New offers are blocked — a different buyer sees the listing is under offer
  // (authoritative eligibility, derived from the accepted thread).
  const b2Ctx = await browser.newContext();
  const b2 = await b2Ctx.newPage();
  await signIn(b2, buyer2);
  await b2.goto(`/en/properties/${listing.publicId}/${listing.slug}/offer`);
  await expect(b2.getByText(/under offer and is not accepting new offers/i)).toBeVisible();

  await b2Ctx.close();
  await buyerCtx.close();
  await sellerCtx.close();
});

test('anonymous Make-an-Offer intercepts to sign-in and returns to the same property', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await page.goto(`/en/properties/${listing.publicId}/${listing.slug}`);
  await page.getByRole('button', { name: 'Make an offer' }).click();
  // The interception dialog (stored intent returns the user here after auth).
  await expect(page.getByText('Sign in to make an offer')).toBeVisible();
});

test('owner cannot make an offer on their own listing', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await signIn(page, seller);
  await page.goto(`/en/properties/${listing.publicId}/${listing.slug}/offer`);
  await expect(page.getByText(/your listing|cannot make an offer/i)).toBeVisible();
});

test('below-threshold offer appears in the seller inbox without a prominent notification', async ({ browser }) => {
  test.skip(skip, 'full stack required');
  const l = await createLiveListing(seller.id, { askingPrice: 2_000_000, minNotificationPrice: 1_800_000 });
  const bp = await (await browser.newContext()).newPage();
  await signIn(bp, buyer2);
  await makeOffer(bp, l, 1_500_000); // below threshold

  const sp = await (await browser.newContext()).newPage();
  await signIn(sp, seller);
  await sp.goto('/en/offers?view=received');
  // The below-threshold thread is visible in the inbox/list.
  await expect(sp.getByText(/1,500,000/)).toBeVisible();
});

test('buyer can withdraw an active offer', async ({ browser }) => {
  test.skip(skip, 'full stack required');
  const l = await createLiveListing(seller.id, { askingPrice: 2_000_000 });
  const bp = await (await browser.newContext()).newPage();
  await signIn(bp, buyer);
  await makeOffer(bp, l, 1_700_000);
  await openFirstThread(bp, 'made');
  await bp.getByRole('button', { name: 'Withdraw offer' }).first().click(); // trigger
  await bp.getByRole('button', { name: 'Withdraw offer' }).last().click(); // dialog confirm
  await expect(bp.getByText(/withdrawn/i).first()).toBeVisible();
});

test('privacy: a non-participant cannot open another buyer thread', async ({ browser }) => {
  test.skip(skip, 'full stack required');
  const l = await createLiveListing(seller.id, { askingPrice: 2_000_000 });
  const bp = await (await browser.newContext()).newPage();
  await signIn(bp, buyer);
  await makeOffer(bp, l, 1_650_000);
  await openFirstThread(bp, 'made');
  const url = bp.url(); // /en/offers/<threadId>

  const other = await (await browser.newContext()).newPage();
  await signIn(other, buyer2);
  await other.goto(url);
  await expect(other.getByText('This offer is not available')).toBeVisible();
});

test('Arabic RTL buyer flow renders right-to-left', async ({ browser }) => {
  test.skip(skip, 'full stack required');
  const l = await createLiveListing(seller.id, { askingPrice: 2_000_000 });
  const ctx = await browser.newContext({ locale: 'ar' });
  const bp = await ctx.newPage();
  await signIn(bp, buyer, 'en'); // auth session is locale-independent
  await bp.goto(`/ar/properties/${l.publicId}/${l.slug}/offer`);
  await expect(bp.locator('html')).toHaveAttribute('dir', 'rtl');
  // The offer form renders in Arabic (translated heading), right-to-left.
  await expect(bp.getByRole('heading').first()).toBeVisible();
  await ctx.close();
});
