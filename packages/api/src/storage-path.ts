/** Customer listing uploads always use `${userId}/${listingId}/...` object keys. */
export function isOwnedListingStoragePath({
  path,
  userId,
  listingId,
}: {
  path: string;
  userId: string;
  listingId: string;
}): boolean {
  const containsControlCharacter = [...path].some((character) => character.charCodeAt(0) <= 31);
  if (path.length > 500 || path.includes('\\') || containsControlCharacter) return false;
  const segments = path.split('/');
  if (segments.length < 3 || segments[0] !== userId || segments[1] !== listingId) return false;
  return segments
    .slice(2)
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
