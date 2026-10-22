import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { PALETTE } from '../lib/fields';
import { Card, CardTitle, ChartTooltip, KV, Legend, PageHeader, Stat } from '../components/ui';

export default function LucroPresumido() {
  const { results, data, taxConfig } = useApp();
  const t = results.presumido;
  const p = taxConfig.presumido;
  const rows = [
    { label: 'IRPJ', value: t.irpjMensal },
    { label: 'Adicional IRPJ', value: t.adicionalIrpjMensal },
    { label: 'CSLL', value: t.csllMensal },
    { label: 'PIS', value: t.pisMensal },
    { label: 'COFINS', value: t.cofinsMensal },
    { label: 'ISS', value: t.issEstimado },
    { label: 'ICMS', value: t.icmsEstimado },
    { label: 'INSS Patronal', value: t.inssPatronal },
  ]
    .filter((r) => r.value > 0)
    .map((r, i) => ({ ...r, anual: r.value * 12, fill: PALETTE[i] }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simulação"
        title="Lucro Presumido"
        description="Regime cumulativo de PIS/COFINS. IRPJ e CSLL calculados sobre a presunção legal de lucro."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total mensal estimado" value={money(t.totalMensal)} sub="Soma de todos os tributos" color="var(--c-presumido)" />
        <Stat label="Total anual estimado" value={money(t.totalAnual)} sub="Projeção para 12 meses" />
        <Stat label="Carga s/ faturamento" value={pct(t.cargaTributaria * 100)} sub={`Atividade: ${data.empresa.tipoAtividade}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-3">
          <div className="px-5 pt-5">
            <CardTitle>Detalhamento por tributo</CardTitle>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Tributo</th>
                  <th className="text-right">Mensal</th>
                  <th className="text-right">Anual</th>
                  <th className="text-right">% do total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-sm" style={{ background: r.fill }} />
                        {r.label}
                      </span>
                    </td>
                    <td className="num text-right">{money(r.value)}</td>
                    <td className="num text-right">{money(r.anual)}</td>
                    <td className="num text-right text-muted">{pct(t.totalAnual > 0 ? (r.anual / t.totalAnual) * 100 : 0)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>Total</td>
                  <td className="num text-right">{money(t.totalMensal)}</td>
                  <td className="num text-right">{money(t.totalAnual)}</td>
                  <td className="num text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Composição tributária</CardTitle>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={rows} dataKey="anual" nameKey="label" innerRadius={50} outerRadius={82} paddingAngle={2} stroke="none">
                  {rows.map((r) => (
                    <Cell key={r.label} fill={r.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <Legend items={rows.map((r) => ({ name: r.label, color: r.fill, value: money(r.anual) }))} />
          </Card>
          <Card>
            <CardTitle>Parâmetros utilizados</CardTitle>
            <KV label="Regime PIS/COFINS" value="Cumulativo" />
            <KV label="Alíquota PIS" value={pct(p.pis * 100)} />
            <KV label="Alíquota COFINS" value={pct(p.cofins * 100)} />
            <KV label="Alíquota IRPJ" value={pct(p.irpj * 100, 0)} />
            <KV label="Adicional IRPJ" value={`${pct(p.adicionalIrpj * 100, 0)} (acima de ${money(p.limiteAdicional)}/mês)`} />
            <KV label="Alíquota CSLL" value={pct(p.csll * 100, 0)} />
            <KV label="Presunção IRPJ" value={pct(t.presuncaoIrpj * 100, 0)} />
            <KV label="Presunção CSLL" value={pct(t.presuncaoCsll * 100, 0)} />
          </Card>
        </div>
      </div>
    </div>
  );
}
