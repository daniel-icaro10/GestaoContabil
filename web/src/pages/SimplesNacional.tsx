import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { mediaMensal } from '../lib/tax';
import { Alert, Badge, Card, CardTitle, ChartTooltip, KV, PageHeader, Progress, Stat, axisTick, clsx, gridStroke } from '../components/ui';

export default function SimplesNacional() {
  const { results, data, taxConfig } = useApp();
  const t = results.simples;
  const n = data.empresa;
  const uso = Math.min(100, (t.rbt12 / taxConfig.simplesLimite) * 100);
  const faixas = taxConfig.simples[t.anexo].faixas;
  const chart = faixas.map((f, i) => ({
    name: `${i + 1}ª`,
    aliquota: f.aliquota * 100,
    fill: i === t.faixa - 1 ? 'var(--c-presumido)' : 'var(--c-simples)',
  }));
  const media = mediaMensal(data.faturamento.meses);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simulação"
        title="Simples Nacional"
        description="Cálculo baseado no RBT12, tipo de atividade e Fator R."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="RBT12" value={money(t.rbt12)} sub="Receita bruta 12 meses" color="var(--c-simples)" />
        <Stat label="Alíquota nominal" value={pct(t.aliquotaNominal * 100)} sub={`${t.faixa}ª faixa`} />
        <Stat label="Alíquota efetiva" value={pct(t.aliquotaEfetiva * 100)} sub="Após dedução" color="var(--c-presumido)" />
        <Stat label="DAS mensal est." value={money(t.dasMensal)} sub={`Anual: ${money(t.dasAnual)}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<FileText size={14} />}>Detalhamento do enquadramento</CardTitle>
          <KV label="Empresa" value={n.nomeFantasia || n.razaoSocial} />
          <KV label="Tipo de atividade" value={n.tipoAtividade} />
          <KV label="Anexo aplicável" value={t.anexo} />
          <KV label="Faixa" value={`${t.faixa}ª faixa`} />
          <KV label="Alíquota nominal" value={pct(t.aliquotaNominal * 100)} />
          <KV label="Parcela a deduzir" value={money(t.parcelaDeduzir)} />
          <KV strong label="Alíquota efetiva" value={pct(t.aliquotaEfetiva * 100)} tone="var(--c-simples)" />
          <div className="mt-4 rounded-lg bg-subtle p-4">
            <p className="label-xs mb-2">Cálculo da alíquota efetiva</p>
            <p className="num text-xs leading-relaxed text-muted">
              ({money(t.rbt12)} × {pct(t.aliquotaNominal * 100)} − {money(t.parcelaDeduzir)}) ÷ {money(t.rbt12)}
            </p>
            <p className="num mt-1 text-sm font-semibold">= {pct(t.aliquotaEfetiva * 100)}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Alíquotas por faixa</CardTitle>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={chart} barCategoryGap="30%" margin={{ left: -14, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => pct(v)} />} />
                <Bar dataKey="aliquota" name="Alíquota nominal" radius={[4, 4, 0, 0]}>
                  {chart.map((c) => (
                    <Cell key={c.name} fill={c.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted">Barra destacada = faixa atual da empresa</p>
          </Card>
          <Card>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted">Utilização do limite ({money(taxConfig.simplesLimite)})</span>
              <span className="num font-medium">{pct(uso)}</span>
            </div>
            <Progress value={uso} color={uso > 80 ? 'rgb(var(--danger))' : 'var(--c-simples)'} />
          </Card>
        </div>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardTitle>Tabela de faixas — {t.anexo}</CardTitle>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Faixa</th>
                <th className="text-right">Limite de RBT12</th>
                <th className="text-right">Alíquota nominal</th>
                <th className="text-right">Parcela a deduzir</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f, i) => (
                <tr key={i} className={clsx(i === t.faixa - 1 && 'bg-accent/[0.05]')}>
                  <td className="num">{i + 1}ª</td>
                  <td className="num text-right">{money(f.limite)}</td>
                  <td className="num text-right">{pct(f.aliquota * 100)}</td>
                  <td className="num text-right">{money(f.deducao)}</td>
                  <td>{i === t.faixa - 1 && <Badge tone="accent">Faixa atual</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Projeção de tributos</CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'DAS mensal estimado', value: money(t.dasMensal), sub: `Sobre faturamento de ${money(media)}/mês` },
            { label: 'DAS anual estimado', value: money(t.dasAnual), sub: 'Projeção para 12 meses' },
            { label: 'Carga tributária efetiva', value: pct(t.cargaEfetiva * 100) },
          ].map((i) => (
            <div key={i.label} className="rounded-lg border border-line p-4">
              <p className="label-xs">{i.label}</p>
              <p className="num mt-2 text-xl font-semibold">{i.value}</p>
              {i.sub && <p className="mt-1 text-xs text-muted">{i.sub}</p>}
            </div>
          ))}
        </div>
      </Card>

      {!t.elegivel && (
        <Alert tone="danger">
          A receita anual ({money(t.rbt12)}) ultrapassa o limite do Simples Nacional ({money(taxConfig.simplesLimite)}). A empresa não pode
          optar por este regime; os valores abaixo são apenas referência e o Simples não entra na recomendação.
        </Alert>
      )}
      {t.elegivel && uso > 80 && (
        <Alert tone="warn">
          O faturamento da empresa está próximo do limite do Simples Nacional ({money(taxConfig.simplesLimite)}). Recomenda-se
          análise antecipada sobre eventual necessidade de migração de regime tributário.
        </Alert>
      )}
    </div>
  );
}
