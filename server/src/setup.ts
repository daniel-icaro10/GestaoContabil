import crypto from 'node:crypto';
import { get, run } from './db.js';

// Configuração inicial: enquanto não existir administrador, o primeiro acesso cria a conta pela tela /setup.
// Para impedir que um estranho faça isso antes do dono, a tela exige um código de uso único que só aparece
// nos logs do servidor. O código é invalidado assim que o administrador é criado.

const MAX_ATTEMPTS = 10;
let attempts = 0;

export function needsSetup() {
  return !get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
}

function newCode() {
  // 12 caracteres sem ambiguidades (sem 0/O, 1/I), em grupos de 4.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw = Array.from(crypto.randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');
  return raw.match(/.{4}/g)!.join('-');
}

function hash(code: string) {
  return crypto.createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
}

/** Gera um novo código, guarda apenas o hash e o exibe no log. */
export function issueSetupCode() {
  const code = newCode();
  run(
    `INSERT INTO settings (key, value) VALUES ('setup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify({ hash: hash(code) })],
  );
  attempts = 0;
  console.log('');
  console.log('================================================================');
  console.log(' CONFIGURAÇÃO INICIAL — nenhum administrador cadastrado.');
  console.log(` Acesse /setup no navegador e informe o código: ${code}`);
  console.log(' O código vale para um único uso e é trocado a cada reinício.');
  console.log('================================================================');
  console.log('');
}

export function checkSetupCode(code: string): boolean {
  const row = get<{ value: string }>(`SELECT value FROM settings WHERE key = 'setup'`);
  if (!row) return false;
  const expected = Buffer.from(JSON.parse(row.value).hash, 'hex');
  const given = Buffer.from(hash(code), 'hex');
  const ok = crypto.timingSafeEqual(expected, given);
  if (!ok && ++attempts >= MAX_ATTEMPTS) {
    console.warn('[setup] Muitas tentativas inválidas — novo código gerado.');
    issueSetupCode();
  }
  return ok;
}

export function finishSetup() {
  run(`DELETE FROM settings WHERE key = 'setup'`);
}
