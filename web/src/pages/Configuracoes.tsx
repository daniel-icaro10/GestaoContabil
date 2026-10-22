import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCcw, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_TAX_CONFIG, type AnexoNome, type TaxConfig } from '../lib/tax';
import { Alert, Button, Card, Field, PageHeader, PercentInput, Toggle, clsx, useToast } from '../components/ui';

function Section({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card padded={false}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="text-sm font-medium">{title}</span>
        <ChevronDown size={15} className={clsx('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line px-5 py-5">{children}</div>}
    </Card>
  );
}

function NumberCell({ value, onChange, decimals = 2 }: { value: number; onChange(v: number): void; decimals?: number }) {
  const [text, setText] = useState(value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  useEffect(() => {
    setText(value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }, [value, decimals]);
  return (
    <input
      className="input num py-1.5 text-right"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = parseFloat(text.replace(/\./g, '').replace(',', '.'));
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="label-xs mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function Configuracoes() {
  const app = useApp();
  const toast = useToast();
  const [cfg, setCfg] = useState<TaxConfig>(() => structuredClone(app.taxConfig));
  const [saving, setSaving] = useState(false);
  useEffect(() => setCfg(structuredClone(app.taxConfig)), [app.taxConfig]);

  const set = <K extends keyof TaxConfig>(k: K, v: TaxConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setFaixa = (anexo: AnexoNome, i: number, field: 'limite' | 'aliquota' | 'deducao', v: number) =>
    setCfg((c) => {
      const next = structuredClone(c);
      next.simples[anexo].faixas[i][field] = v;
      return next;
    });

  const dirty = JSON.stringify(cfg) !== JSON.stringify(app.taxConfig);

  const save = async (value: TaxConfig | null, msg: string) => {
    setSaving(true);
    try {
      await app.saveTaxConfig(value);
      toast(msg);
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações tributárias"
        description="Personalize as tabelas e alíquotas utilizadas nas simulações. Os valores são aplicados a todas as suas análises."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCcw size={14} />} onClick={() => save(null, 'Padrões restaurados.')} disabled={saving}>
              Restaurar padrões
            </Button>
            <Button icon={<Save size={14} />} onClick={() => save(cfg, 'Configurações salvas com sucesso.')} loading={saving} disabled={!dirty}>
              Salvar
            </Button>
          </>
        }
      />

      {dirty && <Alert tone="warn">Há alterações não salvas. As simulações usam os valores salvos.</Alert>}

      {(Object.keys(cfg.simples) as AnexoNome[]).map((anexo) => (
        <Section key={anexo} title={`Simples Nacional — ${anexo}`}>
          <p className="mb-3 text-xs text-muted">{cfg.simples[anexo].descricao}</p>
          <div className="overflow-x-auto scroll-thin">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Faixa</th>
                  <th className="text-right">Limite RBT12 (R$)</th>
                  <th className="text-right">Alíquota nominal (%)</th>
                  <th className="text-right">Parcela a deduzir (R$)</th>
                </tr>
              </thead>
              <tbody>
                {cfg.simples[anexo].faixas.map((f, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}ª</td>
                    <td className="w-48">
                      <NumberCell value={f.limite} onChange={(v) => setFaixa(anexo, i, 'limite', v)} />
                    </td>
                    <td className="w-40">
                      <NumberCell value={f.aliquota * 100} onChange={(v) => setFaixa(anexo, i, 'aliquota', v / 100)} />
                    </td>
                    <td className="w-48">
                      <NumberCell value={f.deducao} onChange={(v) => setFaixa(anexo, i, 'deducao', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}

      <Section title="Simples Nacional — Parâmetros gerais">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Limite de faturamento (R$)">
            <NumberCell value={cfg.simplesLimite} onChange={(v) => set('simplesLimite', v)} />
          </Field>
          <PercentInput label="Limite do Fator R (Anexo III × V)" value={cfg.fatorRLimite} onChange={(v) => set('fatorRLimite', v)} />
        </div>
      </Section>

      <Section title="Lucro Presumido — Alíquotas e presunção">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Group title="Tributação federal">
            <PercentInput label="IRPJ" value={cfg.presumido.irpj} onChange={(v) => set('presumido', { ...cfg.presumido, irpj: v })} />
            <PercentInput
              label="Adicional IRPJ"
              tip="Sobre lucro acima do limite"
              value={cfg.presumido.adicionalIrpj}
              onChange={(v) => set('presumido', { ...cfg.presumido, adicionalIrpj: v })}
            />
            <Field label="Limite mensal do adicional (R$)">
              <NumberCell value={cfg.presumido.limiteAdicional} onChange={(v) => set('presumido', { ...cfg.presumido, limiteAdicional: v })} />
            </Field>
            <PercentInput label="CSLL" value={cfg.presumido.csll} onChange={(v) => set('presumido', { ...cfg.presumido, csll: v })} />
          </Group>
          <Group title="PIS / COFINS (cumulativo)">
            <PercentInput label="PIS" value={cfg.presumido.pis} onChange={(v) => set('presumido', { ...cfg.presumido, pis: v })} />
            <PercentInput label="COFINS" value={cfg.presumido.cofins} onChange={(v) => set('presumido', { ...cfg.presumido, cofins: v })} />
          </Group>
          <Group title="Percentuais de presunção (IRPJ / CSLL)">
            {(['comercio', 'servicos', 'industria', 'outros'] as const).map((k) => (
              <div key={k} className="grid grid-cols-2 gap-2">
                <PercentInput
                  label={`${{ comercio: 'Comércio', servicos: 'Serviços', industria: 'Indústria', outros: 'Mistas' }[k]} — IRPJ`}
                  value={cfg.presuncaoIrpj[k]}
                  onChange={(v) => set('presuncaoIrpj', { ...cfg.presuncaoIrpj, [k]: v })}
                />
                <PercentInput
                  label="CSLL"
                  value={cfg.presuncaoCsll[k]}
                  onChange={(v) => set('presuncaoCsll', { ...cfg.presuncaoCsll, [k]: v })}
                />
              </div>
            ))}
          </Group>
        </div>
      </Section>

      <Section title="Lucro Real — Alíquotas">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Group title="Tributação federal">
            <PercentInput label="IRPJ" value={cfg.real.irpj} onChange={(v) => set('real', { ...cfg.real, irpj: v })} />
            <PercentInput label="Adicional IRPJ" value={cfg.real.adicionalIrpj} onChange={(v) => set('real', { ...cfg.real, adicionalIrpj: v })} />
            <Field label="Limite mensal do adicional (R$)">
              <NumberCell value={cfg.real.limiteAdicional} onChange={(v) => set('real', { ...cfg.real, limiteAdicional: v })} />
            </Field>
            <PercentInput label="CSLL" value={cfg.real.csll} onChange={(v) => set('real', { ...cfg.real, csll: v })} />
          </Group>
          <Group title="PIS / COFINS (não-cumulativo)">
            <PercentInput label="PIS" value={cfg.real.pis} onChange={(v) => set('real', { ...cfg.real, pis: v })} />
            <PercentInput label="COFINS" value={cfg.real.cofins} onChange={(v) => set('real', { ...cfg.real, cofins: v })} />
          </Group>
        </div>
      </Section>

      <Section title="ISS / ICMS / INSS — Parâmetros">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Group title="ISS">
            <PercentInput label="Alíquota mínima" value={cfg.iss.minimo} onChange={(v) => set('iss', { ...cfg.iss, minimo: v })} />
            <PercentInput label="Alíquota padrão" tip="Usada nas simulações" value={cfg.iss.padrao} onChange={(v) => set('iss', { ...cfg.iss, padrao: v })} />
            <PercentInput label="Alíquota máxima" value={cfg.iss.maximo} onChange={(v) => set('iss', { ...cfg.iss, maximo: v })} />
          </Group>
          <Group title="ICMS">
            <PercentInput label="Alíquota estimada padrão" tip="Varia por estado e produto" value={cfg.icmsPadrao} onChange={(v) => set('icmsPadrao', v)} />
          </Group>
          <Group title="INSS">
            <PercentInput label="INSS patronal (CPP)" tip="Sobre salários e pró-labore" value={cfg.inssPatronal} onChange={(v) => set('inssPatronal', v)} />
          </Group>
        </div>
      </Section>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Reforma Tributária</h3>
            <p className="text-sm text-muted">Habilitar simulações com as regras da Reforma Tributária (CBS, IBS, IS)</p>
          </div>
          <Toggle checked={cfg.reforma.habilitada} onChange={(v) => set('reforma', { ...cfg.reforma, habilitada: v })} label="Reforma Tributária" />
        </div>
        {cfg.reforma.habilitada && (
          <div className="mt-5 space-y-4 border-t border-line pt-5">
            <Alert tone="warn">
              As alíquotas da Reforma Tributária ainda estão em processo de regulamentação. Utilize os campos abaixo para inserir as
              alíquotas assim que definidas.
            </Alert>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PercentInput label="CBS (Contribuição sobre Bens e Serviços)" tip="Referência inicial — sujeita a alteração" value={cfg.reforma.cbs} onChange={(v) => set('reforma', { ...cfg.reforma, cbs: v })} />
              <PercentInput label="IBS (Imposto sobre Bens e Serviços)" tip="Referência inicial — sujeita a alteração" value={cfg.reforma.ibs} onChange={(v) => set('reforma', { ...cfg.reforma, ibs: v })} />
              <PercentInput label="Imposto Seletivo" tip="Varia por produto/setor" value={cfg.reforma.seletivo} onChange={(v) => set('reforma', { ...cfg.reforma, seletivo: v })} />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Simples Nacional padrão', 'Simples Nacional Híbrido', 'Regime Regular'].map((r) => (
                <button
                  key={r}
                  onClick={() => set('reforma', { ...cfg.reforma, regime: r })}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-sm transition',
                    cfg.reforma.regime === r ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-fg',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Com a reforma habilitada, a tela Comparativo exibe uma estimativa de CBS + IBS.</p>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted">
        Valores padrão baseados na LC 123/2006 (Simples Nacional) e legislação federal vigente.{' '}
        {JSON.stringify(cfg) === JSON.stringify(DEFAULT_TAX_CONFIG) ? 'Você está usando os valores padrão.' : 'Você está usando valores personalizados.'}
      </p>
    </div>
  );
}
