import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './components/wms/Layout';
import Dashboard from './pages/Dashboard';
import ReceptionRequests from './pages/ReceptionRequests';
import AssemblyOrders from './pages/AssemblyOrders';
import InventoryPage from './pages/InventoryPage';
import ShipmentsPage from './pages/ShipmentsPage';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
import StatsPage from './pages/StatsPage';
import LogsPage from './pages/LogsPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import IncomingFlowDashboard from './pages/IncomingFlowDashboard';
import OutgoingFlowDashboard from './pages/OutgoingFlowDashboard';
import UsersManagement from './pages/UsersManagement';
import IncomingReceptions from './pages/IncomingReceptions';
import IncomingReturns from './pages/IncomingReturns';
import NewReceptionRequest from './pages/NewReceptionRequest';
import ReceptionRequestDetail from './pages/ReceptionRequestDetail';
import ErrorBoundary from './lib/ErrorBoundary';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incoming-flow" element={<IncomingFlowDashboard />} />
        <Route path="/incoming-flow/new" element={
          <ErrorBoundary>
            <NewReceptionRequest />
          </ErrorBoundary>
        } />
        <Route path="/incoming-flow/:id" element={<ReceptionRequestDetail />} />
        <Route path="/outgoing-flow" element={<OutgoingFlowDashboard />} />
        <Route path="/security" element={<UsersManagement />} />
        <Route path="/reception" element={<ReceptionRequests />} />
        <Route path="/incoming-receptions" element={
          <ErrorBoundary>
            <IncomingReceptions />
          </ErrorBoundary>
        } />
        <Route path="/incoming-returns" element={
          <ErrorBoundary>
            <IncomingReturns />
          </ErrorBoundary>
        } />
        <Route path="/assembly" element={<AssemblyOrders />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App