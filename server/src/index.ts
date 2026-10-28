import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { env } from './env.js';
import { get, initDb, run } from './db.js';
import { HttpError } from './auth.js';
import { appRouter } from './routes/app.js';
import { adminRouter } from './routes/admin.js';
import { CoraError } from './cora.js';
import { handleWebhook, runBillingJobs } from './billing.js';
import { getCoraConfig } from './settings.js';
import { announceSetup, needsSetup } from './setup.js';
import { ensureDemoClient, ensurePresetAdmin } from './admin-seed.js';

await initDb();

// Administrador pré-cadastrado; se não houver nenhum, o primeiro acesso cria pela tela /setup.
ensurePresetAdmin();
if (needsSetup()) announceSetup();

// Planos de exemplo.
if (!get('SELECT id FROM plans LIMIT 1')) {
  run('INSERT INTO plans (name, description, price_cents, interval_months) VALUES (?, ?, ?, ?)', [
    'Mensal',
    'Acesso completo ao diagnóstico tributário, cobrado mensalmente.',
    9900,
    1,
  ]);
  run('INSERT INTO plans (name, description, price_cents, interval_months) VALUES (?, ?, ?, ?)', [
    'Anual',
    'Acesso completo por 12 meses com desconto.',
    99000,
    12,
  ]);
}

ensureDemoClient();

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Webhook da Cora: os dados vêm nos cabeçalhos (corpo vazio). O token na URL autentica a origem.
app.post('/api/webhooks/cora/:token', async (req, res) => {
  if (req.params.token !== getCoraConfig().webhookToken) return res.status(404).end();
  const resourceId = String(req.get('webhook-resource-id') ?? req.body?.resource?.id ?? req.body?.id ?? '');
  const eventType = String(req.get('webhook-event-type') ?? req.body?.event_type ?? '');
  const eventId = req.get('webhook-event-id') ?? undefined;
  res.status(200).json({ received: true });
  handleWebhook(resourceId, eventType, eventId).catch((e) => console.warn('[webhook]', e.message));
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/admin', adminRouter);
app.use('/api', appRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada')));

// Frontend compilado (produção).
if (fs.existsSync(env.webDist)) {
  app.use(express.static(env.webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(env.webDist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos' });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof CoraError) {
    const status = err.status >= 400 && err.status < 600 ? (err.status === 401 ? 502 : err.status) : 502;
    return res.status(status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(env.port, () => {
  console.log(`[server] API ouvindo em http://localhost:${env.port}`);
});

// Sincronização de faturas e emissão de renovações a cada 30 minutos.
setInterval(() => runBillingJobs().catch((e) => console.warn('[billing]', e.message)), 30 * 60_000);
setTimeout(() => runBillingJobs().catch((e) => console.warn('[billing]', e.message)), 10_000);
