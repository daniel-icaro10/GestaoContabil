import https from 'node:https';
import crypto from 'node:crypto';
import { getCoraConfig, isCoraConfigured, type CoraConfig } from './settings.js';

// Cliente da API Cora — modalidade Integração Direta (mTLS com certificado + chave privada).
// Docs: https://developers.cora.com.br/docs/instrucoes-iniciais

export const CORA_BASE_URLS = {
  stage: 'https://matls-clients.api.stage.cora.com.br',
  production: 'https://matls-clients.api.cora.com.br',
} as const;

export class CoraError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

export interface CoraInvoice {
  id: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PAYMENT' | 'LATE' | 'PAID' | 'CANCELLED';
  code?: string;
  total_amount: number;
  total_paid: number;
  occurrence_date?: string | null;
  payment_terms?: { due_date: string };
  payment_options?: { bank_slip?: { barcode?: string; digitable?: string; url?: string } };
  pix?: { emv?: string | null } | null;
  payments?: { finalized_at?: string; total_paid?: number }[];
}

export interface CreateInvoiceInput {
  code: string;
  customer: { name: string; email: string; document: string };
  serviceName: string;
  serviceDescription: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  finePercent?: number;
  interestPercent?: number;
  paymentForms: ('BANK_SLIP' | 'PIX')[];
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

function baseUrl(cfg: CoraConfig) {
  return (cfg.baseUrl?.trim() || CORA_BASE_URLS[cfg.environment]).replace(/\/$/, '');
}

function request(
  cfg: CoraConfig,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: any }> {
  const url = new URL(baseUrl(cfg) + path);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        cert: cfg.certificate,
        key: cfg.privateKey,
        headers: {
          Accept: 'application/json',
          ...(opts.body ? { 'Content-Length': Buffer.byteLength(opts.body).toString() } : {}),
          ...opts.headers,
        },
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: any = text;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            /* resposta não-JSON */
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Tempo limite excedido ao contatar a Cora')));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function errorMessage(body: any, fallback: string) {
  if (body && typeof body === 'object') {
    const details = Array.isArray(body.errors)
      ? body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join('; ')
      : '';
    return [body.message ?? body.error_description ?? body.error ?? fallback, details].filter(Boolean).join(' — ');
  }
  return typeof body === 'string' && body ? body.slice(0, 300) : fallback;
}

async function getToken(cfg: CoraConfig): Promise<string> {
  const cacheKey = `${cfg.environment}:${cfg.clientId}:${baseUrl(cfg)}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId }).toString();
  const res = await request(cfg, 'POST', '/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new CoraError(`Falha na autenticação Cora: ${errorMessage(res.body, `HTTP ${res.status}`)}`, res.status, res.body);
  }
  tokenCache = {
    key: cacheKey,
    token: res.body.access_token,
    expiresAt: Date.now() + Number(res.body.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

async function api(method: string, path: string, payload?: unknown, cfgOverride?: CoraConfig) {
  const cfg = cfgOverride ?? getCoraConfig();
  if (!isCoraConfigured(cfg)) throw new CoraError('Integração Cora não configurada', 400);
  const token = await getToken(cfg);
  const res = await request(cfg, method, path, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload !== undefined
        ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }
        : {}),
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 401) tokenCache = null;
  if (res.status >= 400) {
    throw new CoraError(errorMessage(res.body, `Erro HTTP ${res.status} na API Cora`), res.status, res.body);
  }
  return res.body;
}

export const cora = {
  async testConnection(cfg?: CoraConfig) {
    const c = cfg ?? getCoraConfig();
    tokenCache = null;
    await getToken(c);
    return { ok: true, baseUrl: baseUrl(c) };
  },

  async createInvoice(input: CreateInvoiceInput): Promise<CoraInvoice> {
    const doc = input.customer.document.replace(/\D/g, '');
    const payload: any = {
      code: input.code,
      customer: {
        name: input.customer.name.slice(0, 60),
        email: input.customer.email.slice(0, 60),
        document: { identity: doc, type: doc.length > 11 ? 'CNPJ' : 'CPF' },
      },
      services: [
        {
          name: input.serviceName.slice(0, 60),
          description: input.serviceDescription.slice(0, 100),
          amount: input.amountCents,
        },
      ],
      payment_terms: {
        due_date: input.dueDate,
        ...(input.finePercent ? { fine: { rate: input.finePercent } } : {}),
        ...(input.interestPercent ? { interest: { rate: input.interestPercent } } : {}),
      },
      payment_forms: input.paymentForms,
    };
    return api('POST', '/v2/invoices/', payload);
  },

  getInvoice(id: string): Promise<CoraInvoice> {
    return api('GET', `/v2/invoices/${encodeURIComponent(id)}`);
  },

  async cancelInvoice(id: string) {
    await api('DELETE', `/v2/invoices/${encodeURIComponent(id)}`);
  },

  // Disponível apenas no ambiente Stage — simula o pagamento de um boleto.
  async payInvoiceStage(id: string) {
    return api('POST', '/v2/invoices/pay', { id });
  },

  listEndpoints() {
    return api('GET', '/endpoints/');
  },

  createEndpoint(url: string, resource = 'invoice', trigger = '*') {
    return api('POST', '/endpoints/', { url, resource, trigger });
  },

  deleteEndpoint(id: string) {
    return api('DELETE', `/endpoints/${encodeURIComponent(id)}`);
  },

  resetToken() {
    tokenCache = null;
  },
};
