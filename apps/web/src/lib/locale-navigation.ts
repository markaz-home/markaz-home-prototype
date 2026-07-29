/** Keep the current query string when changing locale. */
export function withCurrentSearch(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
