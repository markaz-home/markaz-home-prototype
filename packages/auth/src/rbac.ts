import type { AccountType } from '@markaz/domain';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' = 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** Throws unless the account type matches. Used by the admin app + ADMIN procedures. */
export function assertAccountType(
  actual: AccountType | undefined,
  required: AccountType,
): asserts actual is AccountType {
  if (actual === undefined) {
    throw new AuthorizationError('Authentication required', 'UNAUTHENTICATED');
  }
  if (actual !== required) {
    throw new AuthorizationError(`Requires ${required} account`, 'FORBIDDEN');
  }
}
