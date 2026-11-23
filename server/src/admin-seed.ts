import { get, insert, run } from './db.js';
import { MODULE_IDS } from './settings.js';

// Administrador pré-cadastrado. Guardamos apenas o hash bcrypt da senha — nunca a senha em texto.
// Para trocar: gere um novo hash com `npm --prefix server run hash-senha` e substitua passwordHash.
export const PRESET_ADMIN = {
  name: 'Administrador',
  email: 'admin@gestao.com',
  passwordHash: '$2b$12$.BWeAUclLdNNsB74zsXwtemb5xElNNB7m7qr7TRvNDIyJ1NuyaM.m',
};

/** Cria o administrador pré-cadastrado se ele ainda não existir. Não altera um usuário já existente. */
export async function ensurePresetAdmin() {
  const email = PRESET_ADMIN.email.trim().toLowerCase();
  if (!email || !PRESET_ADMIN.passwordHash) return;
  if (await get('SELECT id FROM users WHERE email = ?', [email])) return;
  await run('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', [
    PRESET_ADMIN.name,
    email,
    PRESET_ADMIN.passwordHash,
    'admin',
    JSON.stringify(MODULE_IDS),
  ]);
  console.log(`[setup] Administrador pré-cadastrado criado: ${email}`);
}

// Conta de demonstração para o cliente: todos os módulos e acesso liberado sem cobrança.
// Criada na primeira inicialização se não existir. Remova antes de ir para produção.
export const PRESET_DEMO = {
  name: 'Cliente Demonstração',
  email: 'cliente@gestao.com',
  passwordHash: '$2b$12$wRFOdsDzcjAkCtBRAx1OgO0glGD1V04VmqeYGG8p4pZ7MlHt2VSYW',
};

/** Cria o cliente de demonstração com assinatura ativa, se ele ainda não existir. Exige ao menos um plano cadastrado. */
export async function ensureDemoClient() {
  const email = PRESET_DEMO.email.trim().toLowerCase();
  if (!email || !PRESET_DEMO.passwordHash) return;
  if (await get('SELECT id FROM users WHERE email = ?', [email])) return;
  const plan = await get<{ id: number }>('SELECT id FROM plans ORDER BY id LIMIT 1');
  if (!plan) return;
  const lastId = await insert('INSERT INTO users (name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)', [
    PRESET_DEMO.name,
    email,
    PRESET_DEMO.passwordHash,
    'user',
    JSON.stringify(MODULE_IDS),
  ]);
  await run(`INSERT INTO subscriptions (user_id, plan_id, status, current_period_end) VALUES (?, ?, 'active', ?)`, [
    lastId,
    plan.id,
    '2099-12-31T23:59:59.000Z',
  ]);
  console.log(`[setup] Cliente de demonstração criado: ${email}`);
}
