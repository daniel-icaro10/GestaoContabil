import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from './env.js';

// PostgreSQL. As consultas usam `?` como marcador (convertido para $1, $2...) para manter o SQL legível.

// Tipos devolvidos como valores JS simples: contagens/somas como número, datas como texto ISO.
pg.types.setTypeParser(20, (v) => Number(v)); // int8 (COUNT, SUM de inteiros)
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(1082, (v) => v); // date → 'YYYY-MM-DD'
pg.types.setTypeParser(1114, (v) => new Date(`${v.replace(' ', 'T')}Z`).toISOString()); // timestamp
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
pool.on('error', (e) => console.error('[db] erro em conexão ociosa:', e.message));

type Value = string | number | boolean | null | undefined;
type Params = Value[];

function toPg(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalize(params?: Params) {
  return (params ?? []).map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
}

export async function all<T = any>(sql: string, params?: Params): Promise<T[]> {
  const r = await pool.query(toPg(sql), normalize(params));
  return r.rows as T[];
}

export async function get<T = any>(sql: string, params?: Params): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

export async function run(sql: string, params?: Params): Promise<{ changes: number }> {
  const r = await pool.query(toPg(sql), normalize(params));
  return { changes: r.rowCount ?? 0 };
}

/** INSERT que devolve o id gerado. */
export async function insert(sql: string, params?: Params): Promise<number> {
  const r = await pool.query(`${toPg(sql)} RETURNING id`, normalize(params));
  return Number(r.rows[0].id);
}

export interface TxClient {
  all<T = any>(sql: string, params?: Params): Promise<T[]>;
  get<T = any>(sql: string, params?: Params): Promise<T | undefined>;
  run(sql: string, params?: Params): Promise<{ changes: number }>;
}

/** Executa `fn` numa transação (COMMIT no sucesso, ROLLBACK em erro). */
export async function tx<T>(fn: (c: TxClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const c: TxClient = {
    all: async (sql, params) => (await client.query(toPg(sql), normalize(params))).rows,
    get: async (sql, params) => (await client.query(toPg(sql), normalize(params))).rows[0],
    run: async (sql, params) => ({ changes: (await client.query(toPg(sql), normalize(params))).rowCount ?? 0 }),
  };
  try {
    await client.query('BEGIN');
    const r = await fn(c);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

// ---------------- Migrações ----------------
// Arquivos .sql em src/migrations, aplicados em ordem alfabética, uma única vez cada.

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function initDb() {
  const client = await pool.connect();
  try {
    // Impede que duas instâncias apliquem migrações ao mesmo tempo.
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[db] migração aplicada: ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migração ${file}: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
}
