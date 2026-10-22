import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDollarSign, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { cents, dateBR, intervalLabel } from '../lib/format';
import { Alert, Badge, Button, Card, CardTitle, Empty, PageHeader, Spinner, clsx, useToast } from '../components/ui';
import { InvoicePayment, InvoiceStatus, type InvoiceRow } from '../components/InvoicePayment';

interface Plan {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  interval_months: number;
}

interface BillingInfo {
  paymentsEnabled: boolean;
  subscription: null | {
    plan_id: number;
    state: 'active' | 'grace' | 'expired' | 'pending' | 'none';
    current_period_end: string | null;
    plan: Plan | null;
  };
  invoices: InvoiceRow[];
}

const STATE: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent' }> = {
  active: { label: 'Ativa', tone: 'ok' },
  grace: { label: 'Vencida — em tolerância', tone: 'warn' },
  expired: { label: 'Expirada', tone: 'danger' },
  pending: { label: 'Aguardando pagamento', tone: 'accent' },
  none: { label: 'Sem assinatura', tone: 'neutral' },
};

const OPEN = ['OPEN', 'LATE', 'IN_PAYMENT', 'DRAFT'];


export default function Assinatura() {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const wasActive = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([api<BillingInfo>('/billing/me'), api<Plan[]>('/billing/plans')]);
    setInfo(b);
    setPlans(p);
    setSelected((s) => s ?? b.subscription?.plan_id ?? p[0]?.id ?? null);
    const active = b.subscription?.state === 'active';
    if (wasActive.current === false && active) {
      toast('Pagamento confirmado! Sua assinatura está ativa.');
      refresh();
    }
    wasActive.current = active;
  }, [refresh, toast]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const open = info?.invoices.find((i) => OPEN.includes(i.status) && !i.applied);

  // Enquanto houver cobrança aberta, verifica periodicamente se foi paga.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      api(`/billing/invoices/${open.id}/refresh`, { method: 'POST' })
        .catch(() => undefined)
        .finally(() => load().catch(() => undefined));
    }, 20_000);
    return () => clearInterval(t);
  }, [open, load]);

  if (!info) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;

  const sub = info.subscription;
  const state = sub?.state ?? 'none';
  const missingDoc = !session?.user.document;

  const subscribe = async () => {
    if (!selected) return;
    setBusy('subscribe');
    try {
      await api('/billing/subscribe', { body: { planId: selected } });
      await load();
      toast('Cobrança gerada. Pague via PIX ou boleto para liberar o acesso.');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    if (!open) return;
    setBusy('check');
    try {
      const inv = await api<InvoiceRow>(`/billing/invoices/${open.id}/refresh`, { method: 'POST' });
      await load();
      if (inv.status !== 'PAID') toast('Pagamento ainda não identificado. A compensação do boleto pode levar até 3 dias úteis.', 'neutral');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!open) return;
    setBusy('cancel');
    try {
      await api(`/billing/invoices/${open.id}/cancel`, { method: 'POST' });
      await load();
      toast('Cobrança cancelada.');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const isRenewal = state === 'active' || state === 'grace';

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Assinatura" description="Gerencie seu plano e pagamentos. Pagamentos processados pelo Banco Cora." />

      {session?.access.requireSubscription && !session.access.hasAccess && (
        <Alert tone="warn" title="Acesso bloqueado">
          Sua assinatura não está ativa. Escolha um plano e realize o pagamento para liberar o sistema — a liberação é
          automática após a confirmação.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle icon={<ShieldCheck size={14} />}>Status</CardTitle>
          <Badge tone={STATE[state].tone} className="!text-xs">
            {STATE[state].label}
          </Badge>
          <div className="mt-4 space-y-1 text-sm">
            <p className="text-muted">
              Plano: <span className="text-fg">{sub?.plan?.name ?? '—'}</span>
            </p>
            <p className="text-muted">
              {state === 'active' ? 'Válida até' : 'Venceu em'}:{' '}
              <span className="num text-fg">{dateBR(sub?.current_period_end)}</span>
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          {open ? (
            <>
              <CardTitle icon={<CircleDollarSign size={14} />} right={<InvoiceStatus status={open.status} />}>
                Cobrança em aberto
              </CardTitle>
              <InvoicePayment invoice={open} />
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button icon={<RefreshCcw size={14} />} onClick={check} loading={busy === 'check'}>
                  Já paguei — verificar
                </Button>
                <Button variant="ghost" icon={<XCircle size={14} />} onClick={cancel} loading={busy === 'cancel'}>
                  Cancelar cobrança
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                PIX é confirmado em instantes. Boletos podem levar até 3 dias úteis. Esta página verifica o pagamento
                automaticamente.
              </p>
            </>
          ) : state === 'active' ? (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 size={32} className="mb-3 text-ok" />
              <p className="font-medium">Tudo em dia!</p>
              <p className="text-sm text-muted">
                A cobrança de renovação será emitida automaticamente antes de {dateBR(sub?.current_period_end)}.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <CircleDollarSign size={32} className="mb-3 text-muted" />
              <p className="font-medium">Nenhuma cobrança em aberto</p>
              <p className="text-sm text-muted">Escolha um plano abaixo para gerar a cobrança.</p>
            </div>
          )}
        </Card>
      </div>

      {!open && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">{isRenewal ? 'Renovar antecipadamente ou trocar de plano' : 'Escolha seu plano'}</h2>
          {!info.paymentsEnabled && (
            <div className="mb-4">
              <Alert tone="warn">Pagamentos temporariamente indisponíveis. O administrador ainda não configurou a integração com o banco.</Alert>
            </div>
          )}
          {missingDoc && (
            <div className="mb-4">
              <Alert tone="accent">
                Para gerar a cobrança, cadastre seu CPF ou CNPJ em{' '}
                <Link to="/perfil" className="font-medium underline underline-offset-4">
                  Meu perfil
                </Link>
                .
              </Alert>
            </div>
          )}
          {plans.length === 0 ? (
            <Empty title="Nenhum plano disponível no momento." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((p) => {
                const monthly = p.price_cents / p.interval_months;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={clsx(
                      'rounded-xl border bg-surface p-5 text-left transition',
                      selected === p.id ? 'border-accent ring-2 ring-accent/15' : 'border-line hover:border-fg/20',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{p.name}</p>
                      <span
                        className={clsx(
                          'flex h-4 w-4 items-center justify-center rounded-full border',
                          selected === p.id ? 'border-accent bg-accent' : 'border-line',
                        )}
                      >
                        {selected === p.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="mt-3">
                      <span className="num text-2xl font-semibold">{cents(p.price_cents)}</span>
                      <span className="text-sm text-muted">/{intervalLabel(p.interval_months)}</span>
                    </p>
                    {p.interval_months > 1 && <p className="num text-xs text-muted">equivale a {cents(monthly)}/mês</p>}
                    {p.description && <p className="mt-3 text-sm text-muted">{p.description}</p>}
                  </button>
                );
              })}
            </div>
          )}
          {plans.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button onClick={subscribe} loading={busy === 'subscribe'} disabled={!selected || !info.paymentsEnabled || missingDoc}>
                {isRenewal ? 'Gerar cobrança de renovação' : 'Assinar e gerar cobrança'}
              </Button>
            </div>
          )}
        </div>
      )}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardTitle>Histórico de cobranças</CardTitle>
        </div>
        {info.invoices.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">Nenhuma cobrança ainda.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Emissão</th>
                  <th>Vencimento</th>
                  <th className="text-right">Valor</th>
                  <th>Status</th>
                  <th>Pago em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {info.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="num text-xs">{dateBR(i.created_at)}</td>
                    <td className="num text-xs">{dateBR(i.due_date)}</td>
                    <td className="num text-right">{cents(i.amount_cents)}</td>
                    <td>
                      <InvoiceStatus status={i.status} />
                    </td>
                    <td className="num text-xs text-muted">{dateBR(i.paid_at)}</td>
                    <td className="text-right">
                      {i.boleto_url && (
                        <a href={i.boleto_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                          Boleto
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
