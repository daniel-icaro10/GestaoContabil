import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import {
  HttpError,
  publicUser,
  requireAuth,
  requireSubscription,
  signToken,
  type UserRow,
} from '../auth.js';
import { getSettings, isCoraConfigured } from '../settings.js';
import {
  cancelInvoice,
  getSubscription,
  hasAccess,
  issueInvoice,
  subscriptionState,
  syncInvoice,
  type Invoice,
  type Plan,
} from '../billing.js';

export const appRouter = Router();

const email = z.string().trim().toLowerCase().email('E-mail inválido');
const password = z.string().min(6, 'A senha deve ter ao menos 6 caracteres');
const document = z
  .string()
  .trim()
  .refine((v) => !v || [11, 14].includes(v.replace(/\D/g, '').length), 'CPF/CNPJ inválido');

function sessionPayload(user: UserRow) {
  const settings = getSettings();
  const sub = getSubscription(user.id);
  const plan = sub ? get<Plan>('SELECT * FROM plans WHERE id = ?', [sub.plan_id]) : undefined;
  return {
    user: publicUser(user),
    access: {
      hasAccess: hasAccess(user),
      requireSubscription: settings.requireSubscription && user.role !== 'admin',
      state: subscriptionState(sub),
      periodEnd: sub?.current_period_end ?? null,
      planName: plan?.name ?? null,
    },
  };
}

// ---------------- Autenticação ----------------

appRouter.get('/auth/config', (_req, res) => {
  res.json({ allowSignup: getSettings().allowSignup });
});

appRouter.post('/auth/register', (req, res) => {
  const settings = getSettings();
  if (!settings.allowSignup) throw new HttpError(403, 'Cadastro desabilitado. Solicite acesso ao administrador.');
  const body = z
    .object({ name: z.string().trim().min(2, 'Informe seu nome'), email, password, document: document.optional() })
    .parse(req.body);
  if (get('SELECT id FROM users WHERE email = ?', [body.email])) throw new HttpError(409, 'E-mail já cadastrado');
  const { lastId } = run(
    'INSERT INTO users (name, email, password_hash, role, permissions, document) VALUES (?, ?, ?, ?, ?, ?)',
    [
      body.name,
      body.email,
      bcrypt.hashSync(body.password, 10),
      'user',
      JSON.stringify(settings.defaultPermissions),
      body.document?.replace(/\D/g, '') || null,
    ],
  );
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', [lastId])!;
  res.status(201).json({ token: signToken(user), ...sessionPayload(user) });
});

appRouter.post('/auth/login', (req, res) => {
  const body = z.object({ email, password: z.string().min(1) }).parse(req.body);
  const user = get<UserRow>('SELECT * FROM users WHERE email = ?', [body.email]);
  if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
    throw new HttpError(401, 'E-mail ou senha incorretos');
  }
  if (!user.active) throw new HttpError(403, 'Usuário desativado. Contate o administrador.');
  res.json({ token: signToken(user), ...sessionPayload(user) });
});

appRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json(sessionPayload(req.user!));
});

appRouter.put('/auth/profile', requireAuth, (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(2),
      document,
      phone: z.string().trim().max(20).optional().default(''),
      currentPassword: z.string().optional(),
      newPassword: password.optional().or(z.literal('')),
    })
    .parse(req.body);
  const user = req.user!;
  if (body.newPassword) {
    if (!body.currentPassword || !bcrypt.compareSync(body.currentPassword, user.password_hash)) {
      throw new HttpError(400, 'Senha atual incorreta');
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(body.newPassword, 10), user.id]);
  }
  run('UPDATE users SET name = ?, document = ?, phone = ? WHERE id = ?', [
    body.name,
    body.document.replace(/\D/g, '') || null,
    body.phone || null,
    user.id,
  ]);
  res.json(sessionPayload(get<UserRow>('SELECT * FROM users WHERE id = ?', [user.id])!));
});

// ---------------- Empresas e análises ----------------

const companyData = z.object({
  empresa: z.record(z.string(), z.any()),
  faturamento: z.object({ meses: z.array(z.number()).length(12), categorias: z.record(z.string(), z.number()).optional() }),
  folha: z.record(z.string(), z.number()),
  custos: z.record(z.string(), z.number()),
  creditos: z.record(z.string(), z.number()),
});

function serializeCompany(row: { id: number; data: string; created_at: string; updated_at: string }) {
  return { id: row.id, ...JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at };
}

function ownCompany(userId: number, id: number) {
  const row = get<{ id: number; data: string; created_at: string; updated_at: string }>(
    'SELECT * FROM companies WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!row) throw new HttpError(404, 'Empresa não encontrada');
  return row;
}

appRouter.get('/companies', requireAuth, requireSubscription, (req, res) => {
  const rows = all('SELECT * FROM companies WHERE user_id = ? ORDER BY updated_at DESC', [req.user!.id]);
  res.json(rows.map(serializeCompany));
});

appRouter.post('/companies', requireAuth, requireSubscription, (req, res) => {
  const data = companyData.parse(req.body);
  const { lastId } = run('INSERT INTO companies (user_id, data) VALUES (?, ?)', [req.user!.id, JSON.stringify(data)]);
  run('UPDATE users SET current_company_id = ? WHERE id = ?', [lastId, req.user!.id]);
  res.status(201).json(serializeCompany(ownCompany(req.user!.id, lastId)));
});

appRouter.put('/companies/:id', requireAuth, requireSubscription, (req, res) => {
  const id = Number(req.params.id);
  ownCompany(req.user!.id, id);
  const data = companyData.parse(req.body);
  run(`UPDATE companies SET data = ?, updated_at = datetime('now') WHERE id = ?`, [JSON.stringify(data), id]);
  res.json(serializeCompany(ownCompany(req.user!.id, id)));
});

appRouter.delete('/companies/:id', requireAuth, requireSubscription, (req, res) => {
  const id = Number(req.params.id);
  ownCompany(req.user!.id, id);
  run('DELETE FROM companies WHERE id = ?', [id]);
  if (req.user!.current_company_id === id) run('UPDATE users SET current_company_id = NULL WHERE id = ?', [req.user!.id]);
  res.status(204).end();
});

appRouter.put('/companies/:id/select', requireAuth, requireSubscription, (req, res) => {
  const id = Number(req.params.id);
  ownCompany(req.user!.id, id);
  run('UPDATE users SET current_company_id = ? WHERE id = ?', [id, req.user!.id]);
  res.status(204).end();
});

// ---------------- Configurações tributárias do usuário ----------------

appRouter.get('/tax-config', requireAuth, requireSubscription, (req, res) => {
  res.json(req.user!.tax_config ? JSON.parse(req.user!.tax_config) : null);
});

appRouter.put('/tax-config', requireAuth, requireSubscription, (req, res) => {
  const body = z.record(z.string(), z.any()).nullable().parse(req.body);
  run('UPDATE users SET tax_config = ? WHERE id = ?', [body ? JSON.stringify(body) : null, req.user!.id]);
  res.json(body);
});

// ---------------- Assinatura ----------------

appRouter.get('/billing/plans', requireAuth, (_req, res) => {
  res.json(all<Plan>('SELECT * FROM plans WHERE active = 1 ORDER BY price_cents'));
});

appRouter.get('/billing/me', requireAuth, (req, res) => {
  const user = req.user!;
  const sub = getSubscription(user.id);
  res.json({
    paymentsEnabled: isCoraConfigured(),
    subscription: sub
      ? {
          ...sub,
          state: subscriptionState(sub),
          plan: get<Plan>('SELECT * FROM plans WHERE id = ?', [sub.plan_id]) ?? null,
        }
      : null,
    invoices: all<Invoice>('SELECT * FROM invoices WHERE user_id = ? ORDER BY id DESC LIMIT 50', [user.id]),
    ...sessionPayload(user),
  });
});

appRouter.post('/billing/subscribe', requireAuth, async (req, res) => {
  const { planId } = z.object({ planId: z.number().int() }).parse(req.body);
  const plan = get<Plan>('SELECT * FROM plans WHERE id = ? AND active = 1', [planId]);
  if (!plan) throw new HttpError(404, 'Plano indisponível');
  const invoice = await issueInvoice(req.user!.id, plan.id);
  res.status(201).json(invoice);
});

function ownInvoice(userId: number, id: number) {
  const inv = get<Invoice>('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, userId]);
  if (!inv) throw new HttpError(404, 'Fatura não encontrada');
  return inv;
}

appRouter.post('/billing/invoices/:id/refresh', requireAuth, async (req, res) => {
  const inv = ownInvoice(req.user!.id, Number(req.params.id));
  res.json(await syncInvoice(inv));
});

appRouter.post('/billing/invoices/:id/cancel', requireAuth, async (req, res) => {
  const inv = ownInvoice(req.user!.id, Number(req.params.id));
  await cancelInvoice(inv);
  res.status(204).end();
});
