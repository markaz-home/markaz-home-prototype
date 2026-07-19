import { Home } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markaz/ui';

/** Calm, centred shell shared by every customer auth screen. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Home className="text-primary h-4 w-4" aria-hidden /> MARKAZ Home
          </span>
          <CardTitle className="font-display text-primary text-2xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
      {footer ? (
        <div className="text-muted-foreground mt-4 text-center text-sm">{footer}</div>
      ) : null}
    </div>
  );
}

/** Masks an email for display: a***@example.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}
