import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cents, intervalLabel } from '../../lib/format';
import { MODULES, moduleLabel, type ModuleId } from '../../lib/pages';
import { PermissionPicker } from '../../components/PermissionPicker';
import { Badge, Button, Card, Empty, Field, Input, Modal, MoneyInput, PageHeader, Spinner, Textarea, Toggle, useToast } from '../../components/ui';

interface Plan {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  interval_months: number;
  active: number;
  subscribers: number;
  modules: ModuleId[];
}

interface Form {
  id?: number;
  name: string;
  description: string;
  price: number;
  interval_months: number;
  active: boolean;
  modules: ModuleId[];
}

export default function Planos() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Plan[]>('/admin/plans').then(setPlans), []);
  useEffect(() => {
    load().catch((e) => toast(e.message, 'danger'));
  }, [load, toast]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        price_cents: Math.round(form.price * 100),
        interval_months: form.interval_months,
        active: form.active,
        modules: form.modules,
      };
      if (form.id) await api(`/admin/plans/${form.id}`, { method: 'PUT', body });
      else await api('/admin/plans', { body });
      await load();
      setForm(null);
      toast('Plano salvo.');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Plan) => {
    try {
      await api(`/admin/plans/${p.id}`, { method: 'DELETE' });
      await load();
      toast('Plano excluído.');
    } catch (e: any) {
      toast(e.message, 'danger');
    }
  };

  if (!plans) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Planos de assinatura"
        description="Valores, periodicidade e módulos liberados para quem assina. Cobrança via Cora (boleto + PIX)."
        actions={
          <Button
            icon={<Plus size={14} />}
            onClick={() => setForm({ name: '', description: '', price: 0, interval_months: 1, active: true, modules: MODULES.map((m) => m.id) })}
          >
            Novo plano
          </Button>
        }
      />
      {plans.length === 0 ? (
        <Empty title="Nenhum plano cadastrado." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.active ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <div className="mt-1 flex gap-1.5">
                    {p.active ? <Badge tone="ok">Ativo</Badge> : <Badge>Inativo</Badge>}
                    <Badge>{p.subscribers} assinante(s)</Badge>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <button
                    title="Editar"
                    className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg"
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: p.price_cents / 100,
                        interval_months: p.interval_months,
                        active: !!p.active,
                        modules: p.modules,
                      })
                    }
                  >
                    <Pencil size={14} />
                  </button>
                  <button title="Excluir" className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-danger" onClick={() => remove(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-4">
                <span className="num text-2xl font-semibold">{cents(p.price_cents)}</span>
                <span className="text-sm text-muted">/{intervalLabel(p.interval_months)}</span>
              </p>
              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {p.modules.map((m) => (
                  <Badge key={m}>{moduleLabel(m)}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        wide
        title={form?.id ? 'Editar plano' : 'Novo plano'}
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
          <div className="space-y-4">
            <Field label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <MoneyInput label="Valor" tip="Mínimo R$ 5,00 (regra da Cora)" value={form.price} onChange={(price) => setForm({ ...form, price })} />
              <Field label="Período (meses)" tip="Ex.: 1 = mensal, 12 = anual">
                <Input
                  type="number"
                  min={1}
                  max={36}
                  className="num"
                  value={form.interval_months}
                  onChange={(e) => setForm({ ...form, interval_months: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
            </div>
            <Field label="Descrição">
              <Textarea className="!font-sans !text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Disponível para novos assinantes</p>
                <p className="text-xs text-muted">Planos inativos continuam válidos para quem já assina, mas não renovam automaticamente.</p>
              </div>
              <Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Ativo" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Módulos incluídos</p>
              <p className="mb-3 text-xs text-muted">Liberados automaticamente enquanto a assinatura estiver paga.</p>
              <PermissionPicker value={form.modules} onChange={(modules) => setForm({ ...form, modules })} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
