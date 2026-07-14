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
}: {
  children: React.ReactNode;
  support?: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="container py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16">
        <div className={cn(support ? 'lg:col-span-7' : 'lg:col-span-12')}>
          <div
            className={cn(
              'mx-auto w-full',
              narrow ? 'max-w-[480px]' : 'max-w-[520px]',
              support && 'lg:ms-0',
            )}
          >
            {children}
          </div>
        </div>
        {support ? <aside className="hidden lg:col-span-5 lg:block">{support}</aside> : null}
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
    <div className="space-y-3">
      {progress}
      <h1 className="font-display text-brand-900 text-3xl font-medium tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground text-pretty">{description}</p> : null}
    </div>
  );
}
