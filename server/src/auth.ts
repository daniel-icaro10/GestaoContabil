import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { get } from './db.js';
import { env } from './env.js';
import { hasAccess } from './billing.js';
import { PAGES, type PageId } from './settings.js';

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

export function userPermissions(user: UserRow): PageId[] {
  if (user.role === 'admin') return [...PAGES];
  try {
    const list = JSON.parse(user.permissions) as string[];
    return PAGES.filter((p) => list.includes(p));
  } catch {
    return [];
  }
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
    permissions: userPermissions(user),
    document: user.document ?? '',
    phone: user.phone ?? '',
    currentCompanyId: user.current_company_id,
    createdAt: user.created_at,
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'Não autenticado'));
  try {
    const payload = jwt.verify(token, env.appSecret) as { sub: string };
    const user = get<UserRow>('SELECT * FROM users WHERE id = ?', [Number(payload.sub)]);
    if (!user || !user.active) return next(new HttpError(401, 'Sessão inválida'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Sessão expirada'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Acesso restrito ao administrador'));
  next();
}

/** Bloqueia os dados do sistema para usuários sem assinatura ativa. */
export function requireSubscription(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !hasAccess(req.user)) {
    return next(new HttpError(402, 'Assinatura inativa. Regularize o pagamento para continuar.'));
  }
  next();
}
