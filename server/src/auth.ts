import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { get } from './db.js';
import { env } from './env.js';
import { hasAccess, subscriptionModules } from './billing.js';
import { MODULE_IDS, modulePages, toModules, type ModuleId, type PageId } from './settings.js';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  active: number;
  permissions: string;
  document: string | null;
  phone: string | null;
  tax_config: string | null;
  current_company_id: number | null;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function signToken(user: UserRow) {
  return jwt.sign({ sub: String(user.id) }, env.appSecret, { expiresIn: '7d' });
}

/** Módulos liberados manualmente pelo admin (a coluna `permissions` guarda os ids dos módulos). */
export function grantedModules(user: UserRow): ModuleId[] {
  try {
    return toModules(JSON.parse(user.permissions));
  } catch {
    return [];
  }
}

/** Módulos efetivos: os liberados pelo admin mais os do plano da assinatura ativa. */
export async function userModules(user: UserRow): Promise<ModuleId[]> {
  if (user.role === 'admin') return [...MODULE_IDS];
  const mine = [...grantedModules(user), ...(await subscriptionModules(user.id))];
  return MODULE_IDS.filter((m) => mine.includes(m));
}

export async function userPermissions(user: UserRow): Promise<PageId[]> {
  return modulePages(await userModules(user));
}

export async function publicUser(user: UserRow) {
  const modules = await userModules(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
    modules,
    permissions: modulePages(modules),
    document: user.document ?? '',
    phone: user.phone ?? '',
    currentCompanyId: user.current_company_id,
    createdAt: user.created_at,
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'Não autenticado'));
  let payload: { sub: string };
  try {
    payload = jwt.verify(token, env.appSecret) as { sub: string };
  } catch {
    return next(new HttpError(401, 'Sessão expirada'));
  }
  const user = await get<UserRow>('SELECT * FROM users WHERE id = ?', [Number(payload.sub)]);
  if (!user || !user.active) return next(new HttpError(401, 'Sessão inválida'));
  req.user = user;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Acesso restrito ao administrador'));
  next();
}

/** Exige que o usuário tenha ao menos um dos módulos informados (sem argumentos: qualquer módulo). */
export function requireModule(...modules: ModuleId[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const mine = req.user ? await userModules(req.user) : [];
    const ok = modules.length ? modules.some((m) => mine.includes(m)) : mine.length > 0;
    if (!ok) return next(new HttpError(403, 'Você não tem permissão para este módulo. Solicite a liberação ao administrador.'));
    next();
  };
}

/** Bloqueia os dados do sistema para usuários sem assinatura ativa. */
export async function requireSubscription(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !(await hasAccess(req.user))) {
    return next(new HttpError(402, 'Assinatura inativa. Regularize o pagamento para continuar.'));
  }
  next();
}
