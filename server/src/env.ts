import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Carrega variáveis de um arquivo .env simples (KEY=VALUE), sem dependências externas.
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

// APP_SECRET assina os tokens JWT e cifra as credenciais da Cora. Se não for definido,
// gera um aleatório e persiste em data/.secret para sobreviver a reinícios.
function loadSecret(): string {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const file = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}

export const env = {
  port: Number(process.env.PORT ?? 3333),
  appSecret: loadSecret(),
  // No Render, RENDER_EXTERNAL_URL já traz a URL HTTPS pública do serviço.
  publicUrl: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),
  webDist: path.resolve(process.cwd(), '../web/dist'),
};
