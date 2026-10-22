import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Alert, Button, Empty, Spinner, ToastProvider } from './components/ui';
import { PAGES, type PageId } from './lib/pages';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovaAnalise from './pages/NovaAnalise';
import Empresas from './pages/Empresas';
import Faturamento from './pages/Faturamento';
import Folha from './pages/Folha';
import Custos from './pages/Custos';
import Creditos from './pages/Creditos';
import SimplesNacional from './pages/SimplesNacional';
import LucroPresumido from './pages/LucroPresumido';
import LucroReal from './pages/LucroReal';
import Comparativo from './pages/Comparativo';
import Cenarios from './pages/Cenarios';
import Diagnostico from './pages/Diagnostico';
import Relatorio from './pages/Relatorio';
import Configuracoes from './pages/Configuracoes';
import Assinatura from './pages/Assinatura';
import Perfil from './pages/Perfil';
import AdminDashboard from './pages/admin/AdminDashboard';
import Usuarios from './pages/admin/Usuarios';
import Planos from './pages/admin/Planos';
import Faturas from './pages/admin/Faturas';
import Cora from './pages/admin/Cora';
import Sistema from './pages/admin/Sistema';

const SCREENS: Record<PageId, () => ReactElement> = {
  dashboard: Dashboard,
  'nova-analise': NovaAnalise,
  empresas: Empresas,
  faturamento: Faturamento,
  folha: Folha,
  custos: Custos,
  creditos: Creditos,
  'simples-nacional': SimplesNacional,
  'lucro-presumido': LucroPresumido,
  'lucro-real': LucroReal,
  comparativo: Comparativo,
  cenarios: Cenarios,
  diagnostico: Diagnostico,
  relatorio: Relatorio,
  configuracoes: Configuracoes,
};

/** Tela do sistema: exige assinatura ativa, permissão e dados carregados. */
function Screen({ id }: { id: PageId }) {
  const { session, can } = useAuth();
  const app = useApp();
  if (!session!.access.hasAccess) return <Navigate to="/assinatura" replace />;
  if (!can(id)) return <Navigate to="/sem-acesso" replace />;
  if (app.error)
    return (
      <Alert tone="danger" title="Não foi possível carregar seus dados">
        {app.error}{' '}
        <Button size="sm" variant="outline" className="ml-2" onClick={app.reload}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!app.ready) return <Spinner />;
  const C = SCREENS[id];
  return <C />;
}

function Home() {
  const { session, can, isAdmin } = useAuth();
  if (!session!.access.hasAccess) return <Navigate to="/assinatura" replace />;
  const first = PAGES.find((p) => can(p.id));
  if (first) return <Navigate to={`/${first.id}`} replace />;
  return <Navigate to={isAdmin ? '/admin' : '/sem-acesso'} replace />;
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function NoAccess() {
  return (
    <Empty icon={<Lock size={28} />} title="Você não tem permissão para acessar esta tela.">
      Solicite a liberação ao administrador do sistema.
    </Empty>
  );
}

function Shell() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner />;
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Login />} />
        <Route path="/setup" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  const isAppPage = PAGES.some((p) => pathname === `/${p.id}`);
  return (
    <Layout showCompany={isAppPage && session.access.hasAccess}>
      <Routes>
        <Route path="/" element={<Home />} />
        {PAGES.map((p) => (
          <Route key={p.id} path={`/${p.id}`} element={<Screen id={p.id} />} />
        ))}
        <Route path="/assinatura" element={session.user.role === 'admin' ? <Navigate to="/admin/faturas" replace /> : <Assinatura />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/sem-acesso" element={<NoAccess />} />
        <Route path="/admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
        <Route path="/admin/usuarios" element={<AdminOnly><Usuarios /></AdminOnly>} />
        <Route path="/admin/planos" element={<AdminOnly><Planos /></AdminOnly>} />
        <Route path="/admin/faturas" element={<AdminOnly><Faturas /></AdminOnly>} />
        <Route path="/admin/cora" element={<AdminOnly><Cora /></AdminOnly>} />
        <Route path="/admin/sistema" element={<AdminOnly><Sistema /></AdminOnly>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/cadastro" element={<Navigate to="/" replace />} />
        <Route path="/setup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <Shell />
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
