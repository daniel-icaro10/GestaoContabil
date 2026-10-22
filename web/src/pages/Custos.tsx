import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';
import { kfmt, money, pct } from '../lib/format';
import { resultadoOperacional } from '../lib/tax';
import { CUSTO_FIELDS, DESPESA_FIELDS } from '../lib/fields';
import { Card, CardTitle, ChartTooltip, Legend, MoneyInput, PageHeader, axisTick, gridStroke } from '../components/ui';

const C = {
  receita: 'rgb(var(--accent))',
  custos: '#f43f5e',
  despesas: '#f59e0b',
  folha: '#8b5cf6',
  resultado: '#10b981',
};

export default function Custos() {
  const { data, setCustos } = useApp();
  const r = resultadoOperacional(data.faturamento, data.custos, data.folha);
  const pie = [
    { name: 'Custos', value: r.totalCustos, fill: C.custos },
    { name: 'Despesas', value: r.totalDespesas, fill: C.despesas },
    { name: 'Folha', value: r.totalFolha, fill: C.folha },
    { name: 'Resultado', value: Math.max(0, r.resultado), fill: C.resultado },
  ].filter((p) => p.value > 0);
  const bars = [
    { name: 'Receita', valor: r.receita, fill: C.receita },
    { name: 'Custos', valor: r.totalCustos, fill: C.custos },
    { name: 'Despesas', valor: r.totalDespesas, fill: C.despesas },
    { name: 'Folha', valor: r.totalFolha, fill: C.folha },
    { name: 'Resultado', valor: Math.max(0, r.resultado), fill: C.resultado },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dados financeiros" title="Custos e despesas" description="Informe valores anuais para cálculo do resultado operacional." />

      <Card>
        <CardTitle>Resultado financeiro estimado</CardTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: 'Receita', value: r.receita, color: C.receita },
            { label: '(−) Custos', value: r.totalCustos, color: C.custos },
            { label: '(−) Despesas', value: r.totalDespesas, color: C.despesas },
            { label: '(−) Folha', value: r.totalFolha, color: C.folha },
            { label: '= Resultado', value: r.resultado, color: r.resultado >= 0 ? C.resultado : C.custos },
          ].map((i) => (
            <div key={i.label} className="rounded-lg border border-line p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.color }} />
                {i.label}
              </p>
              <p className="num mt-1.5 text-base font-semibold">{money(i.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-subtle px-4 py-2.5 text-sm">
          <span className="text-muted">Margem operacional estimada</span>
          <span className="num font-semibold" style={{ color: r.margem >= 0 ? C.resultado : C.custos }}>
            {pct(r.margem * 100)}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardTitle>Custos operacionais (anual)</CardTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CUSTO_FIELDS.map((f) => (
                <MoneyInput key={f.key} label={f.label} value={data.custos[f.key]} onChange={(v) => setCustos({ [f.key]: v })} />
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm font-semibold">
              <span>Total custos</span>
              <span className="num">{money(r.totalCustos)}</span>
            </div>
          </Card>
          <Card>
            <CardTitle>Despesas (anual)</CardTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DESPESA_FIELDS.map((f) => (
                <MoneyInput key={f.key} label={f.label} value={data.custos[f.key]} onChange={(v) => setCustos({ [f.key]: v })} />
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm font-semibold">
              <span>Total despesas</span>
              <span className="num">{money(r.totalDespesas)}</span>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle>Composição do resultado</CardTitle>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={58} outerRadius={90} paddingAngle={2} stroke="none">
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <Legend
              items={pie.map((p) => ({
                name: p.name,
                color: p.fill,
                value: `${money(p.value)} (${pct(r.receita > 0 ? (p.value / r.receita) * 100 : 0)})`,
              }))}
            />
          </Card>
          <Card>
            <CardTitle>Receita × custos × resultado</CardTitle>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={bars} barCategoryGap="30%" margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => money(v)} />} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {bars.map((b) => (
                    <Cell key={b.name} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
