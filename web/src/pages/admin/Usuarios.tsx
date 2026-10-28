import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Pencil, Plus, Search, ShieldOff, Trash2, UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { dateBR, formatDoc, maskCpfCnpj } from '../../lib/format';
import { MODULES, type ModuleId } from '../../lib/pages';
import { useAuth } from '../../context/AuthContext';
import { PermissionPicker } from '../../components/PermissionPicker';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Toggle, clsx, useToast } from '../../components/ui';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
  /** Módulos efetivos (liberados pelo admin + plano da assinatura). */
  modules: ModuleId[];
  /** Módulos liberados manualmente pelo admin. */
  grantedModules: ModuleId[];
  document: string;
  phone: string;
  companies: number;
  createdAt: string;
  subscription: null | { state: string; periodEnd: string | null; planId: number; planName: string | null };
}

interface Plan {
  id: number;
  name: string;
  interval_months: number;
}

const SUB_BADGE: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent' }> = {
  active: { label: 'Ativa', tone: 'ok' },
  grace: { label: 'Tolerância', tone: 'warn' },
  expired: { label: 'Expirada', tone: 'danger' },
  pending: { label: 'Pendente', tone: 'accent' },
  none: { label: 'Sem plano', tone: 'neutral' },
};

type FormState = Omit<AdminUser, 'id' | 'companies' | 'createdAt' | 'subscription' | 'grantedModules'> & { id?: number; password: string };

const emptyForm = (modules: ModuleId[]): FormState => ({
  name: '',
  email: '',
  role: 'user',
  active: true,
  modules,
  document: '',
  phone: '',
  password: '',
});

export default function Usuarios() {
  const { session } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [defaultPerms, setDefaultPerms] = useState<ModuleId[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [access, setAccess] = useState<{ user: AdminUser; planId: number; until: string } | null>(null);
  const [del, setDel] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [u, p, s] = await Promise.all([
      api<AdminUser[]>('/admin/users'),
      api<Plan[]>('/admin/plans'),
      api<{ defaultModules: ModuleId[] }>('/admin/settings'),
    ]);
    setUsers(u);
    setPlans(p);
    setDefaultPerms(s.defaultModules);
  }, []);

  useEffect(() => {
    load().catch((e) => toast(e.message, 'danger'));
  }, [load, toast]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      toast(msg);
      return true;
    } catch (e: any) {
      toast(e.message, 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const body = { ...form, document: form.document.replace(/\D/g, '') };
    const ok = await run(
      () => (form.id ? api(`/admin/users/${form.id}`, { method: 'PUT', body }) : api('/admin/users', { body })),
      form.id ? 'Usuário atualizado.' : 'Usuário criado.',
    );
    if (ok) setForm(null);
  };

  if (!users) return <Spinner />;
  const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Usuários e permissões"
        description="Crie usuários, defina o perfil e escolha quais módulos cada um pode acessar."
        actions={
          <Button icon={<Plus size={14} />} onClick={() => setForm(emptyForm(defaultPerms))}>
            Novo usuário
          </Button>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail..." />
      </div>
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Módulos</th>
                <th>Assinatura</th>
                <th>Empresas</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const sb = SUB_BADGE[u.subscription?.state ?? 'none'];
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{u.role === 'admin' ? <Badge tone="accent">Admin</Badge> : <Badge>Usuário</Badge>}</td>
                    <td className="num text-xs text-muted">{u.role === 'admin' ? 'Todos' : `${u.modules.length}/${MODULES.length}`}</td>
                    <td>
                      {u.role === 'admin' ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <div>
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                          {u.subscription?.periodEnd && (
                            <p className="num mt-0.5 text-[11px] text-muted">
                              {u.subscription.planName} · até {dateBR(u.subscription.periodEnd)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="num text-xs">{u.companies}</td>
                    <td>
                      <span className={clsx('inline-flex items-center gap-1.5 text-xs', u.active ? 'text-ok' : 'text-muted')}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', u.active ? 'bg-ok' : 'bg-muted')} />
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        {u.role !== 'admin' && (
                          <IconBtn
                            title="Liberar acesso manualmente"
                            onClick={() =>
                              setAccess({
                                user: u,
                                planId: u.subscription?.planId ?? plans[0]?.id ?? 0,
                                until: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
                              })
                            }
                          >
                            <CalendarClock size={14} />
                          </IconBtn>
                        )}
                        <IconBtn
                          title="Editar"
                          onClick={() => setForm({ ...u, modules: u.grantedModules, document: maskCpfCnpj(u.document), password: '' })}
                        >
                          <Pencil size={14} />
                        </IconBtn>
                        {u.id !== session?.user.id && (
                          <IconBtn title="Excluir" danger onClick={() => setDel(u)}>
                            <Trash2 size={14} />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Criar / editar */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        wide
        title={form?.id ? 'Editar usuário' : 'Novo usuário'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={busy}>
              Salvar
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label={form.id ? 'Nova senha' : 'Senha'} tip={form.id ? 'Deixe em branco para manter a atual.' : 'Mínimo de 6 caracteres.'}>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
              </Field>
              <Field label="CPF ou CNPJ">
                <Input className="num" value={form.document} onChange={(e) => setForm({ ...form, document: maskCpfCnpj(e.target.value) })} />
              </Field>
              <Field label="Telefone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Perfil">
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Usuário ativo</p>
                  <p className="text-xs text-muted">Usuários inativos não conseguem entrar no sistema.</p>
                </div>
                <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Ativo" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Módulos liberados pelo administrador</p>
              {form.role !== 'admin' && (
                <p className="mb-3 text-xs text-muted">
                  Além destes, o usuário recebe automaticamente os módulos do plano enquanto a assinatura estiver paga.
                </p>
              )}
              {form.role === 'admin' ? (
                <p className="text-sm text-muted">Administradores têm acesso a todos os módulos e à área administrativa.</p>
              ) : (
                <PermissionPicker value={form.modules} onChange={(modules) => setForm({ ...form, modules })} />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Acesso manual */}
      <Modal
        open={!!access}
        onClose={() => setAccess(null)}
        title="Liberar acesso manualmente"
        description={access?.user.name}
        footer={
          <>
            <Button
              variant="danger"
              icon={<ShieldOff size={14} />}
              className="mr-auto"
              loading={busy}
              onClick={async () => {
                if (await run(() => api(`/admin/users/${access!.user.id}/revoke`, { method: 'POST' }), 'Acesso revogado.')) setAccess(null);
              }}
            >
              Revogar
            </Button>
            <Button variant="ghost" onClick={() => setAccess(null)}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (
                  await run(
                    () => api(`/admin/users/${access!.user.id}/access`, { body: { planId: access!.planId, until: access!.until } }),
                    'Acesso liberado.',
                  )
                )
                  setAccess(null);
              }}
            >
              Liberar
            </Button>
          </>
        }
      >
        {access && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Use para cortesias ou pagamentos recebidos fora do sistema. A assinatura ficará ativa até a data escolhida.
            </p>
            <Field label="Plano">
              <Select value={access.planId} onChange={(e) => setAccess({ ...access, planId: Number(e.target.value) })}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Acesso válido até">
              <Input type="date" value={access.until} onChange={(e) => setAccess({ ...access, until: e.target.value })} />
            </Field>
            {access.user.document && <p className="num text-xs text-muted">Documento: {formatDoc(access.user.document)}</p>}
          </div>
        )}
      </Modal>

      {/* Excluir */}
      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Excluir usuário"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (await run(() => api(`/admin/users/${del!.id}`, { method: 'DELETE' }), 'Usuário excluído.')) setDel(null);
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-muted">
          <UserRound size={16} className="mt-0.5 shrink-0" />
          <span>
            Excluir <span className="font-medium text-fg">{del?.name}</span> remove também suas empresas, análises e histórico
            de cobranças. Para apenas bloquear o acesso, prefira desativar o usuário.
          </span>
        </p>
      </Modal>
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick(): void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx('rounded-md p-1.5 text-muted transition hover:bg-subtle', danger ? 'hover:text-danger' : 'hover:text-fg')}
    >
      {children}
    </button>
  );
}
