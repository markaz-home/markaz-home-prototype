'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileLock2, ExternalLink } from 'lucide-react';
import {
  Alert, Button, Card, CardContent, CardHeader, CardTitle,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast,
} from '@markaz/ui';
import { DOCUMENT_ACCESS_REASONS } from '@markaz/domain';
import { trpc } from '@/trpc/react';
import { ReasonSelect } from './reason-select';
import { formatBytes, formatWhen } from './labels';

/**
 * Private-document panel + audited access dialog (spec §23, §37). Lists safe
 * metadata only (never the storage path). Opening a document records an audit
 * event with the admin's reason BEFORE a short-lived signed URL is minted, and
 * requires an explicit purpose + acknowledgement.
 */
export function DocumentPanel({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const docs = trpc.admin.documents.metadata.useQuery({ transactionId });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileLock2 className="h-4 w-4 text-amber-700" aria-hidden />
          {t('document.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('document.subtitle')}</p>
        {docs.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : docs.data && docs.data.length > 0 ? (
          <ul className="divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.fileName ?? t('document.col.name')}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.documentType} · {formatBytes(d.sizeBytes)} · {t(`document.visibility.${d.visibility}`)} · {formatWhen(d.createdAt)}
                  </p>
                </div>
                <AccessDialog documentId={d.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('document.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AccessDialog({ documentId }: { documentId: string }) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = trpc.admin.documents.access.useMutation();

  async function submit() {
    setError(null);
    try {
      const res = await m.mutateAsync({ transactionDocumentId: documentId, reason: reason as (typeof DOCUMENT_ACCESS_REASONS)[number] });
      if (!res.url) {
        // The access attempt is audited (REQUESTED + FAILED); surface a safe message.
        setError(t('document.linkFailed'));
        return;
      }
      window.open(res.url, '_blank', 'noopener,noreferrer');
      toast.success(t('document.access.opened', { seconds: res.expiresInSeconds }));
      setOpen(false);
      setReason('');
      setAck(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('document.linkFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) { setOpen(o); if (!o) setError(null); } }}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ExternalLink className="h-4 w-4" aria-hidden />
        {t('document.accessAction')}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('document.access.title')}</DialogTitle>
          <DialogDescription>{t('document.access.body')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ReasonSelect id="doc-access-reason" label={t('reasonLabel')} basePath="document.access.reason" values={DOCUMENT_ACCESS_REASONS} value={reason} onChange={setReason} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            <span>{t('document.access.confirmLabel')}</span>
          </label>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>{t('cancel')}</Button>
          <Button onClick={submit} disabled={m.isPending || reason === '' || !ack}>
            {m.isPending ? t('document.preparing') : t('document.access.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
