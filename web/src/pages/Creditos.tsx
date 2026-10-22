import { CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { money, pct } from '../lib/format';
import { baseCreditos } from '../lib/tax';
import { CREDITO_FIELDS } from '../lib/fields';
import { Alert, Card, CardTitle, KV, MoneyInput, PageHeader } from '../components/ui';

export default function Creditos() {
  const { data, setCreditos, taxConfig } = useApp();
  const base = baseCreditos(data.creditos);
  const pis = base * taxConfig.real.pis;
  const cofins = base * taxConfig.real.cofins;
  const total = pis + cofins;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dados financeiros"
        title="Créditos tributários"
        description="Os créditos de PIS e COFINS reduzem a carga líquida no Lucro Real (regime não-cumulativo)."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="label-xs flex items-center gap-2">
            <CreditCard size={12} /> Crédito PIS (anual est.)
          </p>
          <p className="num mt-3 text-2xl font-semibold text-ok">{money(pis)}</p>
          <p className="mt-1 text-xs text-muted">Alíquota: {pct(taxConfig.real.pis * 100)}</p>
        </Card>
        <Card>
          <p className="label-xs flex items-center gap-2">
            <CreditCard size={12} /> Crédito COFINS (anual est.)
          </p>
          <p className="num mt-3 text-2xl font-semibold text-ok">{money(cofins)}</p>
          <p className="mt-1 text-xs text-muted">Alíquota: {pct(taxConfig.real.cofins * 100)}</p>
        </Card>
        <Card className="border-accent/30 bg-accent/[0.04]">
          <p className="label-xs">Total de créditos (anual est.)</p>
          <p className="num mt-3 text-2xl font-semibold text-accent">{money(total)}</p>
          <p className="num mt-1 text-xs text-muted">{money(total / 12)}/mês</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Bases de crédito</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CREDITO_FIELDS.map((f) => (
              <MoneyInput
                key={f.key}
                label={`${f.label} (anual)`}
                tip={f.tip}
                value={data.creditos[f.key]}
                onChange={(v) => setCreditos({ [f.key]: v })}
              />
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Créditos estimados por tributo</CardTitle>
            <KV label="Base total para PIS/COFINS" value={money(base)} />
            <KV label={`Crédito PIS (${pct(taxConfig.real.pis * 100)})`} value={money(pis)} tone="rgb(var(--ok))" />
            <KV label={`Crédito COFINS (${pct(taxConfig.real.cofins * 100)})`} value={money(cofins)} tone="rgb(var(--accent))" />
            <KV label="ICMS nas compras" value={money(data.creditos.icmsCompras)} tone="#f59e0b" />
            <KV label="Outros créditos" value={money(data.creditos.outrosCreditos)} tone="#8b5cf6" />
            <KV strong label="Total de créditos" value={money(total)} tone="rgb(var(--ok))" />
          </Card>
          <Alert tone="accent" title="Aplicação dos créditos">
            Os créditos de PIS e COFINS são aplicáveis no regime de Lucro Real (não-cumulativo), conforme Lei nº 10.637/2002 e
            Lei nº 10.833/2003. No Simples Nacional e no Lucro Presumido, as contribuições são calculadas de forma cumulativa sem
            aproveitamento de créditos das entradas.
          </Alert>
        </div>
      </div>
    </div>
  );
}
