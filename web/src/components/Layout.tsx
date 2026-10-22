import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudCheck,
  CloudOff,
  KeyRound,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Package,
  Plug,
  Receipt,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PAGES, PAGE_GROUPS, pageLabel } from '../lib/pages';
import { dateBR, money } from '../lib/format';
import { soma } from '../lib/tax';
import { Badge } from './ui';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Visão Geral', icon: LayoutGrid, end: true },
  { to: '/admin/usuarios', label: 'Usuários e Permissões', icon: Users },
  { to: '/admin/planos', label: 'Planos', icon: Package },
  { to: '/admin/faturas', label: 'Faturas', icon: Receipt },
  { to: '/admin/cora', label: 'Integração Cora', icon: Plug },
  { to: '/admin/sistema', label: 'Sistema', icon: SlidersHorizontal },
];

const ROUTE_TITLES: Record<string, string> = {
  '/assinatura': 'Assinatura',
  '/perfil': 'Meu Perfil',
  '/sem-acesso': 'Sem acesso',
  ...Object.fromEntries(ADMIN_LINKS.map((l) => [l.to, l.label])),
};

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  return [dark, setDark] as const;
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
}

function NavItem({ to, icon: Icon, label, end, onClick }: { to: string; icon: any; label: string; end?: boolean; onClick?(): void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors',
          isActive ? 'bg-subtle font-medium text-fg' : 'text-muted hover:bg-subtle/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" />}
          <Icon size={15} className={clsx(isActive ? 'text-accent' : 'text-muted group-hover:text-fg')} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { session, can, isAdmin } = useAuth();
  const locked = Boolean(session && session.access.requireSubscription && !session.access.hasAccess);
  const groups = PAGE_GROUPS.map((g) => ({ group: g, items: PAGES.filter((p) => p.group === g && can(p.id)) })).filter(
    (g) => g.items.length,
  );
  return (
    <>
      <div
        className={clsx('no-print fixed inset-0 z-30 bg-black/30 lg:hidden', open ? 'block' : 'hidden')}
        onClick={onClose}
      />
      <aside
        className={clsx(
          'no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fg text-bg">
            <ShieldCheck size={15} />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight">Diagnóstico</p>
            <p className="label-xs !text-[9px]">Tributário Empresarial</p>
          </div>
          <button className="ml-auto rounded p-1 text-muted lg:hidden" onClick={onClose} aria-label="Fechar menu">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scroll-thin">
          {!locked &&
            groups.map(({ group, items }) => (
              <div key={group}>
                <p className="label-xs mb-1.5 px-2.5">{group}</p>
                <div className="space-y-px">
                  {items.map((p) => (
                    <NavItem key={p.id} to={`/${p.id}`} icon={p.icon} label={p.label} onClick={onClose} />
                  ))}
                </div>
              </div>
            ))}
          <div>
            <p className="label-xs mb-1.5 px-2.5">Conta</p>
            <div className="space-y-px">
              {!isAdmin && <NavItem to="/assinatura" icon={CircleDollarSign} label="Assinatura" onClick={onClose} />}
              <NavItem to="/perfil" icon={User} label="Meu Perfil" onClick={onClose} />
            </div>
          </div>
          {isAdmin && (
            <div>
              <p className="label-xs mb-1.5 px-2.5">Administração</p>
              <div className="space-y-px">
                {ADMIN_LINKS.map((l) => (
                  <NavItem key={l.to} {...l} onClick={onClose} />
                ))}
              </div>
            </div>
          )}
        </nav>
        <div className="border-t border-line px-5 py-3">
          <p className="num text-[10px] text-muted">v3.0 · {new Date().getFullYear()}</p>
        </div>
      </aside>
    </>
  );
}

function CompanySwitcher() {
  const app = useApp();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickOutside(open, () => setOpen(false));
  const e = app.current?.empresa;
  if (!app.ready || !e) return null;
  const list = app.companies.filter((c) =>
    `${c.empresa.razaoSocial} ${c.empresa.nomeFantasia} ${c.empresa.cnpj}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-subtle"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-subtle">
          <Building2 size={14} className="text-muted" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight">{e.nomeFantasia || e.razaoSocial || 'Empresa sem nome'}</p>
          <p className="num truncate text-[11px] leading-tight text-muted">{e.cnpj || 'CNPJ não informado'}</p>
        </div>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 animate-enter rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div className="relative mb-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="Buscar empresa..."
              className="w-full rounded-md bg-subtle py-1.5 pl-8 pr-2 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto scroll-thin">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  app.selectCompany(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.empresa.nomeFantasia || c.empresa.razaoSocial || 'Empresa sem nome'}</p>
                  <p className="num text-[11px] text-muted">
                    {c.empresa.regimeAtual} · {money(soma(c.faturamento.meses))}
                  </p>
                </div>
                {c.id === app.current?.id && <Check size={14} className="text-accent" />}
              </button>
            ))}
          </div>
          {can('empresas') && (
            <button
              onClick={() => {
                setOpen(false);
                navigate('/empresas');
              }}
              className="mt-1 w-full rounded-md border-t border-line px-2.5 py-2 text-left text-xs text-muted hover:text-fg"
            >
              Gerenciar empresas →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator() {
  const { saveState } = useApp();
  if (saveState === 'idle') return null;
  return (
    <span className="hidden items-center gap-1.5 text-[11px] text-muted md:flex">
      {saveState === 'saving' && <Loader2 size={12} className="animate-spin" />}
      {saveState === 'saved' && <CloudCheck size={13} className="text-ok" />}
      {saveState === 'error' && <CloudOff size={13} className="text-danger" />}
      {saveState === 'saving' ? 'Salvando' : saveState === 'saved' ? 'Salvo' : 'Falha ao salvar'}
    </span>
  );
}

function Notifications() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const items: { text: string; to: string }[] = [];
  const a = session?.access;
  if (a?.requireSubscription) {
    if (a.state === 'grace') items.push({ text: 'Sua assinatura venceu. Regularize para não perder o acesso.', to: '/assinatura' });
    if (a.state === 'expired' || a.state === 'none' || a.state === 'pending')
      items.push({ text: 'Assinatura inativa. Escolha um plano para liberar o sistema.', to: '/assinatura' });
    if (a.state === 'active' && a.periodEnd) {
      const days = Math.ceil((new Date(a.periodEnd).getTime() - Date.now()) / 86_400_000);
      if (days <= 7) items.push({ text: `Sua assinatura renova em ${days} dia(s) — ${dateBR(a.periodEnd)}.`, to: '/assinatura' });
    }
  }
  if (session && session.user.role !== 'admin' && !session.user.document) {
    items.push({ text: 'Cadastre seu CPF/CNPJ no perfil para emitir cobranças.', to: '/perfil' });
  }
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-fg"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 animate-enter rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="label-xs px-2.5 py-1.5">Notificações</p>
          {items.length === 0 && <p className="px-2.5 py-4 text-sm text-muted">Nenhuma notificação.</p>}
          {items.map((n, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                navigate(n.to);
              }}
              className="block w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-subtle"
            >
              {n.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { session, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  if (!session) return null;
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-subtle">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {session.user.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-[13px] font-medium sm:block">{session.user.name.split(' ')[0]}</span>
        <ChevronDown size={13} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 animate-enter rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
            <p className="truncate text-xs text-muted">{session.user.email}</p>
            <div className="mt-1.5">
              {isAdmin ? <Badge tone="accent">Administrador</Badge> : session.access.planName ? <Badge>{session.access.planName}</Badge> : null}
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuBtn icon={<User size={14} />} onClick={() => go('/perfil')}>Meu perfil</MenuBtn>
          {!isAdmin && <MenuBtn icon={<CircleDollarSign size={14} />} onClick={() => go('/assinatura')}>Assinatura</MenuBtn>}
          {isAdmin && <MenuBtn icon={<KeyRound size={14} />} onClick={() => go('/admin')}>Administração</MenuBtn>}
          <div className="my-1 h-px bg-line" />
          <MenuBtn icon={<LogOut size={14} />} onClick={logout}>Sair</MenuBtn>
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick(): void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-fg/90 hover:bg-subtle">
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}

export function Layout({ children, showCompany }: { children: ReactNode; showCompany: boolean }) {
  const [dark, setDark] = useTheme();
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const { current } = useApp();
  const title = ROUTE_TITLES[pathname] ?? pageLabel(pathname.slice(1));

  return (
    <div className="min-h-full">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <header className="no-print fixed left-0 right-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:left-60 lg:px-6">
        <button className="rounded-md p-1.5 text-muted lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <span className="hidden text-[13px] text-muted md:block">{title}</span>
        {showCompany && (
          <>
            <span className="hidden h-4 w-px bg-line md:block" />
            <CompanySwitcher />
            {current && (
              <div className="hidden items-center gap-1.5 xl:flex">
                <Badge>Período {current.empresa.periodoAnalise}</Badge>
                <Badge tone="accent">{current.empresa.regimeAtual}</Badge>
              </div>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {showCompany && <SaveIndicator />}
          <button
            onClick={() => setDark((d) => !d)}
            className="rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-fg"
            aria-label="Alternar tema"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Notifications />
          <UserMenu />
        </div>
      </header>
      <main className="print-area pt-14 lg:pl-60">
        <div className="mx-auto max-w-[1280px] animate-enter px-4 py-6 sm:px-6 lg:px-8 lg:py-8" key={pathname}>
          {children}
        </div>
      </main>
    </div>
  );
}
