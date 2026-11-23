import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, get, insert, run } from '../db.js';
import {
  HttpError,
  checkLoginLimit,
  clearLoginFailures,
  idParam,
  registerLoginFailure,
  publicUser,
  requireAuth,
  requireModule,
  requireSubscription,
  signToken,
  userModules,
  type UserRow,
} from '../auth.js';
import { MODULE_IDS, getSettings, isCoraConfigured } from '../settings.js';
import { needsSetup } from '../setup.js';
import {
  cancelInvoice,
  getSubscription,
  hasAccess,
  issueInvoice,
  planModules,
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

async function sessionPayload(user: UserRow) {
  const settings = getSettings();
  const sub = await getSubscription(user.id);
  const plan = sub ? await get<Plan>('SELECT * FROM plans WHERE id = ?', [sub.plan_id]) : undefined;
  return {
    user: await publicUser(user),
    access: {
      hasAccess: await hasAccess(user),
      requireSubscription: settings.requireSubscription && user.role !== 'admin',
      state: subscriptionState(sub),
      periodEnd: sub?.current_period_end ?? null,
      planName: plan?.name ?? null,
    },
  };
}

// ---------------- Autenticação ----------------

appRouter.get('/auth/config', async (_req, res) => {
  res.json({ allowSignup: getSettings().allowSignup, needsSetup: await needsSetup() });
});

// Configuração inicial: cria o primeiro administrador. Disponível apenas enquanto não houver admin.
appRouter.post('/auth/setup', async (req, res) => {
  if (!(await needsSetup())) throw new HttpError(409, 'O sistema já foi configurado.');
  const body = z
    .object({ name: z.string().trim().min(2, 'Informe seu nome'), email, password: z.string().min(8, 'A senha do administrador deve ter ao menos 8 caracteres') })
    .parse(req.body);
  const lastId = await insert('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', [
    body.name,
    body.email,
    bcrypt.hashSync(body.password, 10),
    'admin',
    JSON.stringify(MODULE_IDS),
  ]);
  console.log(`[setup] Administrador criado: ${body.email}`);
  const user = (await get<UserRow>('SELECT * FROM users WHERE id = ?', [lastId]))!;
  res.status(201).json({ token: signToken(user), ...(await sessionPayload(user)) });
});

appRouter.post('/auth/register', async (req, res) => {
  if (await needsSetup()) throw new HttpError(403, 'O sistema ainda não foi configurado pelo administrador.');
  const settings = getSettings();
  if (!settings.allowSignup) throw new HttpError(403, 'Cadastro desabilitado. Solicite acesso ao administrador.');
  const body = z
    .object({ name: z.string().trim().min(2, 'Informe seu nome'), email, password, document: document.optional() })
    .parse(req.body);
  if (await get('SELECT id FROM users WHERE email = ?', [body.email])) throw new HttpError(409, 'E-mail já cadastrado');
  const lastId = await insert(
    'INSERT INTO users (name, email, password_hash, role, permissions, document) VALUES (?, ?, ?, ?, ?, ?)',
    [
      body.name,
      body.email,
      bcrypt.hashSync(body.password, 10),
      'user',
      JSON.stringify(settings.defaultModules),
      body.document?.replace(/\D/g, '') || null,
    ],
  );
  const user = (await get<UserRow>('SELECT * FROM users WHERE id = ?', [lastId]))!;
  res.status(201).json({ token: signToken(user), ...(await sessionPayload(user)) });
});

appRouter.post('/auth/login', async (req, res) => {
  const body = z.object({ email, password: z.string().min(1) }).parse(req.body);
  checkLoginLimit(body.email);
  const user = await get<UserRow>('SELECT * FROM users WHERE email = ?', [body.email]);
  if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
    registerLoginFailure(body.email);
    throw new HttpError(401, 'E-mail ou senha incorretos');
  }
  clearLoginFailures(body.email);
  if (!user.active) throw new HttpError(403, 'Usuário desativado. Contate o administrador.');
  res.json({ token: signToken(user), ...(await sessionPayload(user)) });
});

appRouter.get('/auth/me', requireAuth, async (req, res) => {
  res.json(await sessionPayload(req.user!));
});

appRouter.put('/auth/profile', requireAuth, async (req, res) => {
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
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(body.newPassword, 10), user.id]);
  }
  await run('UPDATE users SET name = ?, document = ?, phone = ? WHERE id = ?', [
    body.name,
    body.document.replace(/\D/g, '') || null,
    body.phone || null,
    user.id,
  ]);
  res.json(await sessionPayload((await get<UserRow>('SELECT * FROM users WHERE id = ?', [user.id]))!));
});

// ---------------- Empresas e análises ----------------
// Leitura: qualquer módulo liberado. Criar/excluir empresas: módulo Principal. Editar dados: Principal ou Dados Financeiros.
const anyModule = requireModule();

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

async function ownCompany(userId: number, id: number) {
  const row = await get<{ id: number; data: string; created_at: string; updated_at: string }>(
    'SELECT * FROM companies WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!row) throw new HttpError(404, 'Empresa não encontrada');
  return row;
}

appRouter.get('/companies', requireAuth, requireSubscription, anyModule, async (req, res) => {
  const rows = await all('SELECT * FROM companies WHERE user_id = ? ORDER BY updated_at DESC', [req.user!.id]);
  res.json(rows.map(serializeCompany));
});

appRouter.post('/companies', requireAuth, requireSubscription, anyModule, async (req, res) => {
  // Sem o módulo Principal só é permitido criar a análise inicial (quando o usuário não tem nenhuma empresa).
  const hasCompany = await get('SELECT id FROM companies WHERE user_id = ? LIMIT 1', [req.user!.id]);
  if (hasCompany && !(await userModules(req.user!)).includes('principal')) {
    throw new HttpError(403, 'Você não tem permissão para cadastrar empresas.');
  }
  const data = companyData.parse(req.body);
  const lastId = await insert('INSERT INTO companies (user_id, data) VALUES (?, ?)', [req.user!.id, JSON.stringify(data)]);
  await run('UPDATE users SET current_company_id = ? WHERE id = ?', [lastId, req.user!.id]);
  res.status(201).json(serializeCompany(await ownCompany(req.user!.id, lastId)));
});

appRouter.put('/companies/:id', requireAuth, requireSubscription, requireModule('principal', 'dados-financeiros'), async (req, res) => {
  const id = idParam(req);
  await ownCompany(req.user!.id, id);
  const data = companyData.parse(req.body);
  await run(`UPDATE companies SET data = ?, updated_at = now() WHERE id = ?`, [JSON.stringify(data), id]);
  res.json(serializeCompany(await ownCompany(req.user!.id, id)));
});

appRouter.delete('/companies/:id', requireAuth, requireSubscription, requireModule('principal'), async (req, res) => {
  const id = idParam(req);
  await ownCompany(req.user!.id, id);
  await run('DELETE FROM companies WHERE id = ?', [id]);
  if (req.user!.current_company_id === id) await run('UPDATE users SET current_company_id = NULL WHERE id = ?', [req.user!.id]);
  res.status(204).end();
});

appRouter.put('/companies/:id/select', requireAuth, requireSubscription, anyModule, async (req, res) => {
  const id = idParam(req);
  await ownCompany(req.user!.id, id);
  await run('UPDATE users SET current_company_id = ? WHERE id = ?', [id, req.user!.id]);
  res.status(204).end();
});

// ---------------- Configurações tributárias do usuário ----------------

appRouter.get('/tax-config', requireAuth, requireSubscription, anyModule, async (req, res) => {
  res.json(req.user!.tax_config ? JSON.parse(req.user!.tax_config) : null);
});

appRouter.put('/tax-config', requireAuth, requireSubscription, requireModule('configuracoes'), async (req, res) => {
  const body = z.record(z.string(), z.any()).parse(req.body);
  await run('UPDATE users SET tax_config = ? WHERE id = ?', [JSON.stringify(body), req.user!.id]);
  res.json(body);
});

// Restaura os parâmetros padrão.
appRouter.delete('/tax-config', requireAuth, requireSubscription, requireModule('configuracoes'), async (req, res) => {
  await run('UPDATE users SET tax_config = NULL WHERE id = ?', [req.user!.id]);
  res.status(204).end();
});

// ---------------- Assinatura ----------------

appRouter.get('/billing/plans', requireAuth, async (_req, res) => {
  res.json((await all<Plan>('SELECT * FROM plans WHERE active = 1 ORDER BY price_cents')).map((p) => ({ ...p, modules: planModules(p) })));
});

appRouter.get('/billing/me', requireAuth, async (req, res) => {
  const user = req.user!;
  const sub = await getSubscription(user.id);
  res.json({
    paymentsEnabled: isCoraConfigured(),
    subscription: sub
      ? {
          ...sub,
          state: subscriptionState(sub),
          plan: (await get<Plan>('SELECT * FROM plans WHERE id = ?', [sub.plan_id])) ?? null,
        }
      : null,
    invoices: await all<Invoice>('SELECT * FROM invoices WHERE user_id = ? ORDER BY id DESC LIMIT 50', [user.id]),
    ...(await sessionPayload(user)),
  });
});

appRouter.post('/billing/subscribe', requireAuth, async (req, res) => {
  const { planId } = z.object({ planId: z.number().int() }).parse(req.body);
  const plan = await get<Plan>('SELECT * FROM plans WHERE id = ? AND active = 1', [planId]);
  if (!plan) throw new HttpError(404, 'Plano indisponível');
  const invoice = await issueInvoice(req.user!.id, plan.id);
  res.status(201).json(invoice);
});

async function ownInvoice(userId: number, id: number) {
  const inv = await get<Invoice>('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, userId]);
  if (!inv) throw new HttpError(404, 'Fatura não encontrada');
  return inv;
}

appRouter.post('/billing/invoices/:id/refresh', requireAuth, async (req, res) => {
  const inv = await ownInvoice(req.user!.id, idParam(req));
  res.json(await syncInvoice(inv));
});

appRouter.post('/billing/invoices/:id/cancel', requireAuth, async (req, res) => {
  const inv = await ownInvoice(req.user!.id, idParam(req));
  await cancelInvoice(inv);
  res.status(204).end();
});
