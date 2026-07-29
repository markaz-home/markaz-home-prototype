import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BadgeCheck, ArrowRight } from 'lucide-react';
import { Alert, Badge, Button, EmptyState } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { getServerApi } from '@/server/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; permitNumber: string }>;
}): Promise<Metadata> {
  const { locale, permitNumber } = await params;
  const t = await getTranslations({ locale, namespace: 'permitCheck' });
  return { title: `${t('title')} · ${decodeURIComponent(permitNumber)} · Markaz Home` };
}

/**
 * Where the Madmoun QR on a listing leads. Public by design: a buyer scans the
 * code to confirm the advert carries a valid permit, so this must resolve
 * without an account. Only the approved permit's public-safe fields are shown.
 */
export default async function PermitVerificationPage({
  params,
}: {
  params: Promise<{ locale: string; permitNumber: string }>;
}) {
  const { locale, permitNumber } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('permitCheck');
  const tf = await getTranslations('filters');
  const api = await getServerApi();
  const reference = decodeURIComponent(permitNumber);
  const permit = await api.permit.verify({ permitNumber: reference }).catch(() => null);

  return (
    <div className="container max-w-[680px] py-12">
      <h1 className="font-display text-3xl font-semibold">{t('title')}</h1>

      {permit ? (
        <>
          <div className="border-border/70 bg-card/40 mt-6 rounded-lg border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-primary inline-flex items-center gap-2 text-sm font-medium">
                <BadgeCheck className="h-5 w-5" aria-hidden />
                {t('validTitle')}
              </span>
              <Badge>{t('statusApproved')}</Badge>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label={t('fieldPermit')} value={permit.permitNumber} mono />
              {permit.approvedAt ? (
                <Row
                  label={t('fieldIssued')}
                  value={new Date(permit.approvedAt).toLocaleDateString(locale)}
                />
              ) : null}
              {permit.propertyType ? (
                <Row
                  label={t('fieldProperty')}
                  value={tf(
                    `type${permit.propertyType.charAt(0)}${permit.propertyType.slice(1).toLowerCase()}` as 'typeApartment',
                  )}
                />
              ) : null}
              {permit.buildingOrProject ? (
                <Row label={t('fieldBuilding')} value={permit.buildingOrProject} />
              ) : null}
              {permit.community || permit.emirate ? (
                <Row
                  label={t('fieldLocation')}
                  value={[permit.community, permit.emirate].filter(Boolean).join(' · ')}
                />
              ) : null}
            </dl>

            {permit.publicId ? (
              <Button asChild className="mt-6 rounded-full">
                <Link href={`/properties/${permit.publicId}/${permit.slug ?? ''}`}>
                  {t('viewListing')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
            ) : (
              <p className="text-muted-foreground mt-6 text-sm">{t('notPublished')}</p>
            )}
          </div>

          <Alert variant="info" className="mt-4">
            <p className="font-medium">{t('simTitle')}</p>
            <p className="text-muted-foreground text-sm">{t('simBody')}</p>
          </Alert>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={null}
            title={t('notFoundTitle')}
            description={t('notFoundBody', { reference })}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border/60 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-medium tabular-nums' : 'font-medium'} dir="auto">
        {value}
      </dd>
    </div>
  );
}
