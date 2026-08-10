'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Circle, UserRound } from 'lucide-react';
import { Badge, Card, CardContent, cn } from '@markaz/ui';
import { TRANSACTION_STAGES, type TransactionStage } from '@markaz/domain';
import { formatDateTime } from '@/lib/format';
import type { RouterOutputs } from '@/trpc/types';
import { Link } from '@/i18n/navigation';
import { slugForStage } from '@/lib/transaction-routes';

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

export function ProgressTracker({
  stageIndex,
  transactionId,
  viewedStage,
}: {
  stageIndex: number;
  transactionId: string;
  viewedStage: TransactionStage;
}) {
  const t = useTranslations('transactions');
  const total = TRANSACTION_STAGES.length;
  const current = Math.min(stageIndex + 1, total);
  return (
    <section className="space-y-3" aria-labelledby="transaction-stage-progress">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p
            id="transaction-stage-progress"
            className="text-primary text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t('stageProgress', { current, total })}
          </p>
          <p className="mt-1 text-sm font-medium">{t(`stage.${viewedStage}`)}</p>
        </div>
        <p className="text-muted-foreground text-xs">
          {t(stageIndex >= total ? 'stageDone' : 'stageCurrent')}
        </p>
      </div>
      <ol className="grid grid-cols-6 gap-2" aria-label={t('title')}>
        {TRANSACTION_STAGES.map((s, i) => {
          const state = i < stageIndex ? 'done' : i === stageIndex ? 'current' : 'todo';
          const selected = s === viewedStage;
          const className = cn(
            'group flex min-w-0 flex-col gap-2 text-start outline-none',
            i <= stageIndex && 'cursor-pointer',
          );
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors',
                  state === 'done' || state === 'current' ? 'bg-primary' : 'bg-foreground/15',
                  selected && 'ring-primary/45 ring-offset-background ring-2 ring-offset-2',
                  i <= stageIndex && 'group-hover:bg-primary/80',
                )}
              />
              <span
                className={cn(
                  'hidden truncate text-xs sm:block',
                  selected
                    ? 'text-foreground font-semibold'
                    : state === 'done'
                      ? 'text-primary'
                      : 'text-muted-foreground',
                )}
              >
                {i + 1}. {t(`stage.${s}`)}
              </span>
            </>
          );
          return (
            <li key={s} className="min-w-0">
              {i <= stageIndex ? (
                <Link
                  href={`/transactions/${transactionId}/${slugForStage(s)}`}
                  className={className}
                  aria-current={selected ? 'step' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span className={className} aria-disabled="true">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The full checklist, grouped by stage instead of a flat 17-row dump.
 *
 * Only the current stage is expanded: earlier stages are summarised as done and
 * later ones stay folded, so the page shows what is happening now rather than
 * every step both participants will ever take. Each row says WHO owns it in one
 * word — the old "Your action required / Seller action required" repetition made
 * the two participants' identical task names look like duplicated rows.
 */
export function TaskList({ d, stage }: { d: Detail; stage?: TransactionStage }) {
  const t = useTranslations('transactions');
  const ts = useTranslations('transactions.stage');

  function who(task: Detail['tasks'][number]): string {
    if (task.actor === 'SYSTEM') return t('whoSystem');
    if (task.actor === 'BOTH') return t('whoBoth');
    if (task.mine) return t('whoYou');
    return task.actor === 'BUYER' ? t('whoBuyer') : t('whoSeller');
  }

  const groups = TRANSACTION_STAGES.map((groupStage, index) => {
    const tasks = d.tasks.filter((task) => task.stage === groupStage);
    const done = tasks.filter((task) => task.status === 'COMPLETED_DEMO').length;
    return {
      stage: groupStage,
      index,
      tasks,
      done,
      state: index < d.stageIndex ? 'done' : index === d.stageIndex ? 'current' : 'todo',
    };
  }).filter((group) => group.tasks.length > 0 && (!stage || group.stage === stage));

  const group = groups[0];
  if (!group) return null;

  return (
    <details className="border-border/70 bg-card/30 group rounded-xl border">
      <summary className="hover:bg-foreground/[0.025] flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-4 transition-colors sm:px-5">
        <span
          aria-hidden
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
            group.state === 'current'
              ? 'border-primary bg-primary text-primary-foreground'
              : group.state === 'done'
                ? 'border-primary/60 text-primary'
                : 'border-foreground/25 text-muted-foreground',
          )}
        >
          {group.state === 'done' ? <Check className="h-3.5 w-3.5" /> : group.index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('checklistTitle')}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {ts(group.stage)} · {t('checklistHelp')}
          </span>
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('stageCount', { completed: group.done, total: group.tasks.length })}
        </span>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="border-border/70 divide-border/60 divide-y border-t">
        {group.tasks.map((task) => {
          const complete = task.status === 'COMPLETED_DEMO';
          return (
            <li
              key={task.code}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                {complete ? (
                  <Check className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Circle className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span dir="auto" className={cn('min-w-0', complete && 'text-muted-foreground')}>
                  {t(`taskLabel.${task.code}` as 'taskLabel.BUYER_CONFIRM_DETAILS')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(task.mine && 'border-primary/40 bg-primary/10 text-primary')}
                >
                  {who(task)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    complete
                      ? 'border-success/35 bg-success/10 text-success'
                      : 'text-muted-foreground',
                  )}
                >
                  {complete ? t('task.completed') : t('participants.pending')}
                </Badge>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** A participant-first view of the current stage. It makes the shared nature of
 * the transaction obvious: each side has one column, with completed/waiting/action
 * states derived from the authoritative task rows. */
export function ParticipantProgress({ d, stage }: { d: Detail; stage: TransactionStage }) {
  const t = useTranslations('transactions');
  const stageTasks = d.tasks.filter((task) => task.stage === stage);

  const side = (actor: 'BUYER' | 'SELLER') => {
    const tasks = stageTasks.filter((task) => task.actor === actor);
    const completed = tasks.filter((task) => task.status === 'COMPLETED_DEMO').length;
    const actionable = tasks.some((task) => task.status === 'ACTION_REQUIRED');
    const complete = tasks.length > 0 && completed === tasks.length;
    const isYou = d.perspective === actor;
    return { actor, tasks, completed, actionable, complete, isYou };
  };

  return (
    <section
      aria-labelledby="participant-progress-title"
      className="border-border/70 bg-card/25 space-y-3 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="participant-progress-title" className="font-semibold">
          {t('participants.title')}
        </h2>
        <p className="text-muted-foreground text-xs">{t('participants.body')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(['BUYER', 'SELLER'] as const).map((actor) => {
          const s = side(actor);
          const status =
            s.tasks.length === 0
              ? t('participants.noAction')
              : s.complete
                ? t('participants.complete')
                : s.actionable
                  ? s.isYou
                    ? t('participants.yourAction')
                    : t('participants.theirAction')
                  : t('participants.waiting');
          return (
            <Card
              key={actor}
              className={cn(
                'bg-card/50',
                s.actionable && 'border-primary/45',
                s.complete && 'border-success/40',
              )}
            >
              <CardContent className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="border-primary/30 bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full border">
                    <UserRound className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {actor === 'BUYER' ? t('participants.buyer') : t('participants.seller')}
                      {s.isYou ? (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          {t('participants.you')}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0',
                    s.complete && 'border-success/35 bg-success/10 text-success',
                    s.actionable && !s.complete && 'border-primary/40 bg-primary/10 text-primary',
                  )}
                >
                  {status}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function Timeline({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const locale = useLocale();
  if (d.timeline.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('timeline.title')}</h2>
        <ol>
          {d.timeline.map((e, i) => (
            <li key={i} className="relative grid grid-cols-[1rem_1fr] gap-3 pb-5 text-sm last:pb-0">
              {i < d.timeline.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-border absolute start-[0.4375rem] top-3 h-[calc(100%-0.25rem)] w-px"
                />
              ) : null}
              <span
                className="border-primary bg-background relative z-10 mt-1 h-3 w-3 rounded-full border-2"
                aria-hidden
              />
              <span>
                <p dir="auto">{t(`timeline.${e.type}` as 'timeline.TRANSACTION_CREATED')}</p>
                <time dateTime={e.createdAt} dir="ltr" className="text-muted-foreground text-xs">
                  {formatDateTime(e.createdAt, locale)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
