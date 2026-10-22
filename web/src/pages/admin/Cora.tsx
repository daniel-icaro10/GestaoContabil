import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { CheckCircle2, KeyRound, Link2, Loader2, Plug, RefreshCcw, Save, ShieldCheck, Trash2, Upload, Webhook } from 'lucide-react';
import { api } from '../../lib/api';
import { dateBR } from '../../lib/format';
import { Alert, Badge, Button, Card, CardTitle, CopyButton, Field, Input, PageHeader, Spinner, Textarea, clsx, useToast } from '../../components/ui';

interface CoraView {
  environment: 'stage' | 'production';
  clientId: string;
  baseUrl: string;
  defaultBaseUrls: { stage: string; production: string };
  hasCertificate: boolean;
  hasPrivateKey: boolean;
  certificate: null | { subject: string; validFrom: string; validTo: string };
  configured: boolean;
  webhookUrl: string;
}

interface Endpoint {
  id: string;
  url: string;
  resource: string;
  trigger: string;
}

function FileLoad({ accept, onLoad }: { accept: string; onLoad(text: string): void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:underline">
      <Upload size={12} /> Carregar arquivo
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) f.text().then(onLoad);
          e.target.value = '';
        }}
      />
    </label>
  );
}

export default function Cora() {
  const toast = useToast();
  const [view, setView] = useState<CoraView | null>(null);
  const [form, setForm] = useState({ environment: 'stage' as 'stage' | 'production', clientId: '', certificate: '', privateKey: '', baseUrl: '', webhookUrl: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null);
  const [events, setEvents] = useState<{ id: number; event_type: string; resource_id: string; received_at: string }[]>([]);

  const apply = useCallback((v: CoraView) => {
    setView(v);
    setForm((f) => ({ ...f, environment: v.environment, clientId: v.clientId, baseUrl: v.baseUrl, certificate: '', privateKey: '' }));
  }, []);

  useEffect(() => {
    api<CoraView>('/admin/cora').then(apply).catch((e) => toast(e.message, 'danger'));
    api('/admin/cora/webhook-events').then(setEvents).catch(() => undefined);
  }, [apply, toast]);

  const save = async () => {
    setBusy('save');
    setTest(null);
    try {
      apply(await api<CoraView>('/admin/cora', { method: 'PUT', body: form }));
      toast('Configuração salva. Credenciais armazenadas com criptografia.');
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setTest(null);
    try {
      setTest(await api('/admin/cora/test', { method: 'POST' }));
    } finally {
      setBusy(null);
    }
  };

  const loadEndpoints = async () => {
    setBusy('endpoints');
    try {
      const r = await api<any>('/admin/cora/endpoints');
      setEndpoints(Array.isArray(r) ? r : (r?.items ?? r?.endpoints ?? []));
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const register = async () => {
    setBusy('register');
    try {
      await api('/admin/cora/endpoints', { body: {} });
      toast('Webhook registrado na Cora.');
      await loadEndpoints();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setBusy(null);
    }
  };

  const removeEndpoint = async (id: string) => {
    try {
      await api(`/admin/cora/endpoints/${id}`, { method: 'DELETE' });
      await loadEndpoints();
      toast('Endpoint removido.');
    } catch (e: any) {
      toast(e.message, 'danger');
    }
  };

  if (!view) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Integração Cora"
        description="Credenciais da API Cora (Integração Direta com mTLS) usadas para emitir as cobranças das assinaturas."
        actions={
          view.configured ? (
            <Badge tone="ok" className="!px-3 !py-1.5 !text-xs">
              <CheckCircle2 size={12} /> Configurada
            </Badge>
          ) : (
            <Badge tone="warn" className="!px-3 !py-1.5 !text-xs">
              Não configurada
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle icon={<KeyRound size={14} />}>Credenciais</CardTitle>
            <div className="space-y-4">
              <Field label="Ambiente">
                <div className="inline-flex rounded-lg bg-subtle p-0.5">
                  {(['stage', 'production'] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setForm({ ...form, environment: env })}
                      className={clsx(
                        'rounded-md px-4 py-1.5 text-sm transition',
                        form.environment === env ? 'bg-surface font-medium shadow-sm' : 'text-muted',
                      )}
                    >
                      {env === 'stage' ? 'Stage (testes)' : 'Produção'}
                    </button>
                  ))}
                </div>
              </Field>
              {form.environment === 'production' && (
                <Alert tone="warn">Em produção as cobranças são reais. Use o certificado e a chave do ambiente de produção.</Alert>
              )}
              <Field label="Client ID" tip="Disponível no app Cora em Conta › Integrações via APIs.">
                <Input className="num" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="int-xxxxxxxxxxxx" />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between">
                    <span>Certificado (PEM)</span>
                    <FileLoad accept=".pem,.crt,.cer" onLoad={(certificate) => setForm({ ...form, certificate })} />
                  </span>
                }
                tip={view.hasCertificate ? 'Já existe um certificado salvo. Cole um novo apenas para substituí-lo.' : undefined}
              >
                <Textarea
                  value={form.certificate}
                  onChange={(e) => setForm({ ...form, certificate: e.target.value })}
                  placeholder={view.hasCertificate ? '•••• certificado armazenado' : '-----BEGIN CERTIFICATE-----'}
                />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between">
                    <span>Chave privada (PEM)</span>
                    <FileLoad accept=".pem,.key" onLoad={(privateKey) => setForm({ ...form, privateKey })} />
                  </span>
                }
                tip="Armazenada criptografada (AES-256-GCM) e nunca exibida novamente."
              >
                <Textarea
                  value={form.privateKey}
                  onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                  placeholder={view.hasPrivateKey ? '•••• chave armazenada — deixe em branco para manter' : '-----BEGIN PRIVATE KEY-----'}
                />
              </Field>
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-fg">Avançado</summary>
                <div className="mt-3">
                  <Field label="URL base da API" tip={`Padrão: ${view.defaultBaseUrls[form.environment]}`}>
                    <Input className="num" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={view.defaultBaseUrls[form.environment]} />
                  </Field>
                </div>
              </details>
              {test && (
                <Alert tone={test.ok ? 'ok' : 'danger'} title={test.ok ? 'Conexão bem-sucedida' : 'Falha na conexão'}>
                  {test.message}
                </Alert>
              )}
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <Button variant="outline" icon={<Plug size={14} />} onClick={runTest} loading={busy === 'test'} disabled={!view.configured}>
                  Testar conexão
                </Button>
                <Button icon={<Save size={14} />} onClick={save} loading={busy === 'save'}>
                  Salvar credenciais
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle icon={<Webhook size={14} />}>Webhook de pagamentos</CardTitle>
            <p className="mb-3 text-sm text-muted">
              A Cora notifica esta URL quando uma cobrança é paga, liberando o acesso do usuário na hora. Sem webhook, o sistema
              consulta as faturas abertas a cada 30 minutos.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly className="num text-xs" value={view.webhookUrl} />
              <CopyButton text={view.webhookUrl} />
            </div>
            {!view.webhookUrl.startsWith('https://') && (
              <div className="mt-3">
                <Alert tone="warn">
                  A Cora exige uma URL HTTPS pública. Defina a variável <code className="num">PUBLIC_URL</code> no servidor (ex.:
                  https://app.suaempresa.com.br).
                </Alert>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<Link2 size={14} />} onClick={register} loading={busy === 'register'} disabled={!view.configured}>
                Registrar webhook na Cora
              </Button>
              <Button variant="outline" icon={<RefreshCcw size={14} />} onClick={loadEndpoints} loading={busy === 'endpoints'} disabled={!view.configured}>
                Listar endpoints
              </Button>
            </div>
            {endpoints && (
              <div className="mt-4 space-y-1.5">
                {endpoints.length === 0 && <p className="text-sm text-muted">Nenhum endpoint registrado.</p>}
                {endpoints.map((ep) => (
                  <div key={ep.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-xs">
                    <Badge>
                      {ep.resource}.{ep.trigger}
                    </Badge>
                    <span className="num min-w-0 flex-1 truncate">{ep.url}</span>
                    <button onClick={() => removeEndpoint(ep.id)} className="text-muted hover:text-danger" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {events.length > 0 && (
              <div className="mt-5">
                <p className="label-xs mb-2">Notificações recentes</p>
                <div className="space-y-1">
                  {events.slice(0, 8).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 text-xs">
                      <span className="num text-muted">{dateBR(ev.received_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <Badge tone="accent">{ev.event_type || '—'}</Badge>
                      <span className="num truncate text-muted">{ev.resource_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle icon={<ShieldCheck size={14} />}>Certificado</CardTitle>
            {view.certificate ? (
              <div className="space-y-2 text-sm">
                <p className="num break-all text-xs text-muted">{view.certificate.subject}</p>
                <p>
                  <span className="text-muted">Válido até: </span>
                  <span className="num">{view.certificate.validTo ? dateBR(new Date(view.certificate.validTo).toISOString()) : '—'}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhum certificado cadastrado.</p>
            )}
          </Card>
          <Card>
            <CardTitle>Como obter as credenciais</CardTitle>
            <ol className="space-y-3 text-sm text-muted">
              {[
                'No app ou web banking da Cora, acesse Conta › Integrações via APIs.',
                'Escolha a modalidade Integração Direta e gere as credenciais do ambiente desejado (Stage ou Produção).',
                'Baixe o certificado (.pem) e a chave privada (.key) e copie o Client ID.',
                'Cole os dados aqui, salve e clique em Testar conexão.',
                'Registre o webhook para receber a confirmação dos pagamentos em tempo real.',
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-subtle text-[11px] font-semibold text-fg">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <a
              href="https://developers.cora.com.br/docs/instrucoes-iniciais"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs font-medium text-accent hover:underline"
            >
              Documentação da Cora →
            </a>
          </Card>
          {busy === 'test' && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" /> Autenticando via mTLS...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
