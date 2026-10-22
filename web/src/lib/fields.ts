import type { Creditos, Custos, Folha } from './tax';

export const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#84cc16'];

export const FOLHA_FIELDS: { key: keyof Folha; label: string }[] = [
  { key: 'salarios', label: 'Salários' },
  { key: 'proLabore', label: 'Pró-labore' },
  { key: 'inssPatronal', label: 'INSS Patronal' },
  { key: 'fgts', label: 'FGTS' },
  { key: 'beneficios', label: 'Benefícios' },
  { key: 'encargos', label: 'Encargos' },
  { key: 'outrasDespesasPessoal', label: 'Outras despesas com pessoal' },
];

export const CUSTO_FIELDS: { key: keyof Custos; label: string }[] = [
  { key: 'mercadorias', label: 'Mercadorias' },
  { key: 'cmv', label: 'CMV' },
  { key: 'materiaPrima', label: 'Matéria-prima' },
  { key: 'fretes', label: 'Fretes' },
  { key: 'energia', label: 'Energia' },
  { key: 'insumos', label: 'Insumos' },
  { key: 'servicosOperacao', label: 'Serviços de operação' },
  { key: 'outrosCustos', label: 'Outros custos' },
];

export const DESPESA_FIELDS: { key: keyof Custos; label: string }[] = [
  { key: 'aluguel', label: 'Aluguel' },
  { key: 'administrativas', label: 'Despesas administrativas' },
  { key: 'comerciais', label: 'Despesas comerciais' },
  { key: 'financeiras', label: 'Despesas financeiras' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'software', label: 'Software / TI' },
  { key: 'honorarios', label: 'Honorários contábeis' },
  { key: 'depreciacao', label: 'Depreciação' },
  { key: 'outrasDespesas', label: 'Outras despesas' },
];

export const CREDITO_FIELDS: { key: keyof Creditos; label: string; tip?: string }[] = [
  { key: 'pisCofinsCompras', label: 'Compras para revenda', tip: 'Base para crédito de PIS/COFINS' },
  { key: 'pisCofinsMateriaPrima', label: 'Matéria-prima' },
  { key: 'pisCofinsEnergia', label: 'Energia elétrica' },
  { key: 'pisCofinsFretes', label: 'Fretes' },
  { key: 'pisCofinsServicosInsumos', label: 'Serviços classificados como insumos' },
  { key: 'pisCofinsAtivoImobilizado', label: 'Ativo imobilizado' },
  { key: 'pisCofinsOutros', label: 'Outras bases de crédito' },
  { key: 'icmsCompras', label: 'ICMS nas compras' },
  { key: 'outrosCreditos', label: 'Outros créditos' },
];
