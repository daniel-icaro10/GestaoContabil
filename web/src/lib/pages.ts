import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  GitCompare,
  LayoutDashboard,
  PlusCircle,
  ReceiptText,
  Scale,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'nova-analise'
  | 'empresas'
  | 'faturamento'
  | 'folha'
  | 'custos'
  | 'creditos'
  | 'simples-nacional'
  | 'lucro-presumido'
  | 'lucro-real'
  | 'comparativo'
  | 'cenarios'
  | 'diagnostico'
  | 'relatorio'
  | 'configuracoes';

export type ModuleId = 'principal' | 'dados-financeiros' | 'simulacoes' | 'analise' | 'relatorios' | 'configuracoes';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
}

/** Módulos que o admin libera para cada usuário. Cada tela pertence a um módulo. */
export const MODULES: ModuleDef[] = [
  { id: 'principal', label: 'Principal', description: 'Dashboard, nova análise e cadastro de empresas' },
  { id: 'dados-financeiros', label: 'Dados Financeiros', description: 'Faturamento, folha, custos e créditos' },
  { id: 'simulacoes', label: 'Simulações', description: 'Simples Nacional, Lucro Presumido e Lucro Real' },
  { id: 'analise', label: 'Análise', description: 'Comparativo, cenários e diagnóstico' },
  { id: 'relatorios', label: 'Relatórios', description: 'Relatórios para impressão e PDF' },
  { id: 'configuracoes', label: 'Configurações', description: 'Parâmetros tributários do usuário' },
];

export interface PageDef {
  id: PageId;
  label: string;
  icon: LucideIcon;
  module: ModuleId;
}

export const PAGES: PageDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'principal' },
  { id: 'nova-analise', label: 'Nova Análise', icon: PlusCircle, module: 'principal' },
  { id: 'empresas', label: 'Empresas', icon: Building2, module: 'principal' },
  { id: 'faturamento', label: 'Faturamento', icon: TrendingUp, module: 'dados-financeiros' },
  { id: 'folha', label: 'Folha de Pagamento', icon: UsersRound, module: 'dados-financeiros' },
  { id: 'custos', label: 'Custos e Despesas', icon: ReceiptText, module: 'dados-financeiros' },
  { id: 'creditos', label: 'Créditos Tributários', icon: CreditCard, module: 'dados-financeiros' },
  { id: 'simples-nacional', label: 'Simples Nacional', icon: FileText, module: 'simulacoes' },
  { id: 'lucro-presumido', label: 'Lucro Presumido', icon: BarChart3, module: 'simulacoes' },
  { id: 'lucro-real', label: 'Lucro Real', icon: Scale, module: 'simulacoes' },
  { id: 'comparativo', label: 'Comparativo', icon: GitCompare, module: 'analise' },
  { id: 'cenarios', label: 'Cenários', icon: SlidersHorizontal, module: 'analise' },
  { id: 'diagnostico', label: 'Diagnóstico', icon: ClipboardList, module: 'analise' },
  { id: 'relatorio', label: 'Relatórios', icon: FileText, module: 'relatorios' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, module: 'configuracoes' },
];


export const modulePages = (id: ModuleId) => PAGES.filter((p) => p.module === id);
export const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;
export const pageLabel = (id: string) => PAGES.find((p) => p.id === id)?.label ?? id;
