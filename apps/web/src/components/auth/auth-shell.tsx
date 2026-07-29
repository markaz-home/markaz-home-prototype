import { cn } from '@markaz/ui';

/**
 * Customer auth content area (design spec §9.3). The persistent chrome (header,
 * footer, language switcher, skip link) lives in the shared `(auth)` layout so it
 * does NOT re-mount between screens — only this content swaps. Split form/support
 * layout; support hidden < 1024px.
 */
export function AuthShell({
  children,
  support,
  narrow = false,
  wide = false,
}: {
  children: React.ReactNode;
  support?: React.ReactNode;
  narrow?: boolean;
  /** Two-column forms need the extra width to stay unscrolled. */
  wide?: boolean;
}) {
  // Without a support panel the card is the whole screen: centred on both axes.
  // A tall form fills the height anyway, so it still starts high and unscrolled.
  if (!support) {
    return (
      <div className="container relative flex flex-1 items-center justify-center py-6 md:py-7">
        <div
          className={cn(
            'platform-gold-auth-card w-full rounded-2xl border p-5 sm:p-6',
            narrow ? 'max-w-[430px]' : wide ? 'max-w-[620px]' : 'max-w-[500px]',
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="container relative py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div
            className={cn(
              'platform-gold-auth-card mx-auto w-full rounded-2xl border p-6 sm:p-8 lg:ms-0',
              narrow ? 'max-w-[480px]' : 'max-w-[520px]',
            )}
          >
            {children}
          </div>
        </div>
        <aside className="hidden lg:col-span-5 lg:block">{support}</aside>
      </div>
    </div>
  );
}

/** Heading block for an auth form (progress slot + h1 + description). */
export function AuthHeading({
  title,
  description,
  progress,
}: {
  title: string;
  description?: string;
  progress?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {progress}
      <h1 className="font-display text-primary text-xl font-medium tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground text-pretty">{description}</p> : null}
    </div>
  );
}
