'use client';

import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent } from '@markaz/ui';
import { TRANSACTION_STAGES } from '@markaz/domain';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['transactions']['get'];

/** Mobile sticky action bar — shown only when this participant has a clear action
 * (spec §17.3 / §37). Surfaces the next action and jumps to the action panel; it never
 * covers the final task/timeline event because the workspace adds bottom padding on mobile. */
export function MobileActionBar({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const mineNow =
    d.nextActor === 'BOTH' ||
    (d.perspective === 'BUYER' && d.nextActor === 'BUYER') ||
    (d.perspective === 'SELLER' && d.nextActor === 'SELLER');
  if (!mineNow) return null;
  return (
    <div
      className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      role="region"
      aria-label={t('nextActor.you')}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{t('nextActor.you')}</p>
        <a
          href="#tx-actions"
          className="bg-primary text-primary-foreground inline-flex h-12 shrink-0 items-center rounded-md px-4 text-sm font-semibold"
        >
          {t('goToAction')}
        </a>
      </div>
    </div>
  );
}

export function ProgressTracker({ stageIndex }: { stageIndex: number }) {
  const t = useTranslations('transactions.stage');
  return (
    <ol className="flex flex-wrap gap-2" aria-label="progress">
      {TRANSACTION_STAGES.map((s, i) => {
        const state = i < stageIndex ? 'done' : i === stageIndex ? 'current' : 'todo';
        return (
          <li
            key={s}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              state === 'done'
                ? 'bg-primary/15 text-primary'
                : state === 'current'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}. {t(s)}
          </li>
        );
      })}
    </ol>
  );
}

export function TaskList({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('status.confirmation')}</h2>
        <ul className="divide-y">
          {d.tasks.map((task) => (
            <li key={task.code} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span dir="auto">
                {t(`taskLabel.${task.code}` as 'taskLabel.BUYER_CONFIRM_DETAILS')}
              </span>
              <Badge variant={task.status === 'COMPLETED_DEMO' ? 'outline' : 'default'}>
                {t(task.ownershipKey)}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function Timeline({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const format = useFormatterSafe();
  if (d.timeline.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('timeline.title')}</h2>
        <ol className="space-y-3">
          {d.timeline.map((e, i) => (
            <li key={i} className="text-sm">
              <p dir="auto">{t(`timeline.${e.type}` as 'timeline.TRANSACTION_CREATED')}</p>
              <time dateTime={e.createdAt} dir="ltr" className="text-muted-foreground text-xs">
                {format(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function useFormatterSafe() {
  return (iso: string) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}
