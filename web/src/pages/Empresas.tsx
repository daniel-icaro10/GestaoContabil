import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Copy, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useApp, type CompanyRecord } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dateBR, money } from '../lib/format';
import { REGIME_COLORS, exampleCompany, soma } from '../lib/tax';
import { Badge, Button, Card, Empty, Modal, PageHeader, clsx, useToast } from '../components/ui';

export default function Empresas() {
  const app = useApp();
  const { can, session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [toDelete, setToDelete] = useState<CompanyRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const list = app.companies.filter((c) => {
    const t = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (
      !t ||
      c.empresa.razaoSocial.toLowerCase().includes(t) ||
      c.empresa.nomeFantasia.toLowerCase().includes(t) ||
      (digits.length > 0 && c.empresa.cnpj.replace(/\D/g, '').includes(digits))
    );
  });

  const openCompany = async (c: CompanyRecord) => {
    await app.selectCompany(c.id);
    navigate(can('dashboard') ? '/dashboard' : '/');
  };

  const edit = async (c: CompanyRecord) => {
    await app.selectCompany(c.id);
    app.setNovaAnaliseStep(0);
    navigate('/nova-analise');
  };

  const create = async (example?: boolean) => {
    setBusy(true);
    try {
      await app.createCompany(example ? exampleCompany(session?.user.name) : undefined);
      app.setNovaAnaliseStep(0);
      if (can('nova-analise')) navigate('/nova-analise');
      else toast('Empresa criada.');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (c: CompanyRecord) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = c;
    await app.createCompany({ ...rest, empresa: { ...rest.empresa, razaoSocial: `${rest.empresa.razaoSocial} (cópia)` } });
    toast('Empresa duplicada.');
  };

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gerencie as empresas cadastradas e abra análises anteriores."
        actions={
          <>
            <Button variant="outline" icon={<Sparkles size={14} />} onClick={() => create(true)} disabled={busy}>
              Carregar exemplo
            </Button>
            <Button icon={<Plus size={14} />} onClick={() => create()} loading={busy}>
              Nova empresa
            </Button>
          </>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ..." />
      </div>

      {list.length === 0 ? (
        <Empty icon={<Building2 size={28} />} title="Nenhuma empresa encontrada." />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="text-right">Faturamento (12m)</th>
                  <th>Regime</th>
                  <th>Tipo</th>
                  <th>UF</th>
                  <th>Atualizado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const active = c.id === app.current?.id;
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => openCompany(c)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className={clsx(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                              active ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-subtle text-muted',
                            )}
                          >
                            <Building2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium">
                              {c.empresa.razaoSocial || 'Empresa sem nome'}
                              {active && <Badge tone="accent">Atual</Badge>}
                            </p>
                            <p className="num text-xs text-muted">{c.empresa.cnpj || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="num text-right">{money(soma(c.faturamento.meses))}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGIME_COLORS[c.empresa.regimeAtual] }} />
                          {c.empresa.regimeAtual}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{c.empresa.tipoAtividade}</td>
                      <td className="num text-xs">{c.empresa.estado}</td>
                      <td className="num text-xs text-muted">{dateBR(c.updatedAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {can('nova-analise') && (
                            <IconBtn title="Editar dados" onClick={() => edit(c)}>
                              <Pencil size={14} />
                            </IconBtn>
                          )}
                          <IconBtn title="Duplicar" onClick={() => duplicate(c)}>
                            <Copy size={14} />
                          </IconBtn>
                          <IconBtn title="Excluir" danger onClick={() => setToDelete(c)}>
                            <Trash2 size={14} />
                          </IconBtn>
                          <ChevronRight size={14} className="ml-1 text-muted" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir empresa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await app.deleteCompany(toDelete!.id);
                  toast('Empresa excluída.');
                  setToDelete(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Tem certeza que deseja excluir <span className="font-medium text-fg">{toDelete?.empresa.razaoSocial}</span> e todos
          os seus dados? Esta ação não pode ser desfeita.
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
