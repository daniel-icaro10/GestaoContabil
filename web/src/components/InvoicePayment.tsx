import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Barcode, ExternalLink, QrCode } from 'lucide-react';
import { cents, dateBR } from '../lib/format';
import { Badge, CopyButton, clsx } from './ui';

export interface InvoiceRow {
  id: number;
  cora_id: string | null;
  status: string;
  amount_cents: number;
  period_months: number;
  due_date: string;
  boleto_url: string | null;
  digitable: string | null;
  barcode: string | null;
  pix_emv: string | null;
  paid_at: string | null;
  applied: number;
  manual: number;
  error: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  plan_name?: string;
}

export const INVOICE_STATUS: Record<string, { label: string; tone: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' }> = {
  PENDING: { label: 'Processando', tone: 'neutral' },
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  OPEN: { label: 'Em aberto', tone: 'accent' },
  IN_PAYMENT: { label: 'Em pagamento', tone: 'accent' },
  LATE: { label: 'Atrasada', tone: 'warn' },
  PAID: { label: 'Paga', tone: 'ok' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
  ERROR: { label: 'Erro', tone: 'danger' },
};

export function InvoiceStatus({ status }: { status: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function InvoicePayment({ invoice }: { invoice: InvoiceRow }) {
  const [qr, setQr] = useState<string | null>(null);
  const [tab, setTab] = useState<'pix' | 'boleto'>(invoice.pix_emv ? 'pix' : 'boleto');

  useEffect(() => {
    if (!invoice.pix_emv) return setQr(null);
    QRCode.toDataURL(invoice.pix_emv, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [invoice.pix_emv]);

  const tabs = [
    invoice.pix_emv && { id: 'pix' as const, label: 'PIX', icon: QrCode },
    (invoice.digitable || invoice.boleto_url) && { id: 'boleto' as const, label: 'Boleto', icon: Barcode },
  ].filter(Boolean) as { id: 'pix' | 'boleto'; label: string; icon: typeof QrCode }[];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Valor</p>
          <p className="num text-2xl font-semibold">{cents(invoice.amount_cents)}</p>
        </div>
        <div className="text-right">
          <p className="label-xs">Vencimento</p>
          <p className="num text-sm font-medium">{dateBR(invoice.due_date)}</p>
        </div>
      </div>
      {tabs.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg bg-subtle p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition',
                tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted',
              )}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'pix' && invoice.pix_emv && (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-xl border border-line bg-white p-2">
            {qr ? <img src={qr} alt="QR Code PIX" className="h-44 w-44" /> : <div className="h-44 w-44" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-muted">Escaneie o QR Code no app do seu banco ou use o PIX copia e cola:</p>
            <p className="num break-all rounded-lg bg-subtle p-3 text-[11px] leading-relaxed">{invoice.pix_emv}</p>
            <CopyButton text={invoice.pix_emv} label="Copiar código PIX" />
          </div>
        </div>
      )}
      {tab === 'boleto' && (
        <div className="space-y-3">
          {invoice.digitable && (
            <>
              <p className="text-sm text-muted">Linha digitável:</p>
              <p className="num break-all rounded-lg bg-subtle p-3 text-sm">{invoice.digitable}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {invoice.digitable && <CopyButton text={invoice.digitable} label="Copiar linha digitável" />}
            {invoice.boleto_url && (
              <a
                href={invoice.boleto_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-fg px-3 text-xs font-medium text-bg hover:bg-fg/90"
              >
                <ExternalLink size={13} /> Abrir boleto (PDF)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
