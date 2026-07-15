import { eq } from 'drizzle-orm';
import { getAppDb, profiles, withUserContext, type Database } from '@markaz/db';
import type { AccountType } from '@markaz/domain';
import { logger, type Logger } from '@markaz/observability';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  accountType: AccountType;
}

export interface Context {
  db: Database;
  /** Validated authenticated user (null for public/anonymous requests). */
  user: AuthenticatedUser | null;
  requestId: string;
  log: Logger;
}

export interface CreateContextOptions {
  /** Already-validated Supabase user (from supabase.auth.getUser()), or null. */
  user: { id: string; email?: string } | null;
  requestId?: string;
}

let counter = 0;
function nextRequestId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `req_${counter.toString(36)}`;
}

/**
 * Builds the tRPC request context. If a user is present we resolve their
 * account_type by reading their OWN profile under RLS (auth.uid() = id), so the
 * service-role key is never involved in establishing identity (§6A.3).
 */
export async function createTRPCContext(opts: CreateContextOptions): Promise<Context> {
  const db = getAppDb();
  const requestId = opts.requestId ?? nextRequestId();
  const log = logger.child({ requestId });

  let user: AuthenticatedUser | null = null;
  if (opts.user) {
    const provisional = {
      userId: opts.user.id,
      email: opts.user.email,
      accountType: 'CUSTOMER' as AccountType,
    };
    const profile = await withUserContext(db, provisional, async (tx) => {
      const rows = await tx
        .select({ accountType: profiles.accountType })
        .from(profiles)
        .where(eq(profiles.id, opts.user!.id))
        .limit(1);
      return rows[0];
    });
    user = {
      id: opts.user.id,
      email: opts.user.email,
      accountType: profile?.accountType ?? 'CUSTOMER',
    };
  }

  return { db, user, requestId, log };
}
