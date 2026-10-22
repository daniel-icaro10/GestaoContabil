import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, CheckCircle2, DollarSign, Info, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MESES_CURTOS, kfmt, money, pct } from '../lib/format';
import { fatorR, mediaMensal, menorCarga, resultadoOperacional, resumoRegimes, soma, totalFolha } from '../lib/tax';
import { Card, CardTitle, ChartTooltip, Disclaimer, KV, Stat, axisTick, gridStroke, clsx } from '../components/ui';

export default function Dashboard() {
  const { data, results, taxConfig } = useApp();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { empresa: c, faturamento, folha, custos } = data;
  const res = resultadoOperacional(faturamento, custos, folha);
  const fr = fatorR(folha, faturamento);
  const receita = soma(faturamento.meses);
  const media = mediaMensal(faturamento.meses);
  const folhaTotal = totalFolha(folha);
  const regimes = resumoRegimes(results);
  const melhor = menorCarga(regimes);
  const atual = regimes.find((r) => r.name === c.regimeAtual);
  const economia = atual ? atual.anual - melhor.anual : 0;
  const serie = faturamento.meses.map((v, i) => ({ mes: MESES_CURTOS[i], valor: v }));
  const barras = regimes.map((r) => ({
    name: r.name.replace('Simples Nacional', 'Simples').replace('Lucro ', 'L. '),
    valor: r.anual,
    fill: r.color,
  }));
  const h1 = soma(faturamento.meses.slice(0, 6));
  const h2 = soma(faturamento.meses.slice(6));
  const trendFat = h1 > 0 ? ((h2 - h1) / h1) * 100 : undefined;

  const alertas = [
    fr < taxConfig.fatorRLimite && {
      tone: 'warn',
      text: 'Fator R abaixo de 28% — enquadramento no Anexo V para atividades de serviço.',
    },
    receita > taxConfig.simplesLimite * 0.9 && {
      tone: 'danger',
      text: `Faturamento próximo ao limite do Simples Nacional (${money(taxConfig.simplesLimite)}).`,
    },
    res.margem < 0.08 && {
      tone: 'warn',
      text: 'Margem operacional estimada abaixo de 8% — verificar impacto do Lucro Real.',
    },
    { tone: 'info', text: `Verifique benefícios fiscais e regras específicas do CNAE ${c.cnaePrincipal || 'principal'}.` },
  ].filter(Boolean) as { tone: string; text: string }[];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="bg-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div className="max-w-xl">
            <p className="label-xs mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Diagnóstico Tributário
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.nomeFantasia || c.razaoSocial || 'Nova empresa'}</h1>
            <p className="mt-2 text-sm text-muted">
              Compare regimes tributários e identifique oportunidades de redução da carga tributária.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[c.tipoAtividade, `Regime atual: ${c.regimeAtual}`, c.cidade ? `${c.cidade} — ${c.estado}` : c.estado].map((t) => (
                <span key={t} className="rounded-full border border-line bg-surface/70 px-3 py-1 text-xs backdrop-blur">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="label-xs">Menor carga estimada</p>
            <p className="mt-1 text-sm font-medium" style={{ color: melhor.color }}>
              {melhor.name}
            </p>
            <p className="num text-3xl font-semibold">{pct(melhor.carga * 100)}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Faturamento anual"
          value={money(receita)}
          sub={`Média ${money(media)}/mês`}
          icon={<DollarSign size={16} />}
          trend={trendFat}
        />
        <Stat
          label="Margem líquida"
          value={pct(res.margem * 100)}
          sub={`Resultado ${money(res.resultado)}`}
          icon={<TrendingUp size={16} />}
          color={res.margem >= 0 ? 'rgb(var(--ok))' : 'rgb(var(--danger))'}
        />
        <Stat
          label="Folha / faturamento"
          value={pct(receita > 0 ? (folhaTotal / receita) * 100 : 0)}
          sub={`Total folha ${money(folhaTotal)}`}
          icon={<Users size={16} />}
        />
        <Stat
          label="Fator R"
          value={pct(fr * 100)}
          sub={fr >= taxConfig.fatorRLimite ? 'Acima do limite (≥28%)' : 'Abaixo do limite (<28%)'}
          icon={<Target size={16} />}
          color={fr >= taxConfig.fatorRLimite ? 'rgb(var(--ok))' : 'rgb(var(--warn))'}
        />
      </div>

      {/* Comparativo */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Comparativo tributário</h2>
          {can('comparativo') && (
            <button onClick={() => navigate('/comparativo')} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
              Ver detalhes <ArrowRight size={12} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {regimes.map((r) => {
            const best = r.name === melhor.name;
            return (
              <button
                key={r.name}
                disabled={!can(r.page as any)}
                onClick={() => navigate(`/${r.page}`)}
                className={clsx(
                  'group relative rounded-xl border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none',
                  best ? 'border-transparent ring-1' : 'border-line',
                )}
                style={best ? ({ '--tw-ring-color': r.color, boxShadow: `0 8px 30px -12px ${r.color}` } as any) : undefined}
              >
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-sm font-medium">{r.name}</span>
                  {best && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-medium" style={{ color: r.color }}>
                      <CheckCircle2 size={12} /> Menor carga
                    </span>
                  )}
                </div>
                <p className="label-xs">Carga estimada</p>
                <p className="num mt-1 text-3xl font-semibold" style={{ color: r.color }}>
                  {pct(r.carga * 100)}
                </p>
                <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                  <div>
                    <p className="text-[11px] text-muted">Tributos anuais</p>
                    <p className="num text-sm font-medium">{money(r.anual)}</p>
                  </div>
                  <p className="num text-[11px] text-muted">{money(r.mensal)}/mês</p>
                </div>
                <span className="mt-3 flex items-center gap-1 text-xs text-muted transition group-hover:text-fg">
                  Ver simulação <ArrowRight size={11} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Evolução do faturamento</CardTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={serie} margin={{ left: -10, right: 4 }}>
              <defs>
                <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
              <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              <Area
                type="monotone"
                dataKey="valor"
                name="Faturamento"
                stroke="rgb(var(--accent))"
                strokeWidth={2}
                fill="url(#gFat)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardTitle>Tributação anual por regime</CardTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barras} barCategoryGap="38%" margin={{ left: -10, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
              <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => money(v)} />} />
              <Bar dataKey="valor" name="Tributos" radius={[6, 6, 0, 0]}>
                {barras.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Economia */}
      <Card className="border-ok/25 bg-ok/[0.04]">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ok/10 text-ok">
            <TrendingDown size={18} />
          </div>
          <div className="min-w-[200px] flex-1">
            <h3 className="text-sm font-semibold">Economia tributária potencial</h3>
            {!atual || economia <= 0 ? (
              <p className="text-sm text-muted">O regime atual ({c.regimeAtual}) já apresenta a menor carga estimada.</p>
            ) : (
              <p className="text-sm text-muted">
                Regime atual ({c.regimeAtual}) <span className="num text-fg">{money(atual.anual)}/ano</span> → cenário com menor
                carga ({melhor.name}) <span className="num text-fg">{money(melhor.anual)}/ano</span>
              </p>
            )}
          </div>
          {atual && economia > 0 && (
            <div className="text-right">
              <p className="label-xs">Economia estimada</p>
              <p className="num text-2xl font-semibold text-ok">{money(economia)}/ano</p>
              <p className="num text-xs text-muted">{money(economia / 12)}/mês</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<AlertTriangle size={14} />}>Pontos de atenção</CardTitle>
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={clsx(
                  'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed',
                  a.tone === 'danger' ? 'bg-danger/[0.07]' : a.tone === 'warn' ? 'bg-warn/[0.08]' : 'bg-subtle',
                )}
              >
                {a.tone === 'info' ? (
                  <Info size={13} className="mt-0.5 shrink-0 text-muted" />
                ) : (
                  <AlertTriangle size={13} className={clsx('mt-0.5 shrink-0', a.tone === 'danger' ? 'text-danger' : 'text-warn')} />
                )}
                {a.text}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle icon={<Info size={14} />}>Resumo financeiro</CardTitle>
          <KV label="Receita total" value={money(res.receita)} />
          <KV label="Total de custos" value={`(${money(res.totalCustos)})`} tone="rgb(var(--danger))" />
          <KV label="Total de despesas" value={`(${money(res.totalDespesas)})`} tone="rgb(var(--warn))" />
          <KV label="Folha de pagamento" value={`(${money(res.totalFolha)})`} />
          <KV
            label="Resultado operacional"
            value={money(res.resultado)}
            tone={res.resultado >= 0 ? 'rgb(var(--ok))' : 'rgb(var(--danger))'}
          />
          <KV
            strong
            label="Margem estimada"
            value={pct(res.margem * 100)}
            tone={res.margem >= 0.1 ? 'rgb(var(--ok))' : 'rgb(var(--warn))'}
          />
        </Card>
      </div>

      <Disclaimer />
    </div>
  );
}
