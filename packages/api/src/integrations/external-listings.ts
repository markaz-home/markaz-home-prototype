import 'server-only';
import { bayutProvider } from './bayut';
import {
  searchExternalListingProviders,
  type ExternalListingProvider,
  type ExternalSearch,
} from './external-listing-provider';

/** Registry order determines which source wins a cross-provider duplicate. */
export const externalListingProviders = [
  bayutProvider,
] as const satisfies readonly ExternalListingProvider[];

export function searchExternalListings(
  params: ExternalSearch,
  options: {
    providers?: readonly ExternalListingProvider[];
    env?: NodeJS.ProcessEnv;
  } = {},
) {
  return searchExternalListingProviders({
    providers: options.providers ?? externalListingProviders,
    params,
    env: options.env,
  });
}
