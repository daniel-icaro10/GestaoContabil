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

export interface PageDef {
  id: PageId;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const PAGES: PageDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Principal' },
  { id: 'nova-analise', label: 'Nova Análise', icon: PlusCircle, group: 'Principal' },
  { id: 'empresas', label: 'Empresas', icon: Building2, group: 'Principal' },
  { id: 'faturamento', label: 'Faturamento', icon: TrendingUp, group: 'Dados Financeiros' },
  { id: 'folha', label: 'Folha de Pagamento', icon: UsersRound, group: 'Dados Financeiros' },
  { id: 'custos', label: 'Custos e Despesas', icon: ReceiptText, group: 'Dados Financeiros' },
  { id: 'creditos', label: 'Créditos Tributários', icon: CreditCard, group: 'Dados Financeiros' },
  { id: 'simples-nacional', label: 'Simples Nacional', icon: FileText, group: 'Simulações' },
  { id: 'lucro-presumido', label: 'Lucro Presumido', icon: BarChart3, group: 'Simulações' },
  { id: 'lucro-real', label: 'Lucro Real', icon: Scale, group: 'Simulações' },
  { id: 'comparativo', label: 'Comparativo', icon: GitCompare, group: 'Análise' },
  { id: 'cenarios', label: 'Cenários', icon: SlidersHorizontal, group: 'Análise' },
  { id: 'diagnostico', label: 'Diagnóstico', icon: ClipboardList, group: 'Análise' },
  { id: 'relatorio', label: 'Relatórios', icon: FileText, group: 'Saída' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, group: 'Sistema' },
];

export const PAGE_GROUPS = ['Principal', 'Dados Financeiros', 'Simulações', 'Análise', 'Saída', 'Sistema'];

export const pageLabel = (id: string) => PAGES.find((p) => p.id === id)?.label ?? id;
