import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { dateBR, maskCpfCnpj } from '../lib/format';
import { pageLabel } from '../lib/pages';
import { Badge, Button, Card, CardTitle, Field, Input, PageHeader, useToast } from '../components/ui';

export default function Perfil() {
  const { session, setSession } = useAuth();
  const toast = useToast();
  const u = session!.user;
  const [form, setForm] = useState({
    name: u.name,
    document: maskCpfCnpj(u.document),
    phone: u.phone,
    currentPassword: '',
    newPassword: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api('/auth/profile', { method: 'PUT', body: { ...form, document: form.document.replace(/\D/g, '') } });
      setSession(s);
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }));
      toast('Perfil atualizado.');
    } catch (err: any) {
      toast(err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Conta" title="Meu perfil" description="Seus dados de acesso e de cobrança." />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardTitle>Dados pessoais</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="E-mail" tip="Para alterar o e-mail, contate o administrador.">
              <Input value={u.email} disabled />
            </Field>
            <Field label="CPF ou CNPJ" tip="Obrigatório para emissão de boleto/PIX.">
              <Input className="num" value={form.document} onChange={(e) => setForm({ ...form, document: maskCpfCnpj(e.target.value) })} />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
        </Card>
        <Card>
          <CardTitle>Alterar senha</CardTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Senha atual">
              <Input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
            </Field>
            <Field label="Nova senha" tip="Mínimo de 6 caracteres. Deixe em branco para manter.">
              <Input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
        </Card>
        <Card>
          <CardTitle>Acesso</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Perfil:</span>
            <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role === 'admin' ? 'Administrador' : 'Usuário'}</Badge>
            <span className="ml-4 text-muted">Membro desde {dateBR(u.createdAt)}</span>
          </div>
          {u.role !== 'admin' && (
            <div className="mt-4">
              <p className="label-xs mb-2">Telas liberadas</p>
              <div className="flex flex-wrap gap-1.5">
                {u.permissions.length ? u.permissions.map((p) => <Badge key={p}>{pageLabel(p)}</Badge>) : <span className="text-sm text-muted">Nenhuma tela liberada.</span>}
              </div>
            </div>
          )}
        </Card>
        <div className="flex justify-end">
          <Button type="submit" icon={<Save size={14} />} loading={busy}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
