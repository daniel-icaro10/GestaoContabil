import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ChevronRight, FilePlus2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MESES, money } from '../lib/format';
import { mediaMensal, soma } from '../lib/tax';
import { CREDITO_FIELDS, CUSTO_FIELDS, DESPESA_FIELDS, FOLHA_FIELDS } from '../lib/fields';
import { EmpresaForm } from '../components/EmpresaForm';
import { Alert, Button, Card, MoneyInput, PageHeader, clsx, useToast } from '../components/ui';
import type { PageId } from '../lib/pages';

const STEPS = ['Empresa', 'Faturamento', 'Folha', 'Custos', 'Despesas', 'Créditos', 'Regimes', 'Comparativo', 'Diagnóstico'];

function StepTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
  );
}

export default function NovaAnalise() {
  const app = useApp();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, setFaturamento, setFolha, setCustos, setCreditos } = app;
  const s = app.novaAnaliseStep;
  const setS = app.setNovaAnaliseStep;
  const rbt12 = soma(data.faturamento.meses);
  const media = mediaMensal(data.faturamento.meses);
  const go = (p: PageId) => (can(p) ? navigate(`/${p}`) : toast('Você não tem permissão para acessar esta tela.', 'danger'));

  const next = () => (s === STEPS.length - 1 ? go('comparativo') : setS(s + 1));

  const startNew = async () => {
    await app.createCompany();
    setS(0);
    toast('Nova empresa criada. Preencha os dados abaixo.');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Assistente"
        title="Nova análise"
        description={
          <>
            Editando: <span className="font-medium text-fg">{data.empresa.razaoSocial || 'Empresa sem nome'}</span>. As
            alterações são salvas automaticamente.
          </>
        }
        actions={
          <Button variant="outline" icon={<FilePlus2 size={14} />} onClick={startNew}>
            Iniciar nova empresa
          </Button>
        }
      />

      {/* Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scroll-thin">
          {STEPS.map((label, i) => (
            <div key={label} className="flex shrink-0 items-center">
              <button onClick={() => setS(i)} className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    'num flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition',
                    i < s && 'bg-ok/15 text-ok',
                    i === s && 'bg-fg text-bg',
                    i > s && 'border border-line text-muted',
                  )}
                >
                  {i < s ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={clsx('hidden text-xs lg:block', i === s ? 'font-medium text-fg' : 'text-muted')}>{label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="mx-1 text-line" />}
            </div>
          ))}
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${((s + 1) / STEPS.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Etapa {s + 1} de {STEPS.length}: <span className="font-medium text-fg">{STEPS[s]}</span>
        </p>
      </div>

      <Card className="p-6">
        {s === 0 && (
          <>
            <StepTitle title="Dados da empresa" />
            <EmpresaForm />
          </>
        )}
        {s === 1 && (
          <>
            <StepTitle title="Receitas da empresa" description="Informe o faturamento mensal dos últimos 12 meses." />
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MESES.map((m, i) => (
                <MoneyInput
                  key={m}
                  label={m}
                  value={data.faturamento.meses[i]}
                  onChange={(v) => {
                    const meses = [...data.faturamento.meses];
                    meses[i] = v;
                    setFaturamento({ meses });
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-subtle p-4">
              {[
                ['RBT12', rbt12],
                ['Média mensal', media],
                ['Projeção anual', media * 12],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <p className="label-xs">{l}</p>
                  <p className="num mt-1 text-sm font-semibold">{money(v as number)}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {s === 2 && (
          <>
            <StepTitle title="Folha e encargos" description="Valores anuais." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FOLHA_FIELDS.map((f) => (
                <MoneyInput key={f.key} label={`${f.label} (anual)`} value={data.folha[f.key]} onChange={(v) => setFolha({ [f.key]: v })} />
              ))}
            </div>
            <div className="mt-4">
              <Alert tone="accent">
                Quando aplicável, o Fator R poderá influenciar o enquadramento entre os Anexos III e V do Simples Nacional.
              </Alert>
            </div>
          </>
        )}
        {s === 3 && (
          <>
            <StepTitle title="Custos operacionais" description="Valores anuais." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CUSTO_FIELDS.map((f) => (
                <MoneyInput key={f.key} label={`${f.label} (anual)`} value={data.custos[f.key]} onChange={(v) => setCustos({ [f.key]: v })} />
              ))}
            </div>
          </>
        )}
        {s === 4 && (
          <>
            <StepTitle title="Despesas administrativas" description="Valores anuais." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DESPESA_FIELDS.map((f) => (
                <MoneyInput key={f.key} label={`${f.label} (anual)`} value={data.custos[f.key]} onChange={(v) => setCustos({ [f.key]: v })} />
              ))}
            </div>
          </>
        )}
        {s === 5 && (
          <>
            <StepTitle
              title="Créditos tributários"
              description="Informe os valores anuais das bases de cálculo para aproveitamento de créditos de PIS/COFINS."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CREDITO_FIELDS.filter((f) => f.key !== 'outrosCreditos').map((f) => (
                <MoneyInput
                  key={f.key}
                  label={`${f.label} (anual)`}
                  value={data.creditos[f.key]}
                  onChange={(v) => setCreditos({ [f.key]: v })}
                />
              ))}
            </div>
          </>
        )}
        {s >= 6 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-lg font-semibold">
              {s === 6 ? 'Dados prontos para simulação' : s === 7 ? 'Comparativo gerado' : 'Diagnóstico concluído'}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {s === 6
                ? 'Todas as informações foram coletadas. Prossiga para ver as simulações e o comparativo dos regimes.'
                : s === 7
                  ? 'O comparativo entre os três regimes foi calculado com base nos dados informados.'
                  : 'O diagnóstico tributário está pronto. Visualize os resultados completos.'}
            </p>
            <div className="mt-5 flex justify-center">
              {s === 6 && <Button onClick={() => go('comparativo')}>Ver comparativo</Button>}
              {s === 7 && <Button onClick={() => go('diagnostico')}>Ver diagnóstico</Button>}
              {s === 8 && <Button onClick={() => go('relatorio')}>Gerar relatório</Button>}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex justify-between">
        <Button variant="outline" disabled={s === 0} onClick={() => setS(Math.max(0, s - 1))}>
          Voltar
        </Button>
        <Button icon={<Save size={14} />} onClick={next}>
          {s === STEPS.length - 1 ? 'Finalizar' : 'Salvar e continuar'}
        </Button>
      </div>
    </div>
  );
}
