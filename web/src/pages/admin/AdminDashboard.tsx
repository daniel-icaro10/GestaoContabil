import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleDollarSign, Plug, Receipt, TrendingUp, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { cents } from '../../lib/format';
import { Alert, Card, CardTitle, ChartTooltip, PageHeader, Spinner, Stat, axisTick, gridStroke } from '../../components/ui';

interface Stats {
  users: number;
  activeSubs: number;
  mrrCents: number;
  openInvoices: number;
  openAmountCents: number;
  revenue30Cents: number;
  monthly: { month: string; v: number }[];
  coraConfigured: boolean;
}

export default function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Stats>('/admin/stats').then(setS).catch((e) => setError(e.message));
  }, []);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!s) return <Spinner />;
  const chart = s.monthly.map((m) => ({
    name: new Date(`${m.month}-15`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    valor: m.v / 100,
  }));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administração" title="Visão geral" description="Assinantes, receita recorrente e cobranças." />
      {!s.coraConfigured && (
        <Alert tone="warn" title="Integração Cora não configurada">
          Os usuários não conseguem gerar cobranças até que as credenciais sejam cadastradas.{' '}
          <Link to="/admin/cora" className="font-medium underline underline-offset-4">
            Configurar agora
          </Link>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Usuários" value={s.users} sub={`${s.activeSubs} com assinatura ativa`} icon={<Users size={16} />} />
        <Stat label="Receita recorrente (MRR)" value={cents(s.mrrCents)} sub="Mensalizada" icon={<TrendingUp size={16} />} color="rgb(var(--ok))" />
        <Stat label="Recebido em 30 dias" value={cents(s.revenue30Cents)} icon={<CircleDollarSign size={16} />} />
        <Stat label="Cobranças em aberto" value={s.openInvoices} sub={cents(s.openAmountCents)} icon={<Receipt size={16} />} color="rgb(var(--warn))" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Receita por mês</CardTitle>
          {chart.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">Nenhum pagamento recebido ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chart} margin={{ left: -4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--subtle))' }} content={<ChartTooltip format={(v) => cents(v * 100)} />} />
                <Bar dataKey="valor" name="Receita" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <CardTitle>Atalhos</CardTitle>
          <div className="space-y-1">
            {[
              { to: '/admin/usuarios', label: 'Gerenciar usuários e permissões', icon: Users },
              { to: '/admin/faturas', label: 'Ver faturas', icon: Receipt },
              { to: '/admin/planos', label: 'Editar planos', icon: CircleDollarSign },
              { to: '/admin/cora', label: 'Integração Cora', icon: Plug },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-subtle">
                <l.icon size={15} className="text-muted" />
                {l.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
