import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { ModuleId } from '../../lib/pages';
import { PermissionPicker } from '../../components/PermissionPicker';
import { Button, Card, CardTitle, Checkbox, Field, Input, PageHeader, Spinner, Toggle, useToast } from '../../components/ui';

interface Settings {
  allowSignup: boolean;
  requireSubscription: boolean;
  defaultModules: ModuleId[];
  dueDays: number;
  renewalLeadDays: number;
  graceDays: number;
  finePercent: number;
  interestPercent: number;
  paymentForms: ('BANK_SLIP' | 'PIX')[];
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function Sistema() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Settings>('/admin/settings').then(setS).catch((e) => toast(e.message, 'danger'));
  }, [toast]);

  if (!s) return <Spinner />;

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) || 0 });

  const save = async () => {
    setBusy(true);
    try {
      const { allowSignup, requireSubscription, defaultModules, dueDays, renewalLeadDays, graceDays, finePercent, interestPercent, paymentForms } = s;
      setS(
        await api('/admin/settings', {
          method: 'PUT',
          body: { allowSignup, requireSubscription, defaultModules, dueDays, renewalLeadDays, graceDays, finePercent, interestPercent, paymentForms },
        }),
      );
      toast('Configurações salvas.');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const toggleForm = (f: 'BANK_SLIP' | 'PIX', on: boolean) =>
    setS({ ...s, paymentForms: on ? [...new Set([...s.paymentForms, f])] : s.paymentForms.filter((x) => x !== f) });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        eyebrow="Administração"
        title="Sistema"
        description="Regras de acesso, cobrança e permissões padrão."
        actions={
          <Button icon={<Save size={14} />} onClick={save} loading={busy}>
            Salvar
          </Button>
        }
      />
      <Card>
        <CardTitle>Acesso</CardTitle>
        <Row title="Permitir cadastro público" description="Novos usuários podem criar conta pela tela de login.">
          <Toggle checked={s.allowSignup} onChange={(v) => setS({ ...s, allowSignup: v })} label="Cadastro público" />
        </Row>
        <Row title="Exigir assinatura ativa" description="Usuários sem pagamento em dia ficam restritos à tela de assinatura.">
          <Toggle checked={s.requireSubscription} onChange={(v) => setS({ ...s, requireSubscription: v })} label="Exigir assinatura" />
        </Row>
      </Card>

      <Card>
        <CardTitle>Cobrança</CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Vencimento (dias após emissão)">
            <Input type="number" min={1} className="num" value={s.dueDays} onChange={num('dueDays')} />
          </Field>
          <Field label="Emitir renovação (dias antes)" tip="Antes do fim do período pago.">
            <Input type="number" min={0} className="num" value={s.renewalLeadDays} onChange={num('renewalLeadDays')} />
          </Field>
          <Field label="Tolerância após vencer (dias)" tip="Acesso mantido enquanto aguarda pagamento.">
            <Input type="number" min={0} className="num" value={s.graceDays} onChange={num('graceDays')} />
          </Field>
          <Field label="Multa por atraso (%)">
            <Input type="number" min={0} step="0.1" className="num" value={s.finePercent} onChange={num('finePercent')} />
          </Field>
          <Field label="Juros ao mês (%)">
            <Input type="number" min={0} step="0.1" className="num" value={s.interestPercent} onChange={num('interestPercent')} />
          </Field>
          <Field label="Formas de pagamento">
            <div className="flex h-[38px] items-center gap-5">
              <Checkbox checked={s.paymentForms.includes('PIX')} onChange={(v) => toggleForm('PIX', v)} label="PIX" />
              <Checkbox checked={s.paymentForms.includes('BANK_SLIP')} onChange={(v) => toggleForm('BANK_SLIP', v)} label="Boleto" />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Módulos padrão para novos usuários</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Aplicados a contas criadas pelo cadastro público. Deixe todos desmarcados para que o novo usuário só veja o sistema
          depois que você liberar os módulos em Usuários.
        </p>
        <PermissionPicker value={s.defaultModules} onChange={(defaultModules) => setS({ ...s, defaultModules })} />
      </Card>
    </div>
  );
}
