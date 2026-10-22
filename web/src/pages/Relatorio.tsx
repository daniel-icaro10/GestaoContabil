import { useState, type ReactNode } from 'react';
import { CheckCircle2, Download, FileText, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MESES, money, pct } from '../lib/format';
import { montarDiagnostico } from '../lib/diagnostico';
import { Button, Card, Disclaimer, KV, PageHeader } from '../components/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line py-6 first:border-t-0">
      <h3 className="label-xs mb-4 !text-fg">{title}</h3>
      {children}
    </section>
  );
}

export default function Relatorio() {
  const { data, results, taxConfig } = useApp();
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const d = montarDiagnostico(data, results, taxConfig);
  const e = data.empresa;

  const gerar = () => {
    setState('loading');
    setTimeout(() => setState('ready'), 900);
  };

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Saída"
          title="Relatório do diagnóstico"
          description="Relatório completo com todas as análises e simulações tributárias."
          actions={
            <>
              <Button variant="outline" icon={<FileText size={14} />} onClick={gerar} loading={state === 'loading'}>
                {state === 'loading' ? 'Gerando...' : state === 'ready' ? 'Atualizar relatório' : 'Gerar relatório'}
              </Button>
              {state === 'ready' && (
                <Button icon={<Download size={14} />} onClick={() => window.print()}>
                  Exportar PDF
                </Button>
              )}
            </>
          }
        />
      </div>

      {state === 'idle' && (
        <Card className="no-print py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-subtle">
            <FileText size={24} className="text-muted" />
          </div>
          <h2 className="text-lg font-semibold">Pronto para gerar o relatório</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
            O relatório incluirá os dados da empresa, faturamento, folha, custos, resultado financeiro, simulações dos três
            regimes tributários, comparativo e diagnóstico completo.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            {['Dados da empresa', 'Simulações tributárias', 'Comparativo e diagnóstico'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-muted">
                <CheckCircle2 size={13} className="text-ok" /> {t}
              </span>
            ))}
          </div>
          <Button className="mt-6" onClick={gerar}>
            Gerar relatório
          </Button>
        </Card>
      )}

      {state === 'loading' && (
        <Card className="py-14 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-accent" />
          <h2 className="font-semibold">Gerando relatório...</h2>
          <p className="text-sm text-muted">Compilando dados e calculando simulações.</p>
        </Card>
      )}

      {state === 'ready' && (
        <Card className="mx-auto max-w-4xl p-8 print:border-0 print:p-0 sm:p-10">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="label-xs">Relatório</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Diagnóstico Tributário Empresarial</h2>
              <p className="mt-1 text-sm text-muted">
                {e.razaoSocial} — Período: {e.periodoAnalise}
              </p>
            </div>
            <p className="num text-right text-xs text-muted">
              Gerado em
              <br />
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </header>

          <Section title="1. Dados da empresa">
            <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              <div>
                <KV label="Razão social" value={e.razaoSocial} />
                <KV label="CNPJ" value={e.cnpj} />
                <KV label="Cidade / Estado" value={`${e.cidade} — ${e.estado}`} />
                <KV label="CNAE principal" value={e.cnaePrincipal} />
              </div>
              <div>
                <KV label="Tipo de atividade" value={e.tipoAtividade} />
                <KV label="Regime tributário atual" value={e.regimeAtual} />
                <KV label="Responsável" value={e.usuarioResponsavel} />
                <KV label="Período" value={e.periodoAnalise} />
              </div>
            </div>
          </Section>

          <Section title="2. Faturamento">
            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {MESES.map((m, i) => (
                <div key={m} className="rounded-md bg-subtle px-2.5 py-2">
                  <p className="text-[10px] text-muted">{m}</p>
                  <p className="num text-xs font-medium">{money(data.faturamento.meses[i])}</p>
                </div>
              ))}
            </div>
            <KV label="RBT12" value={money(d.receita)} />
            <KV label="Média mensal" value={money(d.receita / 12)} />
          </Section>

          <Section title="3. Folha de pagamento">
            <KV label="Total da folha" value={money(d.folha)} />
            <KV label="Folha / faturamento" value={pct(d.folhaRatio * 100)} />
            <KV label="Fator R" value={pct(d.fr * 100)} />
          </Section>

          <Section title="4. Resultado financeiro">
            <KV label="Receita total" value={money(d.res.receita)} />
            <KV label="(−) Custos" value={money(d.res.totalCustos)} />
            <KV label="(−) Despesas" value={money(d.res.totalDespesas)} />
            <KV label="(−) Folha" value={money(d.res.totalFolha)} />
            <KV strong label="= Resultado operacional" value={money(d.res.resultado)} />
            <KV label="Margem operacional" value={pct(d.res.margem * 100)} />
          </Section>

          <Section title="5. Simulações tributárias">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {d.regimes.map((r) => (
                <div key={r.name} className="rounded-lg border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </p>
                  <p className="num mt-2 text-lg font-semibold">{money(r.anual)}/ano</p>
                  <p className="num text-xs text-muted">{pct(r.carga * 100)}</p>
                  {r.name === d.melhor.name && <p className="mt-2 text-xs font-medium text-ok">✓ Menor carga estimada</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="6. Economia potencial">
            {d.economia > 0 && d.atual ? (
              <>
                <KV label={`Regime atual (${e.regimeAtual})`} value={`${money(d.atual.anual)}/ano`} />
                <KV label={`Cenário com menor carga (${d.melhor.name})`} value={`${money(d.melhor.anual)}/ano`} />
                <KV strong label="Economia estimada" value={`${money(d.economia)}/ano`} tone="rgb(var(--ok))" />
                <KV label="Equivalente mensal" value={money(d.economia / 12)} />
              </>
            ) : (
              <p className="text-sm text-muted">O regime atual já apresenta a menor carga tributária estimada.</p>
            )}
          </Section>

          <Section title="7. Diagnóstico">
            <ol className="mb-4 space-y-2 text-sm leading-relaxed">
              {d.conclusoes.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num text-muted">{i + 1}.</span>
                  {c}
                </li>
              ))}
            </ol>
            {d.pontos.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {d.pontos.map((p, i) => (
                  <li key={i} className="flex gap-2 text-muted">
                    <span>{p.tipo === 'alerta' ? '⚠' : p.tipo === 'ok' ? '✓' : 'ℹ'}</span>
                    {p.texto}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Disclaimer />
        </Card>
      )}
    </div>
  );
}
