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
