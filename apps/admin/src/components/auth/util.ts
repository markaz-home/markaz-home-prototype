/** Masks an email for display: t••••@gmail.com (design spec §11.3). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(2, local.length - head.length))}@${domain}`;
}
