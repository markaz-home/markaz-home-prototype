import 'server-only';

import { execRow, execRows, getDirectDb, sql } from '@markaz/db';
import { loadMessages } from '@markaz/i18n';
import { logger } from '@markaz/observability';
import { resolveCustomerEmail } from '@/lib/customer-email';

const MAX_ATTEMPTS = 5;
const DEFAULT_REMINDER_HOURS = 24;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type ClaimedJob = {
  id: string;
  notificationId: string;
  attempts: number;
};

type DeliveryContext = ClaimedJob & {
  recipientId: string;
  kind: string;
  payload: unknown;
  email: string;
  fullName: string | null;
  listingTitle: string | null;
  community: string | null;
  buildingOrProject: string | null;
  coverPublicPath: string | null;
  acceptedAmountAed: string | number | null;
  transactionReference: string | null;
  transactionBuyerId: string | null;
  transactionSellerId: string | null;
};

export type NotificationEmailInput = {
  kind: string;
  recipientName: string | null;
  recipientPerspective: 'BUYER' | 'SELLER' | null;
  property: string;
  amountAed: number | null;
  reference: string | null;
  coverUrl: string | null;
  actionUrl: string;
  locale?: string;
  reminderHours?: number;
};

export type RenderedNotificationEmail = {
  subject: string;
  html: string;
  text: string;
};

type Copy = {
  subject: string;
  title: string;
  body: string;
  cta: string;
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z]+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatAed(value: number | null, locale: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value);
}

function copyFor(input: NotificationEmailInput): Copy {
  const messages = loadMessages(input.locale ?? 'en').notificationEmail;
  const amount = formatAed(input.amountAed, input.locale ?? 'en');
  const values = {
    property: input.property,
    amount,
    hours: input.reminderHours ?? DEFAULT_REMINDER_HOURS,
  };
  const c = (key: keyof typeof messages) => interpolate(messages[key], values);

  switch (input.kind) {
    case 'OFFER_RECEIVED':
      return {
        subject: c('offerReceivedSubject'),
        title: c('offerReceivedTitle'),
        body: c('offerReceivedBody'),
        cta: c('reviewOffer'),
      };
    case 'OFFER_COUNTER_SELLER':
    case 'OFFER_COUNTER_BUYER':
      return {
        subject: c('counterSubject'),
        title: c('counterTitle'),
        body: c('counterBody'),
        cta: c('respondCounter'),
      };
    case 'OFFER_REJECTED':
      return {
        subject: c('rejectedSubject'),
        title: c('rejectedTitle'),
        body: c('rejectedBody'),
        cta: c('viewNegotiation'),
      };
    case 'OFFER_WITHDRAWN':
      return {
        subject: c('withdrawnSubject'),
        title: c('withdrawnTitle'),
        body: c('withdrawnBody'),
        cta: c('viewNegotiation'),
      };
    case 'OFFER_CLOSED_OTHER':
    case 'OFFER_LISTING_UNAVAILABLE':
    case 'OFFER_EXPIRED':
      return {
        subject: c('closedSubject'),
        title: c('closedTitle'),
        body: c('closedBody'),
        cta: c('viewNegotiation'),
      };
    case 'TRANSACTION_CREATED': {
      const buyer = input.recipientPerspective === 'BUYER';
      return {
        subject: c(buyer ? 'acceptedBuyerSubject' : 'acceptedSellerSubject'),
        title: c(buyer ? 'acceptedBuyerTitle' : 'acceptedSellerTitle'),
        body: c(buyer ? 'acceptedBuyerBody' : 'acceptedSellerBody'),
        cta: c('continueTransaction'),
      };
    }
    case 'TRANSACTION_REMINDER':
      return {
        subject: c('reminderSubject'),
        title: c('reminderTitle'),
        body: c('reminderBody'),
        cta: c('continueTransaction'),
      };
    case 'TRANSACTION_DEPOSIT_CONFIRMED_DEMO':
      return {
        subject: c('depositSubject'),
        title: c('depositTitle'),
        body: c('depositBody'),
        cta: c('continueTransaction'),
      };
    case 'TRANSACTION_TRANSFER_READY':
      return {
        subject: c('transferSubject'),
        title: c('transferTitle'),
        body: c('transferBody'),
        cta: c('continueTransaction'),
      };
    case 'TRANSACTION_COMPLETED_DEMO':
      return {
        subject: c('completedSubject'),
        title: c('completedTitle'),
        body: c('completedBody'),
        cta: c('continueTransaction'),
      };
    case 'TRANSACTION_CANCELLATION_REQUESTED':
    case 'TRANSACTION_CANCELLED':
      return {
        subject: c('cancellationSubject'),
        title: c('cancellationTitle'),
        body: c('cancellationBody'),
        cta: c('continueTransaction'),
      };
    case 'TRANSACTION_FAILED':
    case 'TRANSACTION_MARKED_FAILED':
      return {
        subject: c('failedSubject'),
        title: c('failedTitle'),
        body: c('failedBody'),
        cta: c('continueTransaction'),
      };
    default:
      return {
        subject: c('actionSubject'),
        title: c('actionTitle'),
        body: c('actionBody'),
        cta: c('continueTransaction'),
      };
  }
}

/** Pure renderer: inline styles and absolute assets survive major email clients. */
export function renderNotificationEmail(input: NotificationEmailInput): RenderedNotificationEmail {
  const locale = input.locale ?? 'en';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = loadMessages(locale).notificationEmail;
  const copy = copyFor(input);
  const name = input.recipientName?.trim().split(/\s+/)[0] || messages.recipientFallback;
  const greeting = interpolate(messages.greeting, { name });
  const amount = formatAed(input.amountAed, locale);
  const logoUrl = `${new URL(input.actionUrl).origin}/markaz-logo-gold.png`;
  const cover = input.coverUrl
    ? `<img src="${escapeHtml(input.coverUrl)}" alt="" width="600" style="display:block;width:100%;height:220px;object-fit:cover;border-radius:10px 10px 0 0" />`
    : '';
  const referenceRow = input.reference
    ? `<tr><td style="padding:7px 0;color:#9d9893;font-size:13px">${escapeHtml(messages.referenceLabel)}</td><td dir="ltr" style="padding:7px 0;text-align:${dir === 'rtl' ? 'left' : 'right'};color:#f7f1e9;font-size:13px">${escapeHtml(input.reference)}</td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="margin:0;background:#080706;color:#f7f1e9;font-family:Arial,'Helvetica Neue',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(copy.body)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080706;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
          <tr><td style="padding:0 0 22px;text-align:center">
            <img src="${escapeHtml(logoUrl)}" alt="MARKAZ Home" width="196" style="display:inline-block;width:196px;height:auto" />
          </td></tr>
          <tr><td style="border:1px solid #3d352d;border-radius:11px;background:#12100f;overflow:hidden">
            ${cover}
            <div style="padding:34px 34px 30px">
              <div style="color:#d5ad7b;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">MARKAZ HOME</div>
              <h1 style="margin:14px 0 18px;color:#fffaf4;font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:1.2;font-weight:500">${escapeHtml(copy.title)}</h1>
              <p style="margin:0 0 12px;color:#ded8d1;font-size:16px;line-height:1.65">${escapeHtml(greeting)}</p>
              <p style="margin:0 0 24px;color:#bdb6af;font-size:16px;line-height:1.65">${escapeHtml(copy.body)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 26px;border-top:1px solid #322d28;border-bottom:1px solid #322d28">
                <tr><td style="padding:15px 0 7px;color:#9d9893;font-size:13px">${escapeHtml(messages.propertyLabel)}</td><td style="padding:15px 0 7px;text-align:${dir === 'rtl' ? 'left' : 'right'};color:#f7f1e9;font-size:13px;font-weight:700">${escapeHtml(input.property)}</td></tr>
                <tr><td style="padding:7px 0;color:#9d9893;font-size:13px">${escapeHtml(messages.amountLabel)}</td><td dir="ltr" style="padding:7px 0;text-align:${dir === 'rtl' ? 'left' : 'right'};color:#d5ad7b;font-size:16px;font-weight:700">${escapeHtml(amount)}</td></tr>
                ${referenceRow}
                <tr><td colspan="2" style="height:8px"></td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:8px;background:#d5ad7b">
                <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:14px 24px;color:#15110d;text-decoration:none;font-size:15px;font-weight:700">${escapeHtml(copy.cta)}</a>
              </td></tr></table>
              <p style="margin:25px 0 0;color:#8f8983;font-size:12px;line-height:1.6">${escapeHtml(messages.secureNote)}</p>
              <p style="margin:8px 0 0;color:#8f8983;font-size:12px;line-height:1.6">${escapeHtml(messages.nonBinding)}</p>
            </div>
          </td></tr>
          <tr><td style="padding:20px 22px 0;text-align:center;color:#766f69;font-size:11px;line-height:1.5">${escapeHtml(messages.footer)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    'MARKAZ Home',
    copy.title,
    greeting,
    copy.body,
    `${messages.propertyLabel}: ${input.property}`,
    `${messages.amountLabel}: ${amount}`,
    input.reference ? `${messages.referenceLabel}: ${input.reference}` : null,
    `${copy.cta}: ${input.actionUrl}`,
    messages.secureNote,
    messages.nonBinding,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  return { subject: copy.subject, html, text };
}

function publicPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  return `${base}/storage/v1/object/public/listing-photos/${path}`;
}

function payloadIds(payload: unknown): { threadId: string | null; transactionId: string | null } {
  if (!payload || typeof payload !== 'object') return { threadId: null, transactionId: null };
  const p = payload as Record<string, unknown>;
  return {
    threadId: typeof p.threadId === 'string' ? p.threadId : null,
    transactionId: typeof p.transactionId === 'string' ? p.transactionId : null,
  };
}

async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const db = getDirectDb();
  return execRows<ClaimedJob>(
    db,
    sql`
      with jobs as (
        select id
        from private.notification_email_outbox
        where (status = 'PENDING' and available_at <= now())
           or (status = 'SENDING' and locked_at <= now() - interval '15 minutes')
        order by created_at
        for update skip locked
        limit ${limit}
      )
      update private.notification_email_outbox o
      set status = 'SENDING', locked_at = now(), attempts = attempts + 1
      from jobs
      where o.id = jobs.id
      returning o.id::text, o.notification_id::text as "notificationId", o.attempts
    `,
  );
}

async function loadContext(job: ClaimedJob): Promise<DeliveryContext | null> {
  return execRow<DeliveryContext>(
    getDirectDb(),
    sql`
      select
        o.id::text,
        o.notification_id::text as "notificationId",
        o.recipient_id::text as "recipientId",
        o.attempts,
        n.kind,
        n.payload,
        recipient.email,
        recipient.full_name as "fullName",
        coalesce(nullif(l.title, ''), prop.building_or_project, prop.community) as "listingTitle",
        prop.community,
        prop.building_or_project as "buildingOrProject",
        (
          select pp.public_path from public.property_photos pp
          where pp.listing_id = l.id and pp.is_cover and pp.public_path is not null
          order by pp.sort_order limit 1
        ) as "coverPublicPath",
        tx.accepted_amount_aed as "acceptedAmountAed",
        tx.reference as "transactionReference",
        tx.buyer_user_id::text as "transactionBuyerId",
        tx.seller_user_id::text as "transactionSellerId"
      from private.notification_email_outbox o
      join public.notifications n on n.id = o.notification_id
      join public.profiles recipient on recipient.id = o.recipient_id
      left join public.transactions tx
        on tx.id = nullif(n.payload->>'transactionId', '')::uuid
      left join public.listings l
        on l.id = coalesce(tx.listing_id, nullif(n.payload->>'listingId', '')::uuid)
      left join public.properties prop on prop.id = l.property_id
      where o.id = ${job.id}::uuid
    `,
  );
}

async function setSkipped(jobId: string): Promise<void> {
  await getDirectDb().execute(sql`
    update private.notification_email_outbox
    set status = 'SKIPPED_NO_EMAIL', locked_at = null, last_error = null
    where id = ${jobId}::uuid
  `);
}

async function setSent(jobId: string, providerMessageId: string | null): Promise<void> {
  await getDirectDb().execute(sql`
    update private.notification_email_outbox
    set status = 'SENT', sent_at = now(), locked_at = null,
        provider_message_id = ${providerMessageId}, last_error = null
    where id = ${jobId}::uuid
  `);
}

async function setFailed(job: ClaimedJob, errorCode: string): Promise<void> {
  const terminal = job.attempts >= MAX_ATTEMPTS;
  const retryMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
  await getDirectDb().execute(sql`
    update private.notification_email_outbox
    set status = ${terminal ? 'FAILED' : 'PENDING'},
        available_at = now() + (${retryMinutes}::text || ' minutes')::interval,
        locked_at = null,
        last_error = ${errorCode.slice(0, 160)}
    where id = ${job.id}::uuid
  `);
}

async function sendWithResend(
  to: string,
  email: RenderedNotificationEmail,
  idempotencyKey: string,
): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Stable per canonical notification: retries are safe, distinct events with
      // the same subject are never collapsed together by the provider.
      'Idempotency-Key': `markaz-notification-${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
  const body = (await response.json()) as { id?: unknown };
  return typeof body.id === 'string' ? body.id : null;
}

function actionUrlFor(context: DeliveryContext, locale: string): string {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const ids = payloadIds(context.payload);
  const path = ids.transactionId
    ? `/transactions/${ids.transactionId}`
    : ids.threadId
      ? `/offers/${ids.threadId}`
      : '/account/notifications';
  return new URL(`/${locale}${path}`, base).toString();
}

/** Called only by the authenticated cron route. Returns counts, never PII. */
export async function processNotificationEmailOutbox(limit = 20) {
  const reminderHours = Number(process.env.TRANSACTION_REMINDER_HOURS ?? DEFAULT_REMINDER_HOURS);
  await getDirectDb().execute(
    sql`select private.queue_due_transaction_reminders(${reminderHours})`,
  );

  if ((process.env.EMAIL_PROVIDER ?? 'disabled') !== 'resend') {
    return { claimed: 0, sent: 0, skipped: 0, failed: 0, provider: 'disabled' as const };
  }

  const jobs = await claimJobs(Math.max(1, Math.min(limit, 50)));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      const context = await loadContext(job);
      if (!context) throw new Error('EMAIL_CONTEXT_MISSING');
      const email = resolveCustomerEmail(context.email, null);
      if (!email) {
        await setSkipped(job.id);
        skipped += 1;
        continue;
      }
      const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'ar' ? 'ar' : 'en';
      const messages = loadMessages(locale).notificationEmail;
      const payload =
        context.payload && typeof context.payload === 'object'
          ? (context.payload as Record<string, unknown>)
          : {};
      const amountFromPayload = Number(payload.amountAed);
      const amount = Number.isFinite(amountFromPayload)
        ? amountFromPayload
        : context.acceptedAmountAed == null
          ? null
          : Number(context.acceptedAmountAed);
      const perspective =
        context.transactionBuyerId === context.recipientId
          ? 'BUYER'
          : context.transactionSellerId === context.recipientId
            ? 'SELLER'
            : null;
      const rendered = renderNotificationEmail({
        kind: context.kind,
        recipientName: context.fullName,
        recipientPerspective: perspective,
        property: context.listingTitle ?? messages.propertyFallback,
        amountAed: amount,
        reference: context.transactionReference,
        coverUrl: publicPhotoUrl(context.coverPublicPath),
        actionUrl: actionUrlFor(context, locale),
        locale,
        reminderHours,
      });
      const providerId = await sendWithResend(email, rendered, context.notificationId);
      await setSent(job.id, providerId);
      sent += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'EMAIL_DELIVERY_FAILED';
      await setFailed(job, code);
      logger.warn({ jobId: job.id, errorCode: code }, 'notification.email.failed');
      failed += 1;
    }
  }
  return { claimed: jobs.length, sent, skipped, failed, provider: 'resend' as const };
}
