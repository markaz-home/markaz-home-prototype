import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // My Listings now lives at /sell (Week 2 listing journey).
  redirect(`/${locale}/sell`);
}
