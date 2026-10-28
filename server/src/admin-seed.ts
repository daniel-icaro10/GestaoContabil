import { get, run } from './db.js';
import { MODULE_IDS } from './settings.js';

// Administrador pré-cadastrado. Guardamos apenas o hash bcrypt da senha — nunca a senha em texto.
// Para trocar: gere um novo hash com `npm --prefix server run hash-senha` e substitua passwordHash.
export const PRESET_ADMIN = {
  name: 'Administrador',
  email: 'admin@gestao.com',
  passwordHash: '$2b$12$0PNZXj/BrUbFjxOIh43JquQ.XuHBRDambvQUNzcVNd9x/wfvwkQ/i',
};

/** Cria o administrador pré-cadastrado se ele ainda não existir. Não altera um usuário já existente. */
export function ensurePresetAdmin() {
  const email = PRESET_ADMIN.email.trim().toLowerCase();
  if (!email || !PRESET_ADMIN.passwordHash) return;
  if (get('SELECT id FROM users WHERE email = ?', [email])) return;
  run('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', [
    PRESET_ADMIN.name,
    email,
    PRESET_ADMIN.passwordHash,
    'admin',
    JSON.stringify(MODULE_IDS),
  ]);
  console.log(`[setup] Administrador pré-cadastrado criado: ${email}`);
}

// Conta de demonstração para o cliente: todos os módulos e acesso liberado sem cobrança.
// Recriada a cada inicialização (no plano Free do Render o disco é apagado). Remova antes de ir para produção.
export const PRESET_DEMO = {
  name: 'Cliente Demonstração',
  email: 'cliente@gestao.com',
  passwordHash: '$2b$12$wRFOdsDzcjAkCtBRAx1OgO0glGD1V04VmqeYGG8p4pZ7MlHt2VSYW',
};

/** Cria o cliente de demonstração com assinatura ativa, se ele ainda não existir. Exige ao menos um plano cadastrado. */
export function ensureDemoClient() {
  const email = PRESET_DEMO.email.trim().toLowerCase();
  if (!email || !PRESET_DEMO.passwordHash) return;
  if (get('SELECT id FROM users WHERE email = ?', [email])) return;
  const plan = get<{ id: number }>('SELECT id FROM plans ORDER BY id LIMIT 1');
  if (!plan) return;
  const { lastId } = run('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', [
    PRESET_DEMO.name,
    email,
    PRESET_DEMO.passwordHash,
    'user',
    JSON.stringify(MODULE_IDS),
  ]);
  run(`INSERT INTO subscriptions (user_id, plan_id, status, current_period_end) VALUES (?, ?, 'active', ?)`, [
    lastId,
    plan.id,
    '2099-12-31T23:59:59.000Z',
  ]);
  console.log(`[setup] Cliente de demonstração criado: ${email}`);
}
