/**
 * Admin auth content area. The persistent cover, wordmark, language control and
 * access label live in the shared `(auth)` layout so only this card swaps.
 */
export function AdminAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center overflow-y-auto px-5 py-24 sm:px-6">
      <div className="platform-gold-auth-card platform-gold-admin-auth-card w-full max-w-[480px] rounded-3xl border p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

/** Heading block for admin auth. */
export function AdminHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-foreground text-3xl font-medium tracking-tight">{title}</h1>
      {description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
