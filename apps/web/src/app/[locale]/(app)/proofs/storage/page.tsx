import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  Alert,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
} from '@markaz/ui';

export default async function StorageProofPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('storageProof');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('body')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('privateLabel')}</CardTitle>
              <StatusBadge tone="primary">private</StatusBadge>
            </div>
            <CardDescription>ownership-documents bucket — signed URLs only.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{t('deniedLabel')}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('publicLabel')}</CardTitle>
              <StatusBadge tone="success">public</StatusBadge>
            </div>
            <CardDescription>listing-photos bucket — safe public delivery.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            listing-photos/demo/*.jpg
          </CardContent>
        </Card>
      </div>
      <Alert variant="info">
        The authoritative private/public boundary is enforced by Storage RLS and proven by the
        storage integration tests (owner can read, admin can read, unrelated customer denied, direct
        public access to a private object denied).
      </Alert>
    </div>
  );
}
