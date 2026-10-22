import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import {
  calcTodos,
  exampleCompany,
  emptyCompany,
  mergeTaxConfig,
  type CompanyData,
  type Creditos,
  type Custos,
  type Empresa,
  type Faturamento,
  type Folha,
  type Resultados,
  type TaxConfig,
} from '../lib/tax';
import { useAuth } from './AuthContext';

export interface CompanyRecord extends CompanyData {
  id: number;
  createdAt: string;
  updatedAt: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AppCtx {
  ready: boolean;
  error: string | null;
  companies: CompanyRecord[];
  current: CompanyRecord | null;
  data: CompanyData;
  results: Resultados;
  taxConfig: TaxConfig;
  saveState: SaveState;
  novaAnaliseStep: number;
  setNovaAnaliseStep(n: number): void;
  setEmpresa(p: Partial<Empresa>): void;
  setFaturamento(p: Partial<Faturamento>): void;
  setFolha(p: Partial<Folha>): void;
  setCustos(p: Partial<Custos>): void;
  setCreditos(p: Partial<Creditos>): void;
  createCompany(data?: CompanyData): Promise<CompanyRecord>;
  selectCompany(id: number): Promise<void>;
  deleteCompany(id: number): Promise<void>;
  saveTaxConfig(cfg: TaxConfig | null): Promise<void>;
  reload(): Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

const strip = (c: CompanyRecord): CompanyData => ({
  empresa: c.empresa,
  faturamento: c.faturamento,
  folha: c.folha,
  custos: c.custos,
  creditos: c.creditos,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => mergeTaxConfig(null));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [novaAnaliseStep, setNovaAnaliseStep] = useState(0);
  const dirty = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companiesRef = useRef(companies);
  companiesRef.current = companies;

  const enabled = Boolean(session?.access.hasAccess);
  const userName = session?.user.name ?? '';

  const reload = useCallback(async () => {
    setError(null);
    try {
      let [list, cfg] = await Promise.all([api<CompanyRecord[]>('/companies'), api<TaxConfig | null>('/tax-config')]);
      if (list.length === 0) {
        // Primeiro acesso: cria uma análise de exemplo para o usuário explorar o sistema.
        const created = await api<CompanyRecord>('/companies', { body: exampleCompany(userName || undefined) });
        list = [created];
      }
      setCompanies(list);
      setTaxConfig(mergeTaxConfig(cfg));
      const preferred = session?.user.currentCompanyId;
      setCurrentId(list.some((c) => c.id === preferred) ? preferred! : list[0].id);
      setReady(true);
    } catch (e: any) {
      setError(e.message);
    }
  }, [session?.user.currentCompanyId, userName]);

  useEffect(() => {
    if (enabled) reload();
    else {
      setReady(false);
      setCompanies([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.user.id]);

  const flush = useCallback(async () => {
    const ids = [...dirty.current];
    dirty.current.clear();
    if (!ids.length) return;
    setSaveState('saving');
    try {
      for (const id of ids) {
        const c = companiesRef.current.find((x) => x.id === id);
        if (!c) continue;
        const saved = await api<CompanyRecord>(`/companies/${id}`, { method: 'PUT', body: strip(c) });
        setCompanies((list) => list.map((x) => (x.id === id ? { ...x, updatedAt: saved.updatedAt } : x)));
      }
      setSaveState('saved');
    } catch {
      ids.forEach((id) => dirty.current.add(id));
      setSaveState('error');
    }
  }, []);

  useEffect(() => {
    const onUnload = () => {
      if (dirty.current.size) flush();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [flush]);

  const patchCurrent = useCallback(
    (fn: (c: CompanyRecord) => CompanyRecord) => {
      if (currentId == null) return;
      setCompanies((list) => list.map((c) => (c.id === currentId ? fn(c) : c)));
      dirty.current.add(currentId);
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [currentId, flush],
  );

  const current = companies.find((c) => c.id === currentId) ?? null;
  const data = useMemo(() => (current ? strip(current) : emptyCompany()), [current]);
  const results = useMemo(() => calcTodos(data, taxConfig), [data, taxConfig]);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      error,
      companies,
      current,
      data,
      results,
      taxConfig,
      saveState,
      novaAnaliseStep,
      setNovaAnaliseStep,
      setEmpresa: (p) => patchCurrent((c) => ({ ...c, empresa: { ...c.empresa, ...p } })),
      setFaturamento: (p) => patchCurrent((c) => ({ ...c, faturamento: { ...c.faturamento, ...p } })),
      setFolha: (p) => patchCurrent((c) => ({ ...c, folha: { ...c.folha, ...p } })),
      setCustos: (p) => patchCurrent((c) => ({ ...c, custos: { ...c.custos, ...p } })),
      setCreditos: (p) => patchCurrent((c) => ({ ...c, creditos: { ...c.creditos, ...p } })),
      async createCompany(d) {
        await flush();
        const created = await api<CompanyRecord>('/companies', { body: d ?? emptyCompany(userName) });
        setCompanies((list) => [created, ...list]);
        setCurrentId(created.id);
        return created;
      },
      async selectCompany(id) {
        await flush();
        setCurrentId(id);
        await api(`/companies/${id}/select`, { method: 'PUT' });
      },
      async deleteCompany(id) {
        await api(`/companies/${id}`, { method: 'DELETE' });
        dirty.current.delete(id);
        const rest = companiesRef.current.filter((c) => c.id !== id);
        if (rest.length === 0) {
          const created = await api<CompanyRecord>('/companies', { body: emptyCompany(userName) });
          setCompanies([created]);
          setCurrentId(created.id);
          return;
        }
        setCompanies(rest);
        if (currentId === id) setCurrentId(rest[0].id);
      },
      async saveTaxConfig(cfg) {
        await api('/tax-config', { method: 'PUT', body: cfg });
        setTaxConfig(mergeTaxConfig(cfg));
      },
      reload,
    }),
    [ready, error, companies, current, data, results, taxConfig, saveState, novaAnaliseStep, patchCurrent, flush, userName, currentId, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp deve ser usado dentro de AppProvider');
  return c;
}
