/**
 * Admin auth content area. The persistent Operations chrome (deep-blue band,
 * "Authorised access only", language control) lives in the shared `(auth)` layout
 * so it does not re-mount between screens — only this content swaps.
 */
export function AdminAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-[440px]">{children}</div>
    </div>
  );
}

/** Heading block for admin auth. */
export function AdminHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-brand-900 text-2xl font-medium tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}
