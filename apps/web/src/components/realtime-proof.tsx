'use client';
import { useTranslations } from 'next-intl';
import { useCounterChannel, DEMO_COUNTER_ID } from '@markaz/realtime';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
} from '@markaz/ui';
import { trpc } from '@/trpc/react';

export function RealtimeProof() {
  const t = useTranslations('realtimeProof');
  const { value, status } = useCounterChannel(DEMO_COUNTER_ID);
  const increment = trpc.realtime.increment.useMutation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('body')}</p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('counter')}</CardTitle>
            <StatusBadge tone={status === 'connected' ? 'success' : 'warning'}>
              {status === 'connected' ? t('connected') : t('disconnected')}
            </StatusBadge>
          </div>
          <CardDescription>{t('note')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-5xl font-semibold tabular-nums" data-testid="counter-value">
            {value ?? '—'}
          </p>
          <Button onClick={() => increment.mutate()} loading={increment.isPending}>
            {t('increment')}
          </Button>
        </CardContent>
      </Card>
      <Alert variant="info">{t('note')}</Alert>
    </div>
  );
}
