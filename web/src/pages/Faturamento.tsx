import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MESES, MESES_CURTOS, kfmt, money, pct } from '../lib/format';
import { mediaMensal, soma } from '../lib/tax';
import { Card, CardTitle, ChartTooltip, MoneyInput, PageHeader, Progress, Stat, axisTick, gridStroke } from '../components/ui';

export default function Faturamento() {
  const { data, setFaturamento, taxConfig } = useApp();
  const meses = data.faturamento.meses;
  const rbt12 = soma(meses);
  const media = mediaMensal(meses);
  const serie = meses.map((v, i) => ({ mes: MESES_CURTOS[i], valor: v }));
  const positivos = meses.filter((v) => v > 0);
  const maior = positivos.length ? Math.max(...positivos) : 0;
  const menor = positivos.length ? Math.min(...positivos) : 0;
  const uso = (rbt12 / taxConfig.simplesLimite) * 100;

  const setMes = (i: number, v: number) => {
    const next = [...meses];
    next[i] = v;
    setFaturamento({ meses: next });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dados financeiros"
        title="Receitas da empresa"
        description="Informe o faturamento mensal para calcular o RBT12 e as simulações tributárias."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="RBT12 (receita 12 meses)" value={money(rbt12)} color="rgb(var(--accent))" />
        <Stat label="Média mensal" value={money(media)} />
        <Stat label="Projeção anual" value={money(media * 12)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle icon={<TrendingUp size={14} />}>Faturamento por mês</CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MESES.map((m, i) => (
              <MoneyInput key={m} label={m} value={meses[i]} onChange={(v) => setMes(i, v)} />
            ))}
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Evolução do faturamento</CardTitle>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={serie} margin={{ left: -14, right: 4 }}>
                <defs>
                  <linearGradient id="gFat2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
                <Area type="monotone" dataKey="valor" name="Faturamento" stroke="rgb(var(--accent))" strokeWidth={2} fill="url(#gFat2)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardTitle>Distribuição mensal</CardTitle>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={serie} barCategoryGap="25%" margin={{ left: -14, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => money(v)} />} />
                <Bar dataKey="valor" name="Faturamento" fill="rgb(var(--accent))" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-xs">Maior mês</p>
              <p className="num mt-1 text-lg font-semibold text-ok">{money(maior)}</p>
            </div>
            <div>
              <p className="label-xs">Menor mês</p>
              <p className="num mt-1 text-lg font-semibold text-danger">{money(menor)}</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">Limite do Simples Nacional — {money(taxConfig.simplesLimite)}</span>
          <span className="num font-medium">{pct(uso)} utilizado</span>
        </div>
        <Progress value={uso} color={uso > 90 ? 'rgb(var(--danger))' : uso > 70 ? 'rgb(var(--warn))' : 'rgb(var(--ok))'} />
      </Card>
    </div>
  );
}
