import { X509Certificate } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import { HttpError, grantedModules, publicUser, requireAdmin, requireAuth, type UserRow } from '../auth.js';
import {
  MODULE_IDS,
  getCoraConfig,
  getSettings,
  isCoraConfigured,
  saveCoraConfig,
  saveSettings,
  type CoraConfig,
} from '../settings.js';
import { cora, CORA_BASE_URLS } from '../cora.js';
import {
  applyPayment,
  cancelInvoice,
  getSubscription,
  issueInvoice,
  OPEN_STATUSES,
  planModules,
  subscriptionState,
  syncInvoice,
  runBillingJobs,
  type Invoice,
  type Plan,
} from '../billing.js';
import { env } from '../env.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const moduleList = z.array(z.enum(MODULE_IDS));

// ---------------- Painel ----------------

adminRouter.get('/stats', (_req, res) => {
  const now = new Date().toISOString();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const users = get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role = 'user'`)!.n;
  const activeSubs = get<{ n: number }>(
    'SELECT COUNT(*) n FROM subscriptions WHERE current_period_end >= ?',
    [now],
  )!.n;
  const mrr = get<{ v: number }>(
    `SELECT COALESCE(SUM(CAST(p.price_cents AS REAL) / p.interval_months), 0) v
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.current_period_end >= ?`,
    [now],
  )!.v;
  const openInvoices = get<{ n: number; v: number }>(
    `SELECT COUNT(*) n, COALESCE(SUM(amount_cents), 0) v FROM invoices WHERE applied = 0 AND status IN ('OPEN','LATE','IN_PAYMENT')`,
  )!;
  const revenue30 = get<{ v: number }>(
    'SELECT COALESCE(SUM(amount_cents), 0) v FROM invoices WHERE applied = 1 AND paid_at >= ?',
    [since],
  )!.v;
  const monthly = all<{ month: string; v: number }>(
    `SELECT substr(paid_at, 1, 7) month, SUM(amount_cents) v FROM invoices
     WHERE applied = 1 AND paid_at IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12`,
  ).reverse();
  res.json({
    users,
    activeSubs,
    mrrCents: Math.round(mrr),
    openInvoices: openInvoices.n,
    openAmountCents: openInvoices.v,
    revenue30Cents: revenue30,
    monthly,
    coraConfigured: isCoraConfigured(),
  });
});

// ---------------- Usuários e permissões ----------------

function adminUserView(u: UserRow) {
  const sub = getSubscription(u.id);
  const plan = sub ? get<Plan>('SELECT name FROM plans WHERE id = ?', [sub.plan_id]) : undefined;
  const companies = get<{ n: number }>('SELECT COUNT(*) n FROM companies WHERE user_id = ?', [u.id])!.n;
  return {
    ...publicUser(u),
    // `modules` (de publicUser) são os efetivos; estes são só os liberados manualmente.
    grantedModules: grantedModules(u),
    companies,
    subscription: sub
      ? { state: subscriptionState(sub), periodEnd: sub.current_period_end, planId: sub.plan_id, planName: plan?.name ?? null }
      : null,
  };
}

adminRouter.get('/users', (_req, res) => {
  res.json(all<UserRow>('SELECT * FROM users ORDER BY role, name').map(adminUserView));
});

const userBody = z.object({
  name: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  role: z.enum(['admin', 'user']),
  active: z.boolean().default(true),
  modules: moduleList,
  document: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  password: z.string().optional().default(''),
});

adminRouter.post('/users', (req, res) => {
  const b = userBody.parse(req.body);
  if (b.password.length < 6) throw new HttpError(400, 'A senha deve ter ao menos 6 caracteres');
  if (get('SELECT id FROM users WHERE email = ?', [b.email])) throw new HttpError(409, 'E-mail já cadastrado');
  const { lastId } = run(
    `INSERT INTO users (name, email, password_hash, role, active, permissions, document, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.name,
      b.email,
      bcrypt.hashSync(b.password, 10),
      b.role,
      b.active,
      JSON.stringify(b.modules),
      b.document.replace(/\D/g, '') || null,
      b.phone || null,
    ],
  );
  res.status(201).json(adminUserView(get<UserRow>('SELECT * FROM users WHERE id = ?', [lastId])!));
});

adminRouter.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) throw new HttpError(404, 'Usuário não encontrado');
  const b = userBody.parse(req.body);
  if (id === req.user!.id && (b.role !== 'admin' || !b.active)) {
    throw new HttpError(400, 'Você não pode remover seu próprio acesso de administrador');
  }
  const dup = get<{ id: number }>('SELECT id FROM users WHERE email = ? AND id != ?', [b.email, id]);
  if (dup) throw new HttpError(409, 'E-mail já cadastrado');
  run(
    `UPDATE users SET name = ?, email = ?, role = ?, active = ?, permissions = ?, document = ?, phone = ? WHERE id = ?`,
    [b.name, b.email, b.role, b.active, JSON.stringify(b.modules), b.document.replace(/\D/g, '') || null, b.phone || null, id],
  );
  if (b.password) {
    if (b.password.length < 6) throw new HttpError(400, 'A senha deve ter ao menos 6 caracteres');
    run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(b.password, 10), id]);
  }
  res.json(adminUserView(get<UserRow>('SELECT * FROM users WHERE id = ?', [id])!));
});

adminRouter.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) throw new HttpError(400, 'Você não pode excluir a si mesmo');
  run('DELETE FROM users WHERE id = ?', [id]);
  res.status(204).end();
});

// Concede (ou ajusta) manualmente o período de acesso de um usuário.
adminRouter.post('/users/:id/access', (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ planId: z.number().int(), until: z.string().min(10) }).parse(req.body);
  if (!get('SELECT id FROM users WHERE id = ?', [id])) throw new HttpError(404, 'Usuário não encontrado');
  if (!get('SELECT id FROM plans WHERE id = ?', [b.planId])) throw new HttpError(404, 'Plano não encontrado');
  const until = new Date(`${b.until.slice(0, 10)}T23:59:59.000Z`).toISOString();
  const sub = getSubscription(id);
  if (sub) {
    run(`UPDATE subscriptions SET plan_id = ?, status = 'active', current_period_end = ?, updated_at = datetime('now') WHERE id = ?`, [
      b.planId,
      until,
      sub.id,
    ]);
  } else {
    run(`INSERT INTO subscriptions (user_id, plan_id, status, current_period_end) VALUES (?, ?, 'active', ?)`, [
      id,
      b.planId,
      until,
    ]);
  }
  res.json(adminUserView(get<UserRow>('SELECT * FROM users WHERE id = ?', [id])!));
});

adminRouter.post('/users/:id/revoke', async (req, res) => {
  const id = Number(req.params.id);
  // Cancela as cobranças em aberto antes, para que o pagamento de um boleto antigo não devolva o acesso.
  for (const inv of all<Invoice>(
    `SELECT * FROM invoices WHERE user_id = ? AND applied = 0 AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`,
    [id, ...OPEN_STATUSES],
  )) {
    await cancelInvoice(inv);
  }
  run(`UPDATE subscriptions SET status = 'canceled', current_period_end = ?, updated_at = datetime('now') WHERE user_id = ?`, [
    new Date(Date.now() - 365 * 86_400_000).toISOString(),
    id,
  ]);
  res.json(adminUserView(get<UserRow>('SELECT * FROM users WHERE id = ?', [id])!));
});

// ---------------- Planos ----------------

const planBody = z.object({
  name: z.string().trim().min(2, 'Informe o nome do plano'),
  description: z.string().trim().default(''),
  price_cents: z.number().int().min(500, 'A Cora exige valor mínimo de R$ 5,00'),
  interval_months: z.number().int().min(1).max(36),
  active: z.boolean().default(true),
  modules: moduleList.min(1, 'Selecione ao menos um módulo para o plano'),
});

const planView = (p: Plan) => ({ ...p, modules: planModules(p) });

adminRouter.get('/plans', (_req, res) => {
  res.json(
    all<Plan>(
      `SELECT p.*, (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.current_period_end >= ?) AS subscribers
       FROM plans p ORDER BY p.price_cents`,
      [new Date().toISOString()],
    ).map(planView),
  );
});

adminRouter.post('/plans', (req, res) => {
  const b = planBody.parse(req.body);
  const { lastId } = run(
    'INSERT INTO plans (name, description, price_cents, interval_months, active, modules) VALUES (?, ?, ?, ?, ?, ?)',
    [b.name, b.description, b.price_cents, b.interval_months, b.active, JSON.stringify(b.modules)],
  );
  res.status(201).json(planView(get<Plan>('SELECT * FROM plans WHERE id = ?', [lastId])!));
});

adminRouter.put('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = planBody.parse(req.body);
  run('UPDATE plans SET name = ?, description = ?, price_cents = ?, interval_months = ?, active = ?, modules = ? WHERE id = ?', [
    b.name,
    b.description,
    b.price_cents,
    b.interval_months,
    b.active,
    JSON.stringify(b.modules),
    id,
  ]);
  res.json(planView(get<Plan>('SELECT * FROM plans WHERE id = ?', [id])!));
});

adminRouter.delete('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  const used = get<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM subscriptions WHERE plan_id = ?) + (SELECT COUNT(*) FROM invoices WHERE plan_id = ?) n',
    [id, id],
  )!.n;
  if (used > 0) throw new HttpError(400, 'Plano em uso — desative-o em vez de excluir');
  run('DELETE FROM plans WHERE id = ?', [id]);
  res.status(204).end();
});

// ---------------- Faturas ----------------

adminRouter.get('/invoices', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const rows = all(
    `SELECT i.*, u.name AS user_name, u.email AS user_email, p.name AS plan_name
     FROM invoices i JOIN users u ON u.id = i.user_id LEFT JOIN plans p ON p.id = i.plan_id
     ${status ? 'WHERE i.status = @status' : ''} ORDER BY i.id DESC LIMIT 500`,
    status ? { status } : undefined,
  );
  res.json(rows);
});

function findInvoice(id: number) {
  const inv = get<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!inv) throw new HttpError(404, 'Fatura não encontrada');
  return inv;
}

adminRouter.post('/invoices', async (req, res) => {
  const b = z.object({ userId: z.number().int(), planId: z.number().int() }).parse(req.body);
  res.status(201).json(await issueInvoice(b.userId, b.planId));
});

adminRouter.post('/invoices/:id/refresh', async (req, res) => {
  res.json(await syncInvoice(findInvoice(Number(req.params.id))));
});

adminRouter.post('/invoices/:id/cancel', async (req, res) => {
  await cancelInvoice(findInvoice(Number(req.params.id)));
  res.status(204).end();
});

// Baixa manual (ex.: pagamento recebido fora da Cora).
adminRouter.post('/invoices/:id/mark-paid', (req, res) => {
  const inv = findInvoice(Number(req.params.id));
  run('UPDATE invoices SET manual = 1 WHERE id = ?', [inv.id]);
  applyPayment(inv);
  res.json(findInvoice(inv.id));
});

// Simula o pagamento no ambiente Stage da Cora (apenas testes).
adminRouter.post('/invoices/:id/stage-pay', async (req, res) => {
  const inv = findInvoice(Number(req.params.id));
  if (getCoraConfig().environment !== 'stage') throw new HttpError(400, 'Disponível apenas no ambiente Stage');
  if (!inv.cora_id) throw new HttpError(400, 'Fatura sem identificador Cora');
  await cora.payInvoiceStage(inv.cora_id);
  res.json(await syncInvoice(inv));
});

adminRouter.post('/billing/run', async (_req, res) => {
  await runBillingJobs();
  res.status(204).end();
});

// ---------------- Configurações gerais ----------------

adminRouter.get('/settings', (_req, res) => {
  res.json({ ...getSettings(), modules: MODULE_IDS });
});

adminRouter.put('/settings', (req, res) => {
  const b = z
    .object({
      allowSignup: z.boolean(),
      requireSubscription: z.boolean(),
      defaultModules: moduleList,
      dueDays: z.number().int().min(1).max(60),
      renewalLeadDays: z.number().int().min(0).max(60),
      graceDays: z.number().int().min(0).max(60),
      finePercent: z.number().min(0).max(100),
      interestPercent: z.number().min(0).max(100),
      paymentForms: z.array(z.enum(['BANK_SLIP', 'PIX'])).min(1, 'Selecione ao menos uma forma de pagamento'),
    })
    .parse(req.body);
  res.json({ ...saveSettings(b), modules: MODULE_IDS });
});

// ---------------- Integração Cora ----------------

function certInfo(pem: string) {
  if (!pem) return null;
  try {
    const c = new X509Certificate(pem);
    return { subject: c.subject, validFrom: c.validFrom, validTo: c.validTo };
  } catch {
    return { subject: 'Certificado inválido', validFrom: '', validTo: '' };
  }
}

function coraView(cfg: CoraConfig, req: { protocol: string; get(h: string): string | undefined }) {
  const origin = env.publicUrl || `${req.protocol}://${req.get('host')}`;
  return {
    environment: cfg.environment,
    clientId: cfg.clientId,
    baseUrl: cfg.baseUrl ?? '',
    defaultBaseUrls: CORA_BASE_URLS,
    hasCertificate: Boolean(cfg.certificate),
    hasPrivateKey: Boolean(cfg.privateKey),
    certificate: certInfo(cfg.certificate),
    configured: isCoraConfigured(cfg),
    webhookUrl: cfg.webhookUrl || `${origin}/api/webhooks/cora/${cfg.webhookToken}`,
  };
}

adminRouter.get('/cora', (req, res) => {
  res.json(coraView(getCoraConfig(), req));
});

adminRouter.put('/cora', (req, res) => {
  const b = z
    .object({
      environment: z.enum(['stage', 'production']),
      clientId: z.string().trim(),
      certificate: z.string().optional(),
      privateKey: z.string().optional(),
      baseUrl: z.string().trim().optional().default(''),
      webhookUrl: z.string().trim().optional().default(''),
    })
    .parse(req.body);
  const patch: Partial<CoraConfig> = {
    environment: b.environment,
    clientId: b.clientId,
    baseUrl: b.baseUrl || undefined,
    webhookUrl: b.webhookUrl || undefined,
  };
  if (b.certificate?.trim()) {
    if (!b.certificate.includes('BEGIN CERTIFICATE')) throw new HttpError(400, 'Certificado deve estar no formato PEM');
    patch.certificate = b.certificate.trim();
  }
  if (b.privateKey?.trim()) {
    if (!b.privateKey.includes('PRIVATE KEY')) throw new HttpError(400, 'Chave privada deve estar no formato PEM');
    patch.privateKey = b.privateKey.trim();
  }
  saveCoraConfig(patch);
  cora.resetToken();
  res.json(coraView(getCoraConfig(), req));
});

adminRouter.post('/cora/test', async (_req, res) => {
  try {
    const r = await cora.testConnection();
    res.json({ ok: true, message: `Autenticado com sucesso em ${r.baseUrl}` });
  } catch (e: any) {
    res.json({ ok: false, message: e?.message ?? String(e) });
  }
});

adminRouter.get('/cora/endpoints', async (_req, res) => {
  res.json(await cora.listEndpoints());
});

adminRouter.post('/cora/endpoints', async (req, res) => {
  const cfg = coraView(getCoraConfig(), req);
  if (!cfg.webhookUrl.startsWith('https://')) {
    throw new HttpError(400, 'A Cora só envia notificações para URLs HTTPS públicas. Defina PUBLIC_URL ou a URL do webhook.');
  }
  res.status(201).json(await cora.createEndpoint(cfg.webhookUrl, 'invoice', '*'));
});

adminRouter.delete('/cora/endpoints/:id', async (req, res) => {
  await cora.deleteEndpoint(String(req.params.id));
  res.status(204).end();
});

adminRouter.get('/cora/webhook-events', (_req, res) => {
  res.json(all('SELECT * FROM webhook_events ORDER BY id DESC LIMIT 50'));
});
