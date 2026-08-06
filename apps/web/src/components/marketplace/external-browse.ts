import type { RouterOutputs } from '@/trpc/types';

export type ExternalBrowseCard = RouterOutputs['externalProperties']['search']['items'][number];

/** External provider inventory is public discovery only; customer workspaces use MARKAZ listings. */
export function shouldShowExternalInventory(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}
