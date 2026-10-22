import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CheckCircle2, Sparkles, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { kfmt, money, pct } from '../lib/format';
import { calcReforma, menorCarga, resumoRegimes } from '../lib/tax';
import { Badge, Card, CardTitle, ChartTooltip, Disclaimer, KV, PageHeader, axisTick, clsx, gridStroke } from '../components/ui';

export default function Comparativo() {
  const { results, data, taxConfig } = useApp();
  const { can } = useAuth();
  const navigate = useNavigate();
  const regimes = resumoRegimes(results);
  const melhor = menorCarga(regimes);
  const atual = regimes.find((r) => r.name === data.empresa.regimeAtual);
  const economia = atual ? atual.anual - melhor.anual : 0;
  const chart = regimes.map((r) => ({
    name: r.name.replace('Simples Nacional', 'Simples').replace('Lucro ', 'L. '),
    anual: r.anual,
    carga: r.carga * 100,
    fill: r.color,
  }));
  const reforma = taxConfig.reforma.habilitada ? calcReforma(data, taxConfig) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Comparativo dos regimes tributários"
        description="Análise estimativa dos três regimes com base nos dados financeiros informados."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {regimes.map((r) => {
          const best = r.name === melhor.name;
          const isAtual = r.name === data.empresa.regimeAtual;
          return (
            <button
              key={r.name}
              disabled={!can(r.page as any)}
              onClick={() => navigate(`/${r.page}`)}
              className={clsx(
                'group rounded-xl border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none',
                best ? 'border-transparent ring-1' : 'border-line',
              )}
              style={best ? ({ '--tw-ring-color': r.color } as any) : undefined}
            >
              <div className="mb-3 flex min-h-[22px] flex-wrap items-center gap-2">
                {best && (
                  <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: r.color }}>
                    <CheckCircle2 size={12} /> Menor carga tributária estimada
                  </span>
                )}
                {isAtual && <Badge>Regime atual</Badge>}
              </div>
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.name}
              </h3>
              <p className="label-xs mt-4">Carga tributária</p>
              <p className="num text-3xl font-semibold" style={{ color: r.color }}>
                {pct(r.carga * 100)}
              </p>
              <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Mensal estimado</span>
                  <span className="num">{money(r.mensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Anual estimado</span>
                  <span className="num font-medium">{money(r.anual)}</span>
                </div>
                {!best && (
                  <div className="flex justify-between">
                    <span className="text-muted">Diferença vs. menor</span>
                    <span className="num text-danger">+{money(r.anual - melhor.anual)}</span>
                  </div>
                )}
              </div>
              <span className="mt-3 flex items-center gap-1 text-xs text-muted group-hover:text-fg">
                Ver simulação <ArrowRight size={11} />
              </span>
            </button>
          );
        })}
      </div>

      {economia > 0 && atual && (
        <Card className="border-ok/25 bg-ok/[0.04]">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ok/10 text-ok">
              <TrendingDown size={22} />
            </div>
            <div className="min-w-[220px] flex-1">
              <h3 className="text-sm font-semibold">Economia tributária potencial</h3>
              <p className="text-sm text-muted">
                Comparando o regime atual ({data.empresa.regimeAtual}) com o cenário de menor carga ({melhor.name}).
              </p>
            </div>
            <div className="text-right">
              <p className="num text-2xl font-semibold text-ok">{money(economia)}</p>
              <p className="text-xs text-muted">por ano estimado · {money(economia / 12)}/mês</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Tributação anual estimada (R$)</CardTitle>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chart} barCategoryGap="38%" margin={{ left: -10, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
              <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => money(v)} />} />
              <Bar dataKey="anual" name="Tributos anuais" radius={[6, 6, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={c.name} fill={c.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardTitle>Carga tributária percentual</CardTitle>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chart} barCategoryGap="38%" margin={{ left: -10, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => pct(v)} />} />
              <Bar dataKey="carga" name="Carga tributária" radius={[6, 6, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={c.name} fill={c.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardTitle>Tabela comparativa</CardTitle>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Regime</th>
                <th className="text-right">Mensal est.</th>
                <th className="text-right">Anual est.</th>
                <th className="text-right">Carga tributária</th>
                <th className="text-right">Dif. vs. regime atual</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {regimes.map((r) => {
                const isAtual = r.name === data.empresa.regimeAtual;
                const diff = atual ? r.anual - atual.anual : 0;
                return (
                  <tr key={r.name}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                        {isAtual && <Badge>Atual</Badge>}
                      </span>
                    </td>
                    <td className="num text-right">{money(r.mensal)}</td>
                    <td className="num text-right">{money(r.anual)}</td>
                    <td className="num text-right">{pct(r.carga * 100)}</td>
                    <td className={clsx('num text-right', !isAtual && (diff >= 0 ? 'text-danger' : 'text-ok'))}>
                      {isAtual ? '—' : diff >= 0 ? `+${money(diff)}` : `(${money(-diff)})`}
                    </td>
                    <td className="w-8">{r.name === melhor.name && <CheckCircle2 size={14} className="text-ok" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {reforma && (
        <Card className="border-accent/25">
          <CardTitle icon={<Sparkles size={14} />} right={<Badge tone="accent">{taxConfig.reforma.regime}</Badge>}>
            Reforma Tributária — estimativa de referência (CBS + IBS)
          </CardTitle>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div>
              <KV label="Alíquota combinada CBS + IBS" value={pct(reforma.aliquota * 100)} />
              <KV label="Débito sobre o faturamento" value={money(reforma.debito)} />
              <KV label="(−) Créditos sobre aquisições" value={`(${money(reforma.credito)})`} tone="rgb(var(--ok))" />
            </div>
            <div>
              <KV label="Imposto Seletivo" value={money(reforma.seletivo)} />
              <KV strong label="Tributo sobre consumo (anual)" value={money(reforma.liquido)} tone="rgb(var(--accent))" />
              <KV label="Carga sobre faturamento" value={pct(reforma.carga * 100)} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Considera apenas os tributos sobre consumo que substituirão PIS, COFINS, ICMS e ISS. Alíquotas em regulamentação —
            ajuste em Configurações.
          </p>
        </Card>
      )}

      <Disclaimer short />
    </div>
  );
}
