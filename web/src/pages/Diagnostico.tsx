import { AlertTriangle, CheckCircle2, ClipboardList, Info, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { montarDiagnostico } from '../lib/diagnostico';
import { Badge, Card, CardTitle, Disclaimer, PageHeader, clsx } from '../components/ui';

export default function Diagnostico() {
  const { data, results, taxConfig } = useApp();
  const d = montarDiagnostico(data, results, taxConfig);
  const e = data.empresa;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Diagnóstico tributário"
        description="Análise consolidada dos dados financeiros e tributários da empresa."
        actions={
          <Badge className="!px-3 !py-1.5 !text-xs">
            <ClipboardList size={12} />
            {e.nomeFantasia || e.razaoSocial} — {e.periodoAnalise}
          </Badge>
        }
      />

      <Card>
        <CardTitle>Indicadores principais</CardTitle>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
          {d.indicadores.map((i) => (
            <div key={i.label} className="bg-surface p-4">
              <p className="label-xs">{i.label}</p>
              <p className="num mt-2 truncate text-lg font-semibold">{i.value}</p>
              <p className="num mt-0.5 truncate text-xs text-muted">{i.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {d.regimes.map((r) => {
          const best = r.name === d.melhor.name;
          return (
            <Card key={r.name} className={clsx(best && 'ring-1 ring-accent/40')}>
              {best && (
                <p className="mb-2 flex items-center gap-1 text-[11px] font-medium" style={{ color: r.color }}>
                  <CheckCircle2 size={12} /> Menor carga estimada
                </p>
              )}
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.name}
              </p>
              <p className="num mt-3 text-xl font-semibold">
                {money(r.anual)}
                <span className="text-xs font-normal text-muted">/ano</span>
              </p>
              <p className="num text-xs text-muted">Carga: {pct(r.carga * 100)}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<TrendingUp size={14} />}>Principais conclusões</CardTitle>
          <ol className="space-y-3">
            {d.conclusoes.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-subtle text-[11px] font-semibold text-muted">
                  {i + 1}
                </span>
                {c}
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardTitle icon={<AlertTriangle size={14} />}>Pontos de atenção</CardTitle>
          <div className="space-y-2">
            {d.pontos.map((p, i) => (
              <div
                key={i}
                className={clsx(
                  'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-relaxed',
                  p.tipo === 'alerta' ? 'bg-warn/[0.08]' : p.tipo === 'ok' ? 'bg-ok/[0.07]' : 'bg-subtle',
                )}
              >
                {p.tipo === 'alerta' ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
                ) : p.tipo === 'ok' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" />
                ) : (
                  <Info size={14} className="mt-0.5 shrink-0 text-accent" />
                )}
                {p.texto}
              </div>
            ))}
            {d.pontos.length === 0 && <p className="text-sm text-muted">Nenhum ponto de atenção crítico identificado.</p>}
          </div>
        </Card>
      </div>

      <Disclaimer />
    </div>
  );
}
