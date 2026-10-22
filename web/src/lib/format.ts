const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);
export const pct = (v: number, digits = 2) => `${(Number.isFinite(v) ? v : 0).toFixed(digits).replace('.', ',')}%`;
export const kfmt = (v: number) => `${(v / 1e3).toFixed(0)}k`;
export const cents = (c: number) => money(c / 100);

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const UFS = 'AC.AL.AM.AP.BA.CE.DF.ES.GO.MA.MG.MS.MT.PA.PB.PE.PI.PR.RJ.RN.RO.RR.RS.SC.SE.SP.TO'.split('.');

export function formatDoc(v: string) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v ?? '';
}

export function maskCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return maskCnpj(d);
}

export function dateBR(iso?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso.replace(' ', 'T') + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', opts);
}

export const intervalLabel = (m: number) => (m === 1 ? 'mês' : m === 12 ? 'ano' : `${m} meses`);
