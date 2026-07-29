import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Arabic, Source_Serif_4 } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { routing, getDirection, isLocale } from '@markaz/i18n';
import { Toaster } from '@markaz/ui';
import { TRPCProvider } from '@/trpc/react';
import '@markaz/ui/styles.css';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-sans-arabic',
});

export const metadata: Metadata = {
  title: 'Markaz Home',
  description: 'Buy and sell property in the UAE — one account does both.',
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
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${manrope.variable} ${sourceSerif.variable} ${notoSansArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
