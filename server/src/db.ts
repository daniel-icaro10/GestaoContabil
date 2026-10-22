import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { DATA_DIR } from './env.js';

const DB_FILE = path.join(DATA_DIR, 'app.sqlite');

let db: Database;
let saveTimer: NodeJS.Timeout | null = null;

type Value = SqlValue | boolean | undefined;
type Params = Record<string, Value> | Value[];

function normalize(params?: Params): any {
  if (!params) return undefined;
  if (Array.isArray(params)) return params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  const out: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k.startsWith('@') || k.startsWith(':') || k.startsWith('$') ? k : `@${k}`] =
      v === undefined ? null : typeof v === 'boolean' ? Number(v) : v;
  }
  return out;
}

function persistNow() {
  if (!db) return;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, DB_FILE);
}

function schedulePersist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 150);
}

export function all<T = any>(sql: string, params?: Params): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(normalize(params));
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function get<T = any>(sql: string, params?: Params): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params?: Params): { lastId: number; changes: number } {
  db.run(sql, normalize(params));
  const lastId = Number(db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0);
  const changes = db.getRowsModified();
  schedulePersist();
  return { lastId, changes };
}

export function tx<T>(fn: () => T): T {
  db.run('BEGIN');
  try {
    const r = fn();
    db.run('COMMIT');
    schedulePersist();
    return r;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  permissions TEXT NOT NULL DEFAULT '[]',
  document TEXT,
  phone TEXT,
  tax_config TEXT,
  current_company_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'pending',
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id INTEGER REFERENCES plans(id),
  cora_id TEXT UNIQUE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  amount_cents INTEGER NOT NULL,
  period_months INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL,
  boleto_url TEXT,
  digitable TEXT,
  barcode TEXT,
  pix_emv TEXT,
  paid_at TEXT,
  applied INTEGER NOT NULL DEFAULT 0,
  manual INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  event_type TEXT,
  resource_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
`;

export async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  persistNow();

  const flush = () => {
    if (saveTimer) clearTimeout(saveTimer);
    persistNow();
  };
  process.on('exit', flush);
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      flush();
      process.exit(0);
    });
  }
}
