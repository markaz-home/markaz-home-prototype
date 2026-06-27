import { z } from 'zod';

/**
 * Two account types only. Buyer and Seller are journeys, not roles —
 * every CUSTOMER can both buy and sell. There is no Buyer/Seller account.
 */
export const ACCOUNT_TYPES = ['CUSTOMER', 'ADMIN'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

/** CUSTOMER is the only safe self-service default. */
export const DEFAULT_ACCOUNT_TYPE: AccountType = 'CUSTOMER';

/** Customers may never promote themselves to ADMIN. */
export function canSelfAssignAccountType(target: AccountType): boolean {
  return target === 'CUSTOMER';
}

/**
 * Guard for a profile-update payload: reject any attempt to set account_type
 * to a privileged value. Used by the profile router and tested in unit tests.
 */
export function isAccountTypeChangeAllowed(
  current: AccountType,
  requested: AccountType | undefined,
): boolean {
  if (requested === undefined) return true;
  if (requested === current) return true;
  // The only safe self-service transition is staying CUSTOMER. Promotion is denied.
  return false;
}

export function isAdmin(accountType: AccountType): boolean {
  return accountType === 'ADMIN';
}

export function isCustomer(accountType: AccountType): boolean {
  return accountType === 'CUSTOMER';
}
