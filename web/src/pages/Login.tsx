import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { maskCpfCnpj } from '../lib/format';
import { Alert, Button, Field, Input } from '../components/ui';

export default function Login() {
  const { login, register, setup } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [allowSignup, setAllowSignup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const isSetup = needsSetup;
  const isSignup = !isSetup && pathname === '/cadastro';
  const [form, setForm] = useState({ name: '', email: '', password: '', document: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ allowSignup: boolean; needsSetup: boolean }>('/auth/config')
      .then((c) => {
        setAllowSignup(c.allowSignup);
        setNeedsSetup(c.needsSetup);
        if (c.needsSetup && pathname !== '/setup') navigate('/setup', { replace: true });
        if (!c.needsSetup && pathname === '/setup') navigate('/login', { replace: true });
      })
      .catch(() => undefined);
  }, [pathname, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isSetup) await setup({ name: form.name, email: form.email, password: form.password });
      else if (isSignup) await register({ ...form, document: form.document.replace(/\D/g, '') || undefined });
      else await login(form.email, form.password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'document' ? maskCpfCnpj(e.target.value) : e.target.value }));

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-surface lg:block">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg text-bg">
              <ShieldCheck size={16} />
            </div>
            <span className="text-sm font-semibold tracking-tight">Diagnóstico Tributário</span>
          </div>
          <div className="max-w-md">
            <p className="label-xs mb-3">Planejamento tributário inteligente</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Descubra o regime tributário com a menor carga para cada empresa.
            </h1>
            <div className="mt-8 space-y-3">
              {[
                { icon: BarChart3, text: 'Simples Nacional, Lucro Presumido e Lucro Real lado a lado' },
                { icon: Sparkles, text: 'Simulador de cenários e diagnóstico automático' },
                { icon: ShieldCheck, text: 'Relatórios prontos para apresentar ao cliente' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-muted">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface">
                    <Icon size={14} className="text-accent" />
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>
          <p className="num text-xs text-muted">© {new Date().getFullYear()}</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-enter">
          <div className="mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fg text-bg">
              <ShieldCheck size={17} />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {isSetup ? 'Configuração inicial' : isSignup ? 'Criar conta' : 'Entrar'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isSetup
              ? 'Crie a conta do administrador do sistema.'
              : isSignup
                ? 'Preencha seus dados para começar.'
                : 'Acesse sua conta para continuar.'}
          </p>

          <div className="mt-8 space-y-4">
            {isSetup && (
              <Field label="Nome do administrador">
                <Input required value={form.name} onChange={set('name')} autoComplete="name" />
              </Field>
            )}
            {isSignup && (
              <>
                <Field label="Nome completo">
                  <Input required value={form.name} onChange={set('name')} autoComplete="name" />
                </Field>
                <Field label="CPF ou CNPJ" tip="Usado para emitir as cobranças da assinatura.">
                  <Input className="num" value={form.document} onChange={set('document')} />
                </Field>
              </>
            )}
            <Field label="E-mail">
              <Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input
                required
                type="password"
                minLength={isSetup ? 8 : isSignup ? 6 : undefined}
                value={form.password}
                onChange={set('password')}
                autoComplete={isSignup || isSetup ? 'new-password' : 'current-password'}
              />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" className="w-full" loading={busy} icon={!busy && <ArrowRight size={14} />}>
              {isSetup ? 'Criar administrador' : isSignup ? 'Criar conta' : 'Entrar'}
            </Button>
          </div>

          {allowSignup && !isSetup && (
            <p className="mt-6 text-center text-sm text-muted">
              {isSignup ? 'Já tem conta? ' : 'Ainda não tem conta? '}
              <Link to={isSignup ? '/login' : '/cadastro'} className="font-medium text-fg underline-offset-4 hover:underline">
                {isSignup ? 'Entrar' : 'Criar conta'}
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
