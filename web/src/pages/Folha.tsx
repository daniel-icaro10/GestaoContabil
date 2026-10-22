import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { fatorR, soma, totalFolha } from '../lib/tax';
import { FOLHA_FIELDS, PALETTE } from '../lib/fields';
import { Alert, Card, CardTitle, ChartTooltip, Legend, MoneyInput, PageHeader, Progress } from '../components/ui';

export default function Folha() {
  const { data, setFolha, taxConfig } = useApp();
  const total = totalFolha(data.folha);
  const receita = soma(data.faturamento.meses);
  const fr = fatorR(data.folha, data.faturamento);
  const ok = fr >= taxConfig.fatorRLimite;
  const ratio = receita > 0 ? total / receita : 0;
  const pie = FOLHA_FIELDS.map((f, i) => ({ name: f.label, value: data.folha[f.key], fill: PALETTE[i] })).filter((p) => p.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dados financeiros"
        title="Folha e encargos"
        description="Informe os valores anuais da folha de pagamento e encargos trabalhistas."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="label-xs flex items-center gap-2">
            <Users size={12} /> Folha total
          </p>
          <p className="num mt-3 text-2xl font-semibold">{money(total)}</p>
          <p className="num mt-1 text-xs text-muted">{money(total / 12)}/mês estimado</p>
        </Card>
        <Card>
          <p className="label-xs">Folha / faturamento</p>
          <p className="num mt-3 text-2xl font-semibold">{pct(ratio * 100)}</p>
          <div className="mt-3">
            <Progress value={ratio * 100} />
          </div>
        </Card>
        <Card className={ok ? 'border-ok/30' : 'border-warn/30'}>
          <p className="label-xs flex items-center gap-2">
            {ok ? <CheckCircle2 size={12} className="text-ok" /> : <AlertCircle size={12} className="text-warn" />} Fator R
          </p>
          <p className="num mt-3 text-2xl font-semibold" style={{ color: ok ? 'rgb(var(--ok))' : 'rgb(var(--warn))' }}>
            {pct(fr * 100)}
          </p>
          <p className="mt-1 text-xs text-muted">{ok ? 'Anexo III (≥28%)' : 'Anexo V (<28%)'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Composição da folha (anual)</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FOLHA_FIELDS.map((f) => (
              <MoneyInput key={f.key} label={f.label} value={data.folha[f.key]} onChange={(v) => setFolha({ [f.key]: v })} />
            ))}
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>Composição da folha</CardTitle>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <Legend items={pie.map((p) => ({ name: p.name, color: p.fill, value: money(p.value) }))} />
          </Card>
          <Alert tone="accent" title="Sobre o Fator R">
            Quando aplicável, o Fator R poderá influenciar o enquadramento entre os Anexos III e V do Simples Nacional. Ele
            representa a relação entre a folha de pagamento (incluindo pró-labore) dos últimos 12 meses e a receita bruta do
            mesmo período.
          </Alert>
        </div>
      </div>

      <Card>
        <CardTitle>Detalhamento</CardTitle>
        <div className="space-y-2.5">
          {FOLHA_FIELDS.map((f, i) => {
            const v = data.folha[f.key];
            const share = total > 0 ? (v / total) * 100 : 0;
            return (
              <div key={f.key} className="grid grid-cols-[minmax(0,180px)_1fr_auto_60px] items-center gap-4 text-sm">
                <span className="truncate text-muted">{f.label}</span>
                <Progress value={share} color={PALETTE[i]} />
                <span className="num text-right">{money(v)}</span>
                <span className="num text-right text-xs text-muted">{pct(share)}</span>
              </div>
            );
          })}
          <div className="flex justify-between border-t border-line pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="num">{money(total)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
