import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Eye, FlaskConical, Plus, RefreshCcw, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { cents, dateBR } from '../../lib/format';
import { Button, Card, Empty, Field, Modal, PageHeader, Select, Spinner, clsx, useToast } from '../../components/ui';
import { INVOICE_STATUS, InvoicePayment, InvoiceStatus, type InvoiceRow } from '../../components/InvoicePayment';

interface UserOpt {
  id: number;
  name: string;
  email: string;
  role: string;
  document: string;
}
interface PlanOpt {
  id: number;
  name: string;
  price_cents: number;
}

const OPEN = ['OPEN', 'LATE', 'IN_PAYMENT', 'DRAFT'];

export default function Faturas() {
  const toast = useToast();
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [view, setView] = useState<InvoiceRow | null>(null);
  const [issue, setIssue] = useState<{ userId: number; planId: number } | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [env, setEnv] = useState<'stage' | 'production'>('stage');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () => api<InvoiceRow[]>(`/admin/invoices${status ? `?status=${status}` : ''}`).then(setRows),
    [status],
  );

  useEffect(() => {
    load().catch((e) => toast(e.message, 'danger'));
  }, [load, toast]);

  useEffect(() => {
    api<{ environment: 'stage' | 'production' }>('/admin/cora').then((c) => setEnv(c.environment)).catch(() => undefined);
  }, []);

  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
      toast(msg);
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const openIssue = async () => {
    const [u, p] = await Promise.all([api<UserOpt[]>('/admin/users'), api<PlanOpt[]>('/admin/plans')]);
    const clients = u.filter((x) => x.role !== 'admin');
    setUsers(clients);
    setPlans(p);
    setIssue({ userId: clients[0]?.id ?? 0, planId: p[0]?.id ?? 0 });
  };

  if (!rows) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Faturas"
        description="Cobranças emitidas na Cora. Pagamentos confirmados liberam o acesso automaticamente."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCcw size={14} />}
              loading={busy === 'sync'}
              onClick={() => act('sync', () => api('/admin/billing/run', { method: 'POST' }), 'Sincronização concluída.')}
            >
              Sincronizar com a Cora
            </Button>
            <Button icon={<Plus size={14} />} onClick={openIssue}>
              Emitir cobrança
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {['', 'OPEN', 'LATE', 'PAID', 'CANCELLED', 'ERROR'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={clsx(
              'rounded-lg border px-3 py-1.5 text-xs transition',
              status === s ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
            )}
          >
            {s ? INVOICE_STATUS[s].label : 'Todas'}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhuma fatura encontrada." />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Plano</th>
                  <th className="text-right">Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Pago em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = OPEN.includes(r.status) && !r.applied;
                  return (
                    <tr key={r.id}>
                      <td className="num text-xs text-muted">{r.id}</td>
                      <td>
                        <p className="font-medium">{r.user_name}</p>
                        <p className="text-xs text-muted">{r.user_email}</p>
                      </td>
                      <td className="text-xs">{r.plan_name ?? '—'}</td>
                      <td className="num text-right">{cents(r.amount_cents)}</td>
                      <td className="num text-xs">{dateBR(r.due_date)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <InvoiceStatus status={r.status} />
                          {!!r.manual && <span className="text-[10px] text-muted">manual</span>}
                        </div>
                        {r.error && <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-danger" title={r.error}>{r.error}</p>}
                      </td>
                      <td className="num text-xs text-muted">{dateBR(r.paid_at)}</td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          {(r.pix_emv || r.digitable) && (
                            <IconBtn title="Ver cobrança" onClick={() => setView(r)}>
                              <Eye size={14} />
                            </IconBtn>
                          )}
                          {r.cora_id && (
                            <IconBtn
                              title="Consultar status na Cora"
                              onClick={() => act(`r${r.id}`, () => api(`/admin/invoices/${r.id}/refresh`, { method: 'POST' }), 'Status atualizado.')}
                            >
                              <RefreshCcw size={14} className={busy === `r${r.id}` ? 'animate-spin' : ''} />
                            </IconBtn>
                          )}
                          {isOpen && env === 'stage' && r.cora_id && (
                            <IconBtn
                              title="Simular pagamento (Stage)"
                              onClick={() => act(`s${r.id}`, () => api(`/admin/invoices/${r.id}/stage-pay`, { method: 'POST' }), 'Pagamento simulado no Stage.')}
                            >
                              <FlaskConical size={14} />
                            </IconBtn>
                          )}
                          {!r.applied && r.status !== 'CANCELLED' && (
                            <IconBtn
                              title="Dar baixa manual (marcar como paga)"
                              onClick={() => act(`m${r.id}`, () => api(`/admin/invoices/${r.id}/mark-paid`, { method: 'POST' }), 'Baixa registrada e acesso liberado.')}
                            >
                              <BadgeCheck size={14} />
                            </IconBtn>
                          )}
                          {isOpen && (
                            <IconBtn
                              danger
                              title="Cancelar cobrança"
                              onClick={() => act(`c${r.id}`, () => api(`/admin/invoices/${r.id}/cancel`, { method: 'POST' }), 'Cobrança cancelada.')}
                            >
                              <XCircle size={14} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title={`Fatura #${view?.id}`} description={view?.user_name}>
        {view && (
          <>
            <InvoicePayment invoice={view} />
            {view.cora_id && <p className="num mt-4 text-[11px] text-muted">ID Cora: {view.cora_id}</p>}
          </>
        )}
      </Modal>

      <Modal
        open={!!issue}
        onClose={() => setIssue(null)}
        title="Emitir cobrança"
        description="Gera boleto/PIX na Cora para o usuário selecionado. Cobranças em aberto anteriores serão canceladas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIssue(null)}>
              Cancelar
            </Button>
            <Button
              loading={busy === 'issue'}
              disabled={!issue?.userId || !issue?.planId}
              onClick={async () => {
                await act('issue', () => api('/admin/invoices', { body: issue }), 'Cobrança emitida.');
                setIssue(null);
              }}
            >
              Emitir
            </Button>
          </>
        }
      >
        {issue && (
          <div className="space-y-4">
            <Field label="Usuário">
              <Select value={issue.userId} onChange={(e) => setIssue({ ...issue, userId: Number(e.target.value) })}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email} {u.document ? '' : '(sem CPF/CNPJ)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Plano">
              <Select value={issue.planId} onChange={(e) => setIssue({ ...issue, planId: Number(e.target.value) })}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {cents(p.price_cents)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick(): void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx('rounded-md p-1.5 text-muted transition hover:bg-subtle', danger ? 'hover:text-danger' : 'hover:text-fg')}
    >
      {children}
    </button>
  );
}
