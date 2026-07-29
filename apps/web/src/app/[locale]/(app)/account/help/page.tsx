import { LifeBuoy, LockKeyhole, MailQuestion } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('support');

  const sections = [
    { icon: MailQuestion, title: t('accountTitle'), body: t('accountBody') },
    { icon: LockKeyhole, title: t('transactionTitle'), body: t('transactionBody') },
    { icon: LifeBuoy, title: t('technicalTitle'), body: t('technicalBody') },
  ];

  return (
    <main className="container max-w-4xl py-10">
      <p className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
        {t('eyebrow')}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">{t('description')}</p>

      <Alert variant="info" className="mt-6">
        {t('demoNotice')}
      </Alert>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {sections.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-primary mb-2 h-5 w-5" aria-hidden />
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-6">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="bg-card mt-8 rounded-lg border p-6">
        <h2 className="font-display text-2xl font-semibold">{t('beforeContactTitle')}</h2>
        <ul className="text-muted-foreground mt-4 list-disc space-y-2 ps-5 text-sm">
          <li>{t('beforeContactOne')}</li>
          <li>{t('beforeContactTwo')}</li>
          <li>{t('beforeContactThree')}</li>
        </ul>
        <p className="mt-5 text-sm font-medium">{t('contactAvailability')}</p>
      </section>
    </main>
  );
}
