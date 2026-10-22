// Motor de cálculo tributário (Simples Nacional, Lucro Presumido e Lucro Real).
// Todos os parâmetros vêm de TaxConfig, editável na tela de Configurações.

export interface Faixa {
  limite: number;
  aliquota: number;
  deducao: number;
}

export type AnexoNome =
  | 'Anexo I - Comércio'
  | 'Anexo II - Indústria'
  | 'Anexo III - Serviços (Fator R ≥ 28%)'
  | 'Anexo IV - Serviços Específicos'
  | 'Anexo V - Serviços (Fator R < 28%)';

export interface TaxConfig {
  simples: Record<AnexoNome, { descricao: string; faixas: Faixa[] }>;
  simplesLimite: number;
  fatorRLimite: number;
  presumido: { irpj: number; adicionalIrpj: number; limiteAdicional: number; csll: number; pis: number; cofins: number };
  presuncaoIrpj: { comercio: number; servicos: number; industria: number; outros: number };
  presuncaoCsll: { comercio: number; servicos: number; industria: number; outros: number };
  real: { irpj: number; adicionalIrpj: number; limiteAdicional: number; csll: number; pis: number; cofins: number };
  iss: { minimo: number; padrao: number; maximo: number };
  icmsPadrao: number;
  inssPatronal: number;
  reforma: { habilitada: boolean; cbs: number; ibs: number; seletivo: number; regime: string };
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  simples: {
    'Anexo I - Comércio': {
      descricao: 'Comércio',
      faixas: [
        { limite: 180000, aliquota: 0.04, deducao: 0 },
        { limite: 360000, aliquota: 0.073, deducao: 5940 },
        { limite: 720000, aliquota: 0.095, deducao: 13860 },
        { limite: 1800000, aliquota: 0.107, deducao: 22500 },
        { limite: 3600000, aliquota: 0.143, deducao: 87300 },
        { limite: 4800000, aliquota: 0.19, deducao: 378000 },
      ],
    },
    'Anexo II - Indústria': {
      descricao: 'Indústria',
      faixas: [
        { limite: 180000, aliquota: 0.045, deducao: 0 },
        { limite: 360000, aliquota: 0.078, deducao: 5940 },
        { limite: 720000, aliquota: 0.1, deducao: 13860 },
        { limite: 1800000, aliquota: 0.112, deducao: 22500 },
        { limite: 3600000, aliquota: 0.147, deducao: 85500 },
        { limite: 4800000, aliquota: 0.3, deducao: 720000 },
      ],
    },
    'Anexo III - Serviços (Fator R ≥ 28%)': {
      descricao: 'Serviços com Fator R elevado',
      faixas: [
        { limite: 180000, aliquota: 0.06, deducao: 0 },
        { limite: 360000, aliquota: 0.112, deducao: 9360 },
        { limite: 720000, aliquota: 0.132, deducao: 17640 },
        { limite: 1800000, aliquota: 0.16, deducao: 35640 },
        { limite: 3600000, aliquota: 0.21, deducao: 125640 },
        { limite: 4800000, aliquota: 0.33, deducao: 648000 },
      ],
    },
    'Anexo IV - Serviços Específicos': {
      descricao: 'Construção civil, vigilância, limpeza etc.',
      faixas: [
        { limite: 180000, aliquota: 0.045, deducao: 0 },
        { limite: 360000, aliquota: 0.09, deducao: 8100 },
        { limite: 720000, aliquota: 0.102, deducao: 12420 },
        { limite: 1800000, aliquota: 0.14, deducao: 39780 },
        { limite: 3600000, aliquota: 0.22, deducao: 183780 },
        { limite: 4800000, aliquota: 0.33, deducao: 828000 },
      ],
    },
    'Anexo V - Serviços (Fator R < 28%)': {
      descricao: 'Serviços com Fator R reduzido',
      faixas: [
        { limite: 180000, aliquota: 0.155, deducao: 0 },
        { limite: 360000, aliquota: 0.18, deducao: 4500 },
        { limite: 720000, aliquota: 0.195, deducao: 9900 },
        { limite: 1800000, aliquota: 0.205, deducao: 17100 },
        { limite: 3600000, aliquota: 0.23, deducao: 62100 },
        { limite: 4800000, aliquota: 0.305, deducao: 540000 },
      ],
    },
  },
  simplesLimite: 4800000,
  fatorRLimite: 0.28,
  presumido: { irpj: 0.15, adicionalIrpj: 0.1, limiteAdicional: 20000, csll: 0.09, pis: 0.0065, cofins: 0.03 },
  presuncaoIrpj: { comercio: 0.08, servicos: 0.32, industria: 0.08, outros: 0.16 },
  presuncaoCsll: { comercio: 0.12, servicos: 0.32, industria: 0.12, outros: 0.16 },
  real: { irpj: 0.15, adicionalIrpj: 0.1, limiteAdicional: 20000, csll: 0.09, pis: 0.0165, cofins: 0.076 },
  iss: { minimo: 0.02, padrao: 0.03, maximo: 0.05 },
  icmsPadrao: 0.12,
  inssPatronal: 0.2,
  reforma: { habilitada: false, cbs: 0.088, ibs: 0.177, seletivo: 0, regime: 'Simples Nacional padrão' },
};

export function mergeTaxConfig(stored: Partial<TaxConfig> | null | undefined): TaxConfig {
  if (!stored) return structuredClone(DEFAULT_TAX_CONFIG);
  const d = structuredClone(DEFAULT_TAX_CONFIG);
  return {
    ...d,
    ...stored,
    simples: { ...d.simples, ...(stored.simples ?? {}) },
    presumido: { ...d.presumido, ...(stored.presumido ?? {}) },
    presuncaoIrpj: { ...d.presuncaoIrpj, ...(stored.presuncaoIrpj ?? {}) },
    presuncaoCsll: { ...d.presuncaoCsll, ...(stored.presuncaoCsll ?? {}) },
    real: { ...d.real, ...(stored.real ?? {}) },
    iss: { ...d.iss, ...(stored.iss ?? {}) },
    reforma: { ...d.reforma, ...(stored.reforma ?? {}) },
  };
}

// ---------------- Dados da empresa ----------------

export type TipoAtividade =
  | 'Comércio'
  | 'Serviços'
  | 'Indústria'
  | 'Comércio e Serviços'
  | 'Indústria e Comércio'
  | 'Atividades Mistas';

export const TIPOS_ATIVIDADE: TipoAtividade[] = [
  'Comércio',
  'Serviços',
  'Indústria',
  'Comércio e Serviços',
  'Indústria e Comércio',
  'Atividades Mistas',
];
export const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'] as const;
export type Regime = (typeof REGIMES)[number];
export const ATIVIDADES_ESPECIFICAS = ['Não', 'Monofásico', 'Substituição Tributária', 'Benefício Fiscal', 'ISS específico', 'Outros'];

export interface Empresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  estado: string;
  cnaePrincipal: string;
  cnaesSecundarios: string;
  atividadePrincipal: string;
  tipoAtividade: TipoAtividade;
  regimeAtual: Regime;
  atividadeEspecifica: string;
  periodoAnalise: string;
  usuarioResponsavel: string;
}

export interface Faturamento {
  meses: number[];
  categorias?: Record<string, number>;
}

export interface Folha {
  salarios: number;
  proLabore: number;
  inssPatronal: number;
  fgts: number;
  beneficios: number;
  encargos: number;
  outrasDespesasPessoal: number;
}

export interface Custos {
  mercadorias: number;
  cmv: number;
  materiaPrima: number;
  fretes: number;
  energia: number;
  insumos: number;
  servicosOperacao: number;
  outrosCustos: number;
  aluguel: number;
  administrativas: number;
  comerciais: number;
  financeiras: number;
  marketing: number;
  software: number;
  honorarios: number;
  depreciacao: number;
  outrasDespesas: number;
}

export interface Creditos {
  pisCofinsCompras: number;
  pisCofinsMateriaPrima: number;
  pisCofinsEnergia: number;
  pisCofinsFretes: number;
  pisCofinsServicosInsumos: number;
  pisCofinsAtivoImobilizado: number;
  pisCofinsOutros: number;
  icmsCompras: number;
  outrosCreditos: number;
}

export interface CompanyData {
  empresa: Empresa;
  faturamento: Faturamento;
  folha: Folha;
  custos: Custos;
  creditos: Creditos;
}

export const CUSTO_KEYS: (keyof Custos)[] = [
  'mercadorias', 'cmv', 'materiaPrima', 'fretes', 'energia', 'insumos', 'servicosOperacao', 'outrosCustos',
];
export const DESPESA_KEYS: (keyof Custos)[] = [
  'aluguel', 'administrativas', 'comerciais', 'financeiras', 'marketing', 'software', 'honorarios', 'depreciacao', 'outrasDespesas',
];
export const CREDITO_PISCOFINS_KEYS: (keyof Creditos)[] = [
  'pisCofinsCompras', 'pisCofinsMateriaPrima', 'pisCofinsEnergia', 'pisCofinsFretes',
  'pisCofinsServicosInsumos', 'pisCofinsAtivoImobilizado', 'pisCofinsOutros',
];

// ---------------- Agregados ----------------

export const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);
export const mediaMensal = (v: number[]) => soma(v) / (v.filter((x) => x > 0).length || 1);
export const totalFolha = (f: Folha) =>
  f.salarios + f.proLabore + f.inssPatronal + f.fgts + f.beneficios + f.encargos + f.outrasDespesasPessoal;
export const totalCustos = (c: Custos) => soma(CUSTO_KEYS.map((k) => c[k]));
export const totalDespesas = (c: Custos) => soma(DESPESA_KEYS.map((k) => c[k]));
export const baseCreditos = (c: Creditos) => soma(CREDITO_PISCOFINS_KEYS.map((k) => c[k]));

export function fatorR(folha: Folha, fat: Faturamento) {
  const r = soma(fat.meses);
  return r === 0 ? 0 : totalFolha(folha) / r;
}

export function resultadoOperacional(fat: Faturamento, custos: Custos, folha: Folha) {
  const receita = soma(fat.meses);
  const tc = totalCustos(custos);
  const td = totalDespesas(custos);
  const tf = totalFolha(folha);
  const resultado = receita - tc - td - tf;
  return { receita, totalCustos: tc, totalDespesas: td, totalFolha: tf, resultado, margem: receita > 0 ? resultado / receita : 0 };
}

const temISS = (t: TipoAtividade) => t === 'Serviços' || t === 'Comércio e Serviços' || t === 'Atividades Mistas';
const temICMS = (t: TipoAtividade) =>
  t === 'Comércio' || t === 'Indústria' || t === 'Indústria e Comércio' || t === 'Atividades Mistas';

// ---------------- Simples Nacional ----------------

export interface ResultadoSimples {
  rbt12: number;
  anexo: AnexoNome;
  faixa: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number;
  dasMensal: number;
  dasAnual: number;
  cargaEfetiva: number;
}

export function anexoAplicavel(tipo: TipoAtividade, fr: number, cfg: TaxConfig): AnexoNome {
  if (tipo === 'Comércio') return 'Anexo I - Comércio';
  if (tipo === 'Indústria' || tipo === 'Indústria e Comércio') return 'Anexo II - Indústria';
  return fr >= cfg.fatorRLimite ? 'Anexo III - Serviços (Fator R ≥ 28%)' : 'Anexo V - Serviços (Fator R < 28%)';
}

export function calcSimples(d: CompanyData, cfg: TaxConfig): ResultadoSimples {
  const rbt12 = soma(d.faturamento.meses);
  const anexo = anexoAplicavel(d.empresa.tipoAtividade, fatorR(d.folha, d.faturamento), cfg);
  const faixas = cfg.simples[anexo].faixas;
  let idx = faixas.length - 1;
  for (let i = 0; i < faixas.length; i++) {
    if (rbt12 <= faixas[i].limite) {
      idx = i;
      break;
    }
  }
  const f = faixas[idx];
  const aliquotaEfetiva = rbt12 > 0 ? (rbt12 * f.aliquota - f.deducao) / rbt12 : 0;
  const dasMensal = mediaMensal(d.faturamento.meses) * aliquotaEfetiva;
  const dasAnual = dasMensal * 12;
  return {
    rbt12,
    anexo,
    faixa: idx + 1,
    aliquotaNominal: f.aliquota,
    parcelaDeduzir: f.deducao,
    aliquotaEfetiva,
    dasMensal,
    dasAnual,
    cargaEfetiva: rbt12 > 0 ? dasAnual / rbt12 : 0,
  };
}

// ---------------- Lucro Presumido ----------------

export interface ResultadoPresumido {
  irpjMensal: number;
  adicionalIrpjMensal: number;
  csllMensal: number;
  pisMensal: number;
  cofinsMensal: number;
  issEstimado: number;
  icmsEstimado: number;
  inssPatronal: number;
  totalMensal: number;
  totalAnual: number;
  cargaTributaria: number;
  presuncaoIrpj: number;
  presuncaoCsll: number;
}

function presuncao(tipo: TipoAtividade, tabela: TaxConfig['presuncaoIrpj']) {
  if (tipo === 'Serviços') return tabela.servicos;
  if (tipo === 'Comércio') return tabela.comercio;
  if (tipo === 'Indústria') return tabela.industria;
  return tabela.outros;
}

export function calcPresumido(d: CompanyData, cfg: TaxConfig): ResultadoPresumido {
  const media = mediaMensal(d.faturamento.meses);
  const receita = soma(d.faturamento.meses);
  const tipo = d.empresa.tipoAtividade;
  const p = cfg.presumido;
  const pIrpj = presuncao(tipo, cfg.presuncaoIrpj);
  const pCsll = presuncao(tipo, cfg.presuncaoCsll);
  const baseIrpj = media * pIrpj;
  const baseCsll = media * pCsll;
  const irpjMensal = baseIrpj * p.irpj;
  const adicionalIrpjMensal = Math.max(0, baseIrpj - p.limiteAdicional) * p.adicionalIrpj;
  const csllMensal = baseCsll * p.csll;
  const pisMensal = media * p.pis;
  const cofinsMensal = media * p.cofins;
  const issEstimado = temISS(tipo) ? media * cfg.iss.padrao : 0;
  const icmsEstimado = temICMS(tipo) ? media * cfg.icmsPadrao : 0;
  const inssPatronal = d.folha.salarios * cfg.inssPatronal + d.folha.proLabore * cfg.inssPatronal;
  const totalMensal =
    irpjMensal + adicionalIrpjMensal + csllMensal + pisMensal + cofinsMensal + issEstimado + icmsEstimado + inssPatronal;
  const totalAnual = totalMensal * 12;
  return {
    irpjMensal,
    adicionalIrpjMensal,
    csllMensal,
    pisMensal,
    cofinsMensal,
    issEstimado,
    icmsEstimado,
    inssPatronal,
    totalMensal,
    totalAnual,
    cargaTributaria: receita > 0 ? totalAnual / receita : 0,
    presuncaoIrpj: pIrpj,
    presuncaoCsll: pCsll,
  };
}

// ---------------- Lucro Real ----------------

export interface ResultadoReal {
  lucroMensal: number;
  irpjMensal: number;
  adicionalIrpjMensal: number;
  csllMensal: number;
  pisMensal: number;
  cofinsMensal: number;
  creditosPis: number;
  creditosCofins: number;
  pisLiquido: number;
  cofinsLiquido: number;
  issEstimado: number;
  icmsEstimado: number;
  inssPatronal: number;
  totalMensal: number;
  totalAnual: number;
  cargaTributaria: number;
}

export function calcReal(d: CompanyData, cfg: TaxConfig): ResultadoReal {
  const media = mediaMensal(d.faturamento.meses);
  const receita = soma(d.faturamento.meses);
  const r = cfg.real;
  const custosMes = totalCustos(d.custos) / 12;
  const despesasMes = totalDespesas(d.custos) / 12;
  const folhaMes = totalFolha(d.folha) / 12;
  const lucroMensal = media - custosMes - despesasMes - folhaMes;
  const base = Math.max(0, lucroMensal);
  const irpjMensal = base * r.irpj;
  const adicionalIrpjMensal = Math.max(0, base - r.limiteAdicional) * r.adicionalIrpj;
  const csllMensal = base * r.csll;
  const pisMensal = media * r.pis;
  const cofinsMensal = media * r.cofins;
  const creditoBase = baseCreditos(d.creditos) / 12;
  const creditosPis = (creditoBase * r.pis) / (r.pis + r.cofins);
  const creditosCofins = (creditoBase * r.cofins) / (r.pis + r.cofins);
  const pisLiquido = Math.max(0, pisMensal - creditosPis);
  const cofinsLiquido = Math.max(0, cofinsMensal - creditosCofins);
  const tipo = d.empresa.tipoAtividade;
  const issEstimado = temISS(tipo) ? media * cfg.iss.padrao : 0;
  const icmsEstimado = temICMS(tipo) ? media * cfg.icmsPadrao : 0;
  const inssPatronal = d.folha.salarios * cfg.inssPatronal + d.folha.proLabore * cfg.inssPatronal;
  const totalMensal =
    irpjMensal + adicionalIrpjMensal + csllMensal + pisLiquido + cofinsLiquido + issEstimado + icmsEstimado + inssPatronal;
  const totalAnual = totalMensal * 12;
  return {
    lucroMensal,
    irpjMensal,
    adicionalIrpjMensal,
    csllMensal,
    pisMensal,
    cofinsMensal,
    creditosPis,
    creditosCofins,
    pisLiquido,
    cofinsLiquido,
    issEstimado,
    icmsEstimado,
    inssPatronal,
    totalMensal,
    totalAnual,
    cargaTributaria: receita > 0 ? totalAnual / receita : 0,
  };
}

// ---------------- Reforma Tributária (estimativa de referência) ----------------

export function calcReforma(d: CompanyData, cfg: TaxConfig) {
  const receita = soma(d.faturamento.meses);
  const aliq = cfg.reforma.cbs + cfg.reforma.ibs;
  const debito = receita * aliq;
  const credito = baseCreditos(d.creditos) * aliq;
  const seletivo = receita * cfg.reforma.seletivo;
  const liquido = Math.max(0, debito - credito) + seletivo;
  return { aliquota: aliq, debito, credito, seletivo, liquido, carga: receita > 0 ? liquido / receita : 0 };
}

// ---------------- Consolidado ----------------

export interface Resultados {
  simples: ResultadoSimples;
  presumido: ResultadoPresumido;
  real: ResultadoReal;
}

export function calcTodos(d: CompanyData, cfg: TaxConfig): Resultados {
  return { simples: calcSimples(d, cfg), presumido: calcPresumido(d, cfg), real: calcReal(d, cfg) };
}

export interface RegimeResumo {
  name: Regime;
  mensal: number;
  anual: number;
  carga: number;
  color: string;
  page: string;
}

export const REGIME_COLORS: Record<Regime, string> = {
  'Simples Nacional': 'var(--c-simples)',
  'Lucro Presumido': 'var(--c-presumido)',
  'Lucro Real': 'var(--c-real)',
};

export function resumoRegimes(r: Resultados): RegimeResumo[] {
  return [
    {
      name: 'Simples Nacional',
      mensal: r.simples.dasMensal,
      anual: r.simples.dasAnual,
      carga: r.simples.cargaEfetiva,
      color: REGIME_COLORS['Simples Nacional'],
      page: 'simples-nacional',
    },
    {
      name: 'Lucro Presumido',
      mensal: r.presumido.totalMensal,
      anual: r.presumido.totalAnual,
      carga: r.presumido.cargaTributaria,
      color: REGIME_COLORS['Lucro Presumido'],
      page: 'lucro-presumido',
    },
    {
      name: 'Lucro Real',
      mensal: r.real.totalMensal,
      anual: r.real.totalAnual,
      carga: r.real.cargaTributaria,
      color: REGIME_COLORS['Lucro Real'],
      page: 'lucro-real',
    },
  ];
}

export const menorCarga = (rs: RegimeResumo[]) => rs.reduce((a, b) => (a.anual <= b.anual ? a : b));

export function scaleData(d: CompanyData, v: { fat: number; folha: number; custos: number; creditos: number }): CompanyData {
  const m = (x: number) => 1 + x / 100;
  const mapObj = <T extends object>(o: T, k: number) =>
    Object.fromEntries(Object.entries(o).map(([key, val]) => [key, typeof val === 'number' ? val * k : val])) as T;
  return {
    empresa: d.empresa,
    faturamento: { ...d.faturamento, meses: d.faturamento.meses.map((x) => x * m(v.fat)) },
    folha: mapObj(d.folha, m(v.folha)),
    custos: mapObj(d.custos, m(v.custos)),
    creditos: mapObj(d.creditos, m(v.creditos)),
  };
}

// ---------------- Dados iniciais ----------------

export function emptyCompany(responsavel = ''): CompanyData {
  return {
    empresa: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      cidade: '',
      estado: 'SP',
      cnaePrincipal: '',
      cnaesSecundarios: '',
      atividadePrincipal: '',
      tipoAtividade: 'Comércio',
      regimeAtual: 'Simples Nacional',
      atividadeEspecifica: 'Não',
      periodoAnalise: String(new Date().getFullYear()),
      usuarioResponsavel: responsavel,
    },
    faturamento: { meses: Array(12).fill(0) },
    folha: { salarios: 0, proLabore: 0, inssPatronal: 0, fgts: 0, beneficios: 0, encargos: 0, outrasDespesasPessoal: 0 },
    custos: {
      mercadorias: 0, cmv: 0, materiaPrima: 0, fretes: 0, energia: 0, insumos: 0, servicosOperacao: 0, outrosCustos: 0,
      aluguel: 0, administrativas: 0, comerciais: 0, financeiras: 0, marketing: 0, software: 0, honorarios: 0, depreciacao: 0, outrasDespesas: 0,
    },
    creditos: {
      pisCofinsCompras: 0, pisCofinsMateriaPrima: 0, pisCofinsEnergia: 0, pisCofinsFretes: 0, pisCofinsServicosInsumos: 0,
      pisCofinsAtivoImobilizado: 0, pisCofinsOutros: 0, icmsCompras: 0, outrosCreditos: 0,
    },
  };
}

export function exampleCompany(responsavel = 'Contador Responsável'): CompanyData {
  return {
    empresa: {
      razaoSocial: 'Empresa Exemplo Ltda',
      nomeFantasia: 'Exemplo',
      cnpj: '12.345.678/0001-90',
      cidade: 'São Paulo',
      estado: 'SP',
      cnaePrincipal: '4751-2/01',
      cnaesSecundarios: '',
      atividadePrincipal: 'Comércio de equipamentos de informática',
      tipoAtividade: 'Comércio',
      regimeAtual: 'Simples Nacional',
      atividadeEspecifica: 'Não',
      periodoAnalise: '2024',
      usuarioResponsavel: responsavel,
    },
    faturamento: { meses: [150000, 148000, 162000, 155000, 160000, 145000, 158000, 172000, 165000, 155000, 170000, 210000] },
    folha: { salarios: 230000, proLabore: 36000, inssPatronal: 63800, fgts: 26400, beneficios: 21600, encargos: 18000, outrasDespesasPessoal: 9600 },
    custos: {
      mercadorias: 720000, cmv: 0, materiaPrima: 0, fretes: 36000, energia: 24000, insumos: 12000, servicosOperacao: 18000, outrosCustos: 12000,
      aluguel: 60000, administrativas: 24000, comerciais: 48000, financeiras: 12000, marketing: 24000, software: 18000, honorarios: 24000, depreciacao: 12000, outrasDespesas: 6000,
    },
    creditos: {
      pisCofinsCompras: 720000, pisCofinsMateriaPrima: 0, pisCofinsEnergia: 24000, pisCofinsFretes: 36000, pisCofinsServicosInsumos: 18000,
      pisCofinsAtivoImobilizado: 0, pisCofinsOutros: 0, icmsCompras: 86400, outrosCreditos: 0,
    },
  };
}
