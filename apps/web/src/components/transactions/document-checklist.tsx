'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Badge, Button } from '@markaz/ui';
import { ALLOWED_DOCUMENT_MIME, MAX_DOCUMENT_BYTES, type TransactionDocumentType } from '@markaz/domain';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { trpc } from '@/trpc/react';

const BUCKET = 'transaction-documents';

interface OwnDoc {
  id: string;
  documentType: string;
  fileName: string;
  status: string;
}

/** Participant document upload + checklist (fictional files only; spec §22–24). */
export function DocumentChecklist({
  transactionId,
  perspective,
  ownDocuments,
  refresh,
}: {
  transactionId: string;
  perspective: 'BUYER' | 'SELLER';
  ownDocuments: OwnDoc[];
  refresh: () => void;
}) {
  const t = useTranslations('transactions.documents');
  const types: { type: TransactionDocumentType; required: boolean }[] =
    perspective === 'BUYER'
      ? [
          { type: 'BUYER_IDENTITY', required: true },
          { type: 'BUYER_TRANSACTION_FILE', required: false },
        ]
      : [
          { type: 'SELLER_IDENTITY', required: true },
          { type: 'SELLER_TRANSACTION_FILE', required: false },
        ];

  return (
    <div className="space-y-3">
      <Alert>
        <span className="font-medium">{t('notice')}</span> — {t('noticeBody')}
      </Alert>
      <ul className="space-y-2">
        {types.map((d) => (
          <li key={d.type}>
            <DocRow
              transactionId={transactionId}
              type={d.type}
              required={d.required}
              existing={ownDocuments.find((x) => x.documentType === d.type && x.status !== 'REMOVED') ?? null}
              refresh={refresh}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocRow({
  transactionId,
  type,
  required,
  existing,
  refresh,
}: {
  transactionId: string;
  type: TransactionDocumentType;
  required: boolean;
  existing: OwnDoc | null;
  refresh: () => void;
}) {
  const t = useTranslations('transactions.documents');
  const tv = useTranslations('validation');
  const utils = trpc.useUtils();
  const register = trpc.transactions.registerDocument.useMutation();
  const remove = trpc.transactions.removeDocument.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
      setError('Upload a PDF, JPG, or PNG file.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
      setError('File size must be 10 MB or less.');
      return;
    }
    setBusy(true);
    try {
      const { path } = await utils.transactions.documentUploadPath.fetch({ transactionId, fileName: file.name });
      const supabase = createSupabaseBrowserClient();
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      await register.mutateAsync({
        transactionId,
        documentType: type,
        path,
        fileName: file.name,
        mimeType: file.type as (typeof ALLOWED_DOCUMENT_MIME)[number],
        sizeBytes: file.size,
      });
      refresh();
    } catch {
      setError(tv('unexpectedError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <span>
        {t(`type.${type}` as 'type.BUYER_IDENTITY')}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {existing ? (
        <span className="flex items-center gap-2">
          <Badge variant="outline">{t('accepted')}</Badge>
          <span dir="ltr" className="max-w-[180px] truncate text-muted-foreground">
            {existing.fileName}
          </span>
          <Button
            size="sm"
            variant="ghost"
            loading={remove.isPending}
            onClick={() => remove.mutate({ transactionId, documentId: existing.id }, { onSuccess: refresh })}
          >
            {t('remove')}
          </Button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            aria-label={t(`type.${type}` as 'type.BUYER_IDENTITY')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <Button size="sm" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
            {t('upload')}
          </Button>
        </span>
      )}
      {error ? (
        <p role="alert" className="w-full text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
