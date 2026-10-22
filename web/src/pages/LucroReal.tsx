import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { PALETTE } from '../lib/fields';
import { resultadoOperacional } from '../lib/tax';
import { Card, CardTitle, ChartTooltip, KV, Legend, PageHeader, Stat, clsx } from '../components/ui';

export default function LucroReal() {
  const { results, data, taxConfig } = useApp();
  const t = results.real;
  const r = taxConfig.real;
  const res = resultadoOperacional(data.faturamento, data.custos, data.folha);

  const rows = [
    { label: 'IRPJ', value: t.irpjMensal },
    { label: 'Adicional IRPJ', value: t.adicionalIrpjMensal },
    { label: 'CSLL', value: t.csllMensal },
    { label: 'PIS (bruto)', value: t.pisMensal, kind: 'bruto' },
    { label: 'COFINS (bruto)', value: t.cofinsMensal, kind: 'bruto' },
    { label: '(−) Créditos PIS', value: -t.creditosPis, kind: 'credito' },
    { label: '(−) Créditos COFINS', value: -t.creditosCofins, kind: 'credito' },
    { label: 'PIS líquido', value: t.pisLiquido, kind: 'liquido' },
    { label: 'COFINS líquido', value: t.cofinsLiquido, kind: 'liquido' },
    { label: 'ISS', value: t.issEstimado },
    { label: 'ICMS', value: t.icmsEstimado },
    { label: 'INSS Patronal', value: t.inssPatronal },
  ];

  const pie = [
    { name: 'IRPJ + Ad.', value: (t.irpjMensal + t.adicionalIrpjMensal) * 12 },
    { name: 'CSLL', value: t.csllMensal * 12 },
    { name: 'PIS líquido', value: t.pisLiquido * 12 },
    { name: 'COFINS líquido', value: t.cofinsLiquido * 12 },
    { name: 'ISS', value: t.issEstimado * 12 },
    { name: 'ICMS', value: t.icmsEstimado * 12 },
    { name: 'INSS Patronal', value: t.inssPatronal * 12 },
  ]
    .map((p, i) => ({ ...p, fill: PALETTE[i] }))
    .filter((p) => p.value > 0);

  const fmt = (v: number) => (v < 0 ? `(${money(-v)})` : money(v));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simulação"
        title="Lucro Real"
        description="Regime não-cumulativo de PIS/COFINS com aproveitamento de créditos. IRPJ e CSLL sobre o lucro efetivo."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Lucro operacional est."
          value={money(res.resultado)}
          color={res.resultado >= 0 ? 'rgb(var(--ok))' : 'rgb(var(--danger))'}
        />
        <Stat label="Tributos mensais" value={money(t.totalMensal)} color="var(--c-real)" />
        <Stat label="Tributos anuais" value={money(t.totalAnual)} />
        <Stat label="Carga tributária" value={pct(t.cargaTributaria * 100)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Créditos de PIS (anual)', value: t.creditosPis * 12, tone: 'text-ok' },
          { label: 'Créditos de COFINS (anual)', value: t.creditosCofins * 12, tone: 'text-ok' },
          { label: 'PIS + COFINS líquido (anual)', value: (t.pisLiquido + t.cofinsLiquido) * 12, tone: '' },
        ].map((i) => (
          <Card key={i.label} className="flex items-center justify-between">
            <span className="text-sm text-muted">{i.label}</span>
            <span className={clsx('num font-semibold', i.tone)}>{money(i.value)}</span>
          </Card>
        ))}
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.label}
                    className={clsx(
                      row.kind === 'bruto' && 'text-muted',
                      row.kind === 'credito' && 'text-ok',
                      row.kind === 'liquido' && 'font-medium',
                    )}
                  >
                    <td>{row.label}</td>
                    <td className="num text-right">{fmt(row.value)}</td>
                    <td className="num text-right">{fmt(row.value * 12)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>Total</td>
                  <td className="num text-right">{money(t.totalMensal)}</td>
                  <td className="num text-right">{money(t.totalAnual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Composição tributária líquida</CardTitle>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={50} outerRadius={82} paddingAngle={2} stroke="none">
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <Legend items={pie.map((p) => ({ name: p.name, color: p.fill, value: money(p.value) }))} />
          </Card>
          <Card>
            <CardTitle>Parâmetros</CardTitle>
            <KV label="Regime PIS/COFINS" value="Não-cumulativo" />
            <KV label="Alíquota PIS" value={pct(r.pis * 100)} />
            <KV label="Alíquota COFINS" value={pct(r.cofins * 100)} />
            <KV label="Alíquota IRPJ" value={pct(r.irpj * 100, 0)} />
            <KV label="Alíquota CSLL" value={pct(r.csll * 100, 0)} />
            <KV label="Base IRPJ/CSLL" value="Lucro real apurado" />
          </Card>
        </div>
      </div>
    </div>
  );
}
