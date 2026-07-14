import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { routing, getDirection, isLocale } from '@markaz/i18n';
import { Toaster } from '@markaz/ui';
import { TRPCProvider } from '@/trpc/react';
import '@markaz/ui/styles.css';

export const metadata: Metadata = {
  title: 'MARKAZ Admin',
  description: 'MARKAZ Home operations portal.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
