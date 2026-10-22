import { useApp } from '../context/AppContext';
import { UFS, maskCnpj } from '../lib/format';
import { ATIVIDADES_ESPECIFICAS, REGIMES, TIPOS_ATIVIDADE, type Regime, type TipoAtividade } from '../lib/tax';
import { Field, Input, Select } from './ui';

export function EmpresaForm() {
  const { data, setEmpresa } = useApp();
  const e = data.empresa;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Razão social" className="sm:col-span-2">
        <Input value={e.razaoSocial} onChange={(ev) => setEmpresa({ razaoSocial: ev.target.value })} />
      </Field>
      <Field label="Nome fantasia">
        <Input value={e.nomeFantasia} onChange={(ev) => setEmpresa({ nomeFantasia: ev.target.value })} />
      </Field>
      <Field label="CNPJ">
        <Input
          className="num"
          value={e.cnpj}
          placeholder="00.000.000/0001-00"
          onChange={(ev) => setEmpresa({ cnpj: maskCnpj(ev.target.value) })}
        />
      </Field>
      <Field label="Cidade">
        <Input value={e.cidade} onChange={(ev) => setEmpresa({ cidade: ev.target.value })} />
      </Field>
      <Field label="Estado">
        <Select value={e.estado} onChange={(ev) => setEmpresa({ estado: ev.target.value })}>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </Field>
      <Field label="CNAE principal" tip="Ex.: 4751-2/01">
        <Input className="num" value={e.cnaePrincipal} onChange={(ev) => setEmpresa({ cnaePrincipal: ev.target.value })} />
      </Field>
      <Field label="CNAEs secundários">
        <Input
          value={e.cnaesSecundarios}
          placeholder="Separar por vírgula"
          onChange={(ev) => setEmpresa({ cnaesSecundarios: ev.target.value })}
        />
      </Field>
      <Field label="Atividade principal" className="sm:col-span-2">
        <Input value={e.atividadePrincipal} onChange={(ev) => setEmpresa({ atividadePrincipal: ev.target.value })} />
      </Field>
      <Field label="Tipo de atividade">
        <Select value={e.tipoAtividade} onChange={(ev) => setEmpresa({ tipoAtividade: ev.target.value as TipoAtividade })}>
          {TIPOS_ATIVIDADE.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Regime tributário atual">
        <Select value={e.regimeAtual} onChange={(ev) => setEmpresa({ regimeAtual: ev.target.value as Regime })}>
          {REGIMES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Atividades com regras tributárias específicas" className="sm:col-span-2">
        <Select value={e.atividadeEspecifica} onChange={(ev) => setEmpresa({ atividadeEspecifica: ev.target.value })}>
          {ATIVIDADES_ESPECIFICAS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Período de análise">
        <Input
          className="num"
          value={e.periodoAnalise}
          placeholder="2024"
          onChange={(ev) => setEmpresa({ periodoAnalise: ev.target.value })}
        />
      </Field>
      <Field label="Responsável">
        <Input value={e.usuarioResponsavel} onChange={(ev) => setEmpresa({ usuarioResponsavel: ev.target.value })} />
      </Field>
    </div>
  );
}
