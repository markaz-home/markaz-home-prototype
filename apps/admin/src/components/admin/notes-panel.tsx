'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StickyNote, Plus } from 'lucide-react';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, toast } from '@markaz/ui';
import { ADMIN_NOTE_CATEGORIES } from '@markaz/domain';
import { trpc } from '@/trpc/react';
import { ReasonSelect, NoteField } from './reason-select';
import { formatWhen } from './labels';

/**
 * Admin Note Panel (spec §37) — internal-only notes on an entity, kept visually
 * separate from the audit timeline. List + add form. Notes are append-only; a new
 * note supersedes rather than edits (server-enforced).
 */
export function NotesPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const t = useTranslations('admin');
  const notes = trpc.admin.notes.list.useQuery({ entityType, entityId });
  const utils = trpc.useUtils();
  const add = trpc.admin.notes.add.useMutation({
    onSuccess: () => {
      toast.success(t('result.success'));
      void utils.admin.notes.list.invalidate({ entityType, entityId });
    },
  });

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const canSubmit = category !== '' && body.trim().length >= 3;

  async function submit() {
    await add.mutateAsync({
      entityType,
      entityId,
      category: category as (typeof ADMIN_NOTE_CATEGORIES)[number],
      body: body.trim(),
    });
    setBody('');
    setCategory('');
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="text-muted-foreground h-4 w-4" aria-hidden />
          {t('note.title')}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('note.add')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">{t('note.privacyWarning')}</p>

        {open ? (
          <div className="bg-muted/30 space-y-3 rounded-md border p-3">
            <ReasonSelect
              id="note-category"
              label={t('note.categoryLabel')}
              basePath="note.category"
              values={ADMIN_NOTE_CATEGORIES}
              value={category}
              onChange={setCategory}
            />
            <NoteField
              id="note-body"
              label={t('note.bodyLabel')}
              value={body}
              onChange={setBody}
              placeholder={t('note.bodyPlaceholder')}
            />
            {add.isError ? (
              <Alert variant="destructive">{add.error.message || t('error.generic')}</Alert>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button size="sm" disabled={!canSubmit || add.isPending} onClick={submit}>
                {add.isPending ? t('result.pending') : t('note.submit')}
              </Button>
            </div>
          </div>
        ) : null}

        {notes.isLoading ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : notes.data && notes.data.length > 0 ? (
          <ul className="space-y-3">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-md border p-3">
                <div className="text-muted-foreground mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    {t(`note.category.${n.category}`)}
                  </span>
                  <span>{formatWhen(n.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                {n.followUpDate ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('note.followUpLabel')}: {n.followUpDate}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('note.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
