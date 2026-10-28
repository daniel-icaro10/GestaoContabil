import { all, get, run } from './db.js';
import { cora, CoraError, type CoraInvoice } from './cora.js';
import { MODULE_IDS, getSettings, isCoraConfigured, toModules, type ModuleId } from './settings.js';

export interface Plan {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  interval_months: number;
  active: number;
  modules: string | null;
}

/** Módulos liberados pelo plano. Planos sem a lista definida liberam todos. */
export function planModules(plan: Pick<Plan, 'modules'>): ModuleId[] {
  if (plan.modules == null) return [...MODULE_IDS];
  try {
    return toModules(JSON.parse(plan.modules));
  } catch {
    return [];
  }
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  user_id: number;
  subscription_id: number | null;
  plan_id: number | null;
  cora_id: string | null;
  code: string;
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
  updated_at: string;
}

export const OPEN_STATUSES = ['OPEN', 'LATE', 'IN_PAYMENT', 'DRAFT'];

const DAY = 86_400_000;

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getSubscription(userId: number) {
  return get<Subscription>('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
}

export type AccessState = 'active' | 'grace' | 'expired' | 'pending' | 'none';

export function subscriptionState(sub: Subscription | undefined): AccessState {
  if (!sub) return 'none';
  if (!sub.current_period_end) return 'pending';
  const end = new Date(sub.current_period_end).getTime();
  const now = Date.now();
  if (end >= now) return 'active';
  if (end + getSettings().graceDays * DAY >= now) return 'grace';
  return 'expired';
}

export function hasAccess(user: { id: number; role: string }) {
  if (user.role === 'admin') return true;
  if (!getSettings().requireSubscription) return true;
  const state = subscriptionState(getSubscription(user.id));
  return state === 'active' || state === 'grace';
}

/** Módulos do plano da assinatura, enquanto ela estiver ativa (ou na tolerância). */
export function subscriptionModules(userId: number): ModuleId[] {
  const sub = getSubscription(userId);
  const state = subscriptionState(sub);
  if (state !== 'active' && state !== 'grace') return [];
  const plan = get<Plan>('SELECT * FROM plans WHERE id = ?', [sub!.plan_id]);
  return plan ? planModules(plan) : [];
}

export function openInvoiceFor(userId: number) {
  return get<Invoice>(
    `SELECT * FROM invoices WHERE user_id = ? AND applied = 0 AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})
     ORDER BY id DESC LIMIT 1`,
    [userId, ...OPEN_STATUSES],
  );
}

function updateFromCora(invoiceId: number, inv: CoraInvoice) {
  run(
    `UPDATE invoices SET cora_id = @cora_id, status = @status, boleto_url = @boleto_url, digitable = @digitable,
       barcode = @barcode, pix_emv = @pix_emv, error = NULL, updated_at = datetime('now') WHERE id = @id`,
    {
      id: invoiceId,
      cora_id: inv.id,
      status: inv.status,
      boleto_url: inv.payment_options?.bank_slip?.url ?? null,
      digitable: inv.payment_options?.bank_slip?.digitable ?? null,
      barcode: inv.payment_options?.bank_slip?.barcode ?? null,
      pix_emv: inv.pix?.emv ?? null,
    },
  );
}

/** Garante a assinatura do usuário para o plano e emite a fatura na Cora. */
export async function issueInvoice(userId: number, planId: number, opts: { dueDate?: string } = {}) {
  const plan = get<Plan>('SELECT * FROM plans WHERE id = ?', [planId]);
  if (!plan) throw new CoraError('Plano não encontrado', 404);
  const user = get<{ id: number; name: string; email: string; document: string | null }>(
    'SELECT id, name, email, document FROM users WHERE id = ?',
    [userId],
  );
  if (!user) throw new CoraError('Usuário não encontrado', 404);
  const doc = (user.document ?? '').replace(/\D/g, '');
  if (doc.length !== 11 && doc.length !== 14) {
    throw new CoraError('Informe um CPF ou CNPJ válido no seu perfil antes de gerar a cobrança.', 400);
  }
  if (!isCoraConfigured()) throw new CoraError('Pagamentos indisponíveis: integração Cora ainda não configurada pelo administrador.', 503);

  const settings = getSettings();
  let sub = getSubscription(userId);
  if (!sub) {
    run('INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, ?, ?)', [userId, planId, 'pending']);
    sub = getSubscription(userId)!;
  } else if (sub.plan_id !== planId) {
    run(`UPDATE subscriptions SET plan_id = ?, updated_at = datetime('now') WHERE id = ?`, [planId, sub.id]);
  }

  // Cancela faturas em aberto anteriores (ex.: troca de plano) para não haver duas cobranças.
  for (const old of all<Invoice>(
    `SELECT * FROM invoices WHERE user_id = ? AND applied = 0 AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`,
    [userId, ...OPEN_STATUSES],
  )) {
    await cancelInvoice(old).catch(() => undefined);
  }

  const due = opts.dueDate ?? ymd(new Date(Date.now() + Math.max(1, settings.dueDays) * DAY));
  const code = `sub-${userId}-${Date.now()}`;
  const { lastId } = run(
    `INSERT INTO invoices (user_id, subscription_id, plan_id, code, status, amount_cents, period_months, due_date)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    [userId, sub.id, plan.id, code, plan.price_cents, plan.interval_months, due],
  );

  try {
    const inv = await cora.createInvoice({
      code,
      customer: { name: user.name, email: user.email, document: doc },
      serviceName: `Assinatura ${plan.name}`,
      serviceDescription: `Assinatura ${plan.name} — ${plan.interval_months} ${plan.interval_months > 1 ? 'meses' : 'mês'} de acesso`,
      amountCents: plan.price_cents,
      dueDate: due,
      finePercent: settings.finePercent,
      interestPercent: settings.interestPercent,
      paymentForms: settings.paymentForms,
    });
    updateFromCora(lastId, inv);
  } catch (e: any) {
    run(`UPDATE invoices SET status = 'ERROR', error = ?, updated_at = datetime('now') WHERE id = ?`, [
      String(e?.message ?? e),
      lastId,
    ]);
    throw e;
  }
  return get<Invoice>('SELECT * FROM invoices WHERE id = ?', [lastId])!;
}

/** Credita o período pago na assinatura (idempotente). */
export function applyPayment(invoice: Invoice, paidAt = new Date().toISOString()) {
  const fresh = get<Invoice>('SELECT * FROM invoices WHERE id = ?', [invoice.id]);
  if (!fresh || fresh.applied) return;
  let sub = getSubscription(fresh.user_id);
  if (!sub) {
    run('INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, ?, ?)', [
      fresh.user_id,
      fresh.plan_id,
      'pending',
    ]);
    sub = getSubscription(fresh.user_id)!;
  }
  const now = new Date();
  const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const base = currentEnd && currentEnd > now ? currentEnd : now;
  const newEnd = addMonths(base, fresh.period_months || 1);
  run(
    `UPDATE subscriptions SET status = 'active', current_period_end = ?, updated_at = datetime('now') WHERE id = ?`,
    [newEnd.toISOString(), sub.id],
  );
  run(
    `UPDATE invoices SET status = 'PAID', applied = 1, paid_at = COALESCE(paid_at, ?), updated_at = datetime('now') WHERE id = ?`,
    [paidAt, fresh.id],
  );
}

/** Consulta a fatura na Cora e aplica o pagamento quando confirmado. */
export async function syncInvoice(invoice: Invoice) {
  if (!invoice.cora_id) return invoice;
  const inv = await cora.getInvoice(invoice.cora_id);
  updateFromCora(invoice.id, inv);
  if (inv.status === 'PAID') {
    const paidAt = inv.payments?.find((p) => p.finalized_at)?.finalized_at ?? inv.occurrence_date ?? undefined;
    applyPayment(invoice, paidAt ? new Date(paidAt).toISOString() : undefined);
  }
  return get<Invoice>('SELECT * FROM invoices WHERE id = ?', [invoice.id])!;
}

export async function cancelInvoice(invoice: Invoice) {
  if (invoice.applied) throw new CoraError('Fatura já paga não pode ser cancelada', 400);
  if (invoice.cora_id && OPEN_STATUSES.includes(invoice.status)) {
    await cora.cancelInvoice(invoice.cora_id);
  }
  run(`UPDATE invoices SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`, [invoice.id]);
}

export async function handleWebhook(resourceId: string, eventType: string, eventId?: string) {
  run('INSERT INTO webhook_events (event_id, event_type, resource_id) VALUES (?, ?, ?)', [
    eventId ?? null,
    eventType ?? null,
    resourceId ?? null,
  ]);
  if (!resourceId) return;
  const invoice = get<Invoice>('SELECT * FROM invoices WHERE cora_id = ?', [resourceId]);
  if (!invoice) return;
  // Nunca confiamos no cabeçalho do webhook: o status é sempre confirmado direto na API da Cora.
  await syncInvoice(invoice);
}

let jobRunning = false;

/** Rotina periódica: sincroniza faturas abertas e emite renovações. */
export async function runBillingJobs() {
  if (jobRunning || !isCoraConfigured()) return;
  jobRunning = true;
  try {
    const open = all<Invoice>(
      `SELECT * FROM invoices WHERE applied = 0 AND cora_id IS NOT NULL AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`,
      OPEN_STATUSES,
    );
    for (const inv of open) {
      await syncInvoice(inv).catch((e) => console.warn(`[billing] sync ${inv.cora_id}:`, e.message));
    }

    const settings = getSettings();
    const horizon = new Date(Date.now() + settings.renewalLeadDays * DAY).toISOString();
    const due = all<Subscription & { plan_active: number }>(
      `SELECT s.*, p.active AS plan_active FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       JOIN users u ON u.id = s.user_id
       WHERE s.status != 'canceled' AND u.active = 1 AND s.current_period_end IS NOT NULL AND s.current_period_end <= ?`,
      [horizon],
    );
    for (const sub of due) {
      if (!sub.plan_active || openInvoiceFor(sub.user_id)) continue;
      const end = new Date(sub.current_period_end!);
      // Não reemite automaticamente para assinaturas já expiradas além da tolerância.
      if (end.getTime() + settings.graceDays * DAY < Date.now()) continue;
      const dueDate = ymd(new Date(Math.max(end.getTime(), Date.now() + DAY)));
      await issueInvoice(sub.user_id, sub.plan_id, { dueDate }).catch((e) =>
        console.warn(`[billing] renovação usuário ${sub.user_id}:`, e.message),
      );
    }

    run(
      `UPDATE subscriptions SET status = 'expired', updated_at = datetime('now')
       WHERE status = 'active' AND current_period_end < ?`,
      [new Date(Date.now() - settings.graceDays * DAY).toISOString()],
    );
  } finally {
    jobRunning = false;
  }
}
