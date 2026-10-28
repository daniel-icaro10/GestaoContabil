import crypto from 'node:crypto';
import { get, run } from './db.js';
import { env } from './env.js';

// Telas do sistema que o admin pode liberar para cada usuário.
export const PAGES = [
  'dashboard',
  'nova-analise',
  'empresas',
  'faturamento',
  'folha',
  'custos',
  'creditos',
  'simples-nacional',
  'lucro-presumido',
  'lucro-real',
  'comparativo',
  'cenarios',
  'diagnostico',
  'relatorio',
  'configuracoes',
] as const;
export type PageId = (typeof PAGES)[number];

// Módulos: o admin libera módulos inteiros para cada usuário; cada módulo agrupa um conjunto de telas.
export const MODULES = {
  principal: ['dashboard', 'nova-analise', 'empresas'],
  'dados-financeiros': ['faturamento', 'folha', 'custos', 'creditos'],
  simulacoes: ['simples-nacional', 'lucro-presumido', 'lucro-real'],
  analise: ['comparativo', 'cenarios', 'diagnostico'],
  relatorios: ['relatorio'],
  configuracoes: ['configuracoes'],
} as const satisfies Record<string, readonly PageId[]>;
export type ModuleId = keyof typeof MODULES;
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** Normaliza uma lista salva de módulos. Aceita o formato antigo (ids de telas) e converte para o módulo da tela. */
export function toModules(list: unknown): ModuleId[] {
  if (!Array.isArray(list)) return [];
  return MODULE_IDS.filter((m) => list.includes(m) || MODULES[m].some((p) => list.includes(p)));
}

export function modulePages(modules: ModuleId[]): PageId[] {
  return PAGES.filter((p) => modules.some((m) => (MODULES[m] as readonly PageId[]).includes(p)));
}

export interface AppSettings {
  allowSignup: boolean;
  requireSubscription: boolean;
  defaultModules: ModuleId[];
  dueDays: number; // dias até o vencimento da fatura emitida
  renewalLeadDays: number; // dias antes do fim do período para emitir a renovação
  graceDays: number; // tolerância após o fim do período antes de bloquear
  finePercent: number;
  interestPercent: number;
  paymentForms: ('BANK_SLIP' | 'PIX')[];
}

const DEFAULT_SETTINGS: AppSettings = {
  allowSignup: true,
  requireSubscription: true,
  // Novos cadastros começam sem módulos: o admin libera o que cada usuário pode ver.
  defaultModules: [],
  dueDays: 3,
  renewalLeadDays: 5,
  graceDays: 3,
  finePercent: 2,
  interestPercent: 1,
  paymentForms: ['BANK_SLIP', 'PIX'],
};

export interface CoraConfig {
  environment: 'stage' | 'production';
  clientId: string;
  certificate: string; // PEM
  privateKey: string; // PEM (cifrado em repouso)
  baseUrl?: string; // sobrescreve a URL padrão do ambiente
  webhookUrl?: string;
  webhookToken: string; // segredo incluído na URL do webhook
}

function readJson<T>(key: string): T | undefined {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? (JSON.parse(row.value) as T) : undefined;
}

function writeJson(key: string, value: unknown) {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export function getSettings(): AppSettings {
  const { defaultPermissions, ...stored } = readJson<Partial<AppSettings> & { defaultPermissions?: string[] }>('app') ?? {};
  const s = { ...DEFAULT_SETTINGS, ...stored };
  // Configuração antiga guardava telas em defaultPermissions.
  s.defaultModules = toModules(stored.defaultModules ?? defaultPermissions ?? s.defaultModules);
  return s;
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  writeJson('app', next);
  return next;
}

// ---- Cifragem das credenciais (AES-256-GCM com chave derivada do APP_SECRET) ----
const key = crypto.createHash('sha256').update(`cora:${env.appSecret}`).digest();

export function encrypt(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  if (!payload) return '';
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('Formato de credencial desconhecido');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

export function getCoraConfig(): CoraConfig {
  const stored = readJson<CoraConfig>('cora');
  const cfg: CoraConfig = {
    environment: 'stage',
    clientId: '',
    certificate: '',
    privateKey: '',
    webhookToken: crypto.randomBytes(16).toString('hex'),
    ...(stored ?? {}),
  };
  if (!stored) writeJson('cora', { ...cfg });
  return { ...cfg, privateKey: stored?.privateKey ? decrypt(stored.privateKey) : '' };
}

export function saveCoraConfig(patch: Partial<CoraConfig>) {
  const current = getCoraConfig();
  const next = { ...current, ...patch };
  writeJson('cora', { ...next, privateKey: encrypt(next.privateKey) });
}

export function isCoraConfigured(cfg = getCoraConfig()) {
  return Boolean(cfg.clientId && cfg.certificate && cfg.privateKey);
}
