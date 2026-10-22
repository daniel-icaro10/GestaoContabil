import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Lightbulb, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { kfmt, money, pct } from '../lib/format';
import { calcTodos, menorCarga, resumoRegimes, scaleData, soma } from '../lib/tax';
import { Button, Card, CardTitle, ChartTooltip, PageHeader, axisTick, clsx, gridStroke } from '../components/ui';

function Slider({ label, value, onChange, min = -50, max = 50 }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={clsx('num rounded-md px-1.5 py-0.5 text-xs font-medium', value > 0 ? 'bg-ok/10 text-ok' : value < 0 ? 'bg-danger/10 text-danger' : 'bg-subtle text-muted')}>
          {value > 0 ? '+' : ''}
          {value}%
        </span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} className="w-full" />
      <div className="num flex justify-between text-[10px] text-muted">
        <span>{min}%</span>
        <span>0</span>
        <span>+{max}%</span>
      </div>
    </div>
  );
}

export default function Cenarios() {
  const { data, results, taxConfig } = useApp();
  const [fat, setFat] = useState(0);
  const [folha, setFolha] = useState(0);
  const [custos, setCustos] = useState(0);
  const [creditos, setCreditos] = useState(0);
  const changed = fat !== 0 || folha !== 0 || custos !== 0 || creditos !== 0;

  const cenario = useMemo(() => {
    const scaled = scaleData(data, { fat, folha, custos, creditos });
    return { res: calcTodos(scaled, taxConfig), rbt12: soma(scaled.faturamento.meses) };
  }, [data, taxConfig, fat, folha, custos, creditos]);

  const orig = resumoRegimes(results);
  const novo = resumoRegimes(cenario.res);
  const melhor = menorCarga(novo);
  const chart = novo.map((r, i) => ({
    name: r.name.replace('Simples Nacional', 'Simples').replace('Lucro ', 'L. '),
    original: orig[i].anual,
    cenario: r.anual,
    fill: r.color,
  }));

  const insights: string[] = [];
  if (fat > 0) insights.push(`O aumento de ${fat}% no faturamento eleva a base de cálculo e pode alterar o enquadramento de faixa no Simples Nacional.`);
  if (fat < 0) insights.push(`A redução de ${Math.abs(fat)}% no faturamento pode resultar em alíquota efetiva menor no Simples Nacional.`);
  if (folha > 10) insights.push('O aumento da folha melhora o Fator R, favorecendo o enquadramento no Anexo III.');
  if (folha < -10) insights.push('A redução da folha pode diminuir o Fator R, resultando em enquadramento no Anexo V com alíquota maior.');
  if (custos < 0) insights.push('A redução de custos melhora a margem operacional, tornando o Lucro Real mais sensível.');
  if (creditos > 0) insights.push('O aumento dos créditos tributários reduz o PIS e COFINS líquidos no Lucro Real.');
  if (!insights.length) insights.push('Altere os parâmetros ao lado para simular diferentes cenários e ver o impacto nos regimes tributários.');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Simulador de cenários"
        description="Ajuste os parâmetros para explorar o impacto tributário de diferentes estruturas operacionais."
        actions={
          changed && (
            <Button
              variant="outline"
              icon={<RefreshCcw size={14} />}
              onClick={() => {
                setFat(0);
                setFolha(0);
                setCustos(0);
                setCreditos(0);
              }}
            >
              Resetar
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardTitle icon={<SlidersHorizontal size={14} />}>Parâmetros do cenário</CardTitle>
            <div className="space-y-6">
              <Slider label="Variação do faturamento" value={fat} onChange={setFat} />
              <Slider label="Variação da folha" value={folha} onChange={setFolha} />
              <Slider label="Variação de custos e despesas" value={custos} onChange={setCustos} />
              <Slider label="Variação dos créditos tributários" value={creditos} onChange={setCreditos} />
            </div>
          </Card>
          <Card>
            <p className="label-xs">Faturamento no cenário</p>
            <p className="num mt-2 text-xl font-semibold">{money(cenario.rbt12)}</p>
            <p className="num mt-1 text-xs text-muted">
              {money(results.simples.rbt12)} → {money(cenario.rbt12)}
            </p>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {novo.map((r, i) => {
              const diff = r.anual - orig[i].anual;
              return (
                <Card key={r.name} className={clsx(r.name === melhor.name && 'ring-1 ring-accent/40')}>
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </p>
                  <p className="num mt-3 text-lg font-semibold">{money(r.anual)}<span className="text-xs font-normal text-muted">/ano</span></p>
                  <p className="num text-xs text-muted">{pct(r.carga * 100)}</p>
                  {changed && (
                    <p className={clsx('num mt-2 text-xs font-medium', diff < 0 ? 'text-ok' : diff > 0 ? 'text-danger' : 'text-muted')}>
                      {Math.abs(diff) < 0.005 ? '—' : diff < 0 ? `▼ ${money(-diff)}` : `▲ +${money(diff)}`}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
          <Card>
            <CardTitle>{changed ? 'Original vs. cenário' : 'Tributos anuais por regime'}</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} barCategoryGap="30%" barGap={4} margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => money(v)} />} />
                {changed && <Bar dataKey="original" name="Original" fill="rgb(var(--line))" radius={[4, 4, 0, 0]} />}
                <Bar dataKey="cenario" name="Cenário" radius={[4, 4, 0, 0]}>
                  {chart.map((c) => (
                    <Cell key={c.name} fill={c.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardTitle icon={<Lightbulb size={14} />}>Impacto da alteração</CardTitle>
            <div className="space-y-2">
              {insights.map((t, i) => (
                <p key={i} className="rounded-lg bg-subtle px-3 py-2.5 text-sm leading-relaxed">
                  {t}
                </p>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
