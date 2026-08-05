import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import AdminShell from './layouts/AdminShell';
import SalesShell from './layouts/SalesShell';
import FinanceShell from './layouts/FinanceShell';
import FinanceHeadShell from './layouts/FinanceHeadShell';

import AdminHomePage from './pages/admin/AdminHomePage';
import AllBlockingsPage from './pages/admin/AllBlockingsPage';
import StockAdminPage from './pages/admin/StockAdminPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import ConfigPage from './pages/admin/ConfigPage';
import UsersPage from './pages/admin/UsersPage';
import BranchesPage from './pages/admin/BranchesPage';
import CarsPage from './pages/admin/CarsPage';
import VehicleRequestsPage from './pages/admin/VehicleRequestsPage';

import HeatmapPage from './pages/sales/HeatmapPage';
import BlockPage from './pages/sales/BlockPage';
import MyBlockingsPage from './pages/sales/MyBlockingsPage';
import OffersPage from './pages/sales/OffersPage';

import FinanceDashboardPage from './pages/finance/FinanceDashboardPage';
import FinanceHeadPage from './pages/finance/FinanceHeadPage';
import ClusterManagerShell from './layouts/ClusterManagerShell';
import ClusterManagerPage from './pages/cluster/ClusterManagerPage';
import CEOShell from './layouts/CEOShell';
import CEOPage from './pages/ceo/CEOPage';
import DeliveryShell from './layouts/DeliveryShell';
import DeliveryInchargePage from './pages/delivery/DeliveryInchargePage';
import InsuranceShell from './layouts/InsuranceShell';
import InsurancePage from './pages/insurance/InsurancePage';
import AccountsShell from './layouts/AccountsShell';
import AccountsDeptPage from './pages/accounts/AccountsDeptPage';

function RequireAuth({ children, role }: { children: JSX.Element; role?: string | string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <RequireAuth role="ADMIN">
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<AdminHomePage />} />
        <Route path="blockings" element={<AllBlockingsPage />} />
        <Route path="stock" element={<StockAdminPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="vehicle-requests" element={<VehicleRequestsPage />} />
      </Route>

      {/* Sales Manager + Team Leader routes */}
      <Route
        path="/sales"
        element={
          <RequireAuth role={['SALES_MANAGER', 'TEAM_LEADER']}>
            <SalesShell />
          </RequireAuth>
        }
      >
        <Route index element={<HeatmapPage />} />
        <Route path="block" element={<BlockPage />} />
        <Route path="my-blockings" element={<MyBlockingsPage />} />
        <Route path="offers" element={<OffersPage />} />
      </Route>

      {/* Finance Officer routes */}
      <Route
        path="/finance"
        element={
          <RequireAuth role="FINANCE_OFFICER">
            <FinanceShell />
          </RequireAuth>
        }
      >
        <Route index element={<FinanceDashboardPage />} />
      </Route>

      {/* Finance Head routes */}
      <Route
        path="/finance-head"
        element={
          <RequireAuth role="FINANCE_HEAD">
            <FinanceHeadShell />
          </RequireAuth>
        }
      >
        <Route index element={<FinanceHeadPage />} />
      </Route>

      {/* Cluster Manager routes */}
      <Route
        path="/cluster"
        element={
          <RequireAuth role="CLUSTER_MANAGER">
            <ClusterManagerShell />
          </RequireAuth>
        }
      >
        <Route index element={<ClusterManagerPage />} />
      </Route>

      {/* CEO routes */}
      <Route
        path="/ceo"
        element={
          <RequireAuth role="CEO">
            <CEOShell />
          </RequireAuth>
        }
      >
        <Route index element={<CEOPage />} />
      </Route>

      {/* Delivery Incharge routes */}
      <Route
        path="/delivery"
        element={
          <RequireAuth role="DELIVERY_INCHARGE">
            <DeliveryShell />
          </RequireAuth>
        }
      >
        <Route index element={<DeliveryInchargePage />} />
      </Route>

      {/* Insurance routes */}
      <Route
        path="/insurance"
        element={
          <RequireAuth role="INSURANCE">
            <InsuranceShell />
          </RequireAuth>
        }
      >
        <Route index element={<InsurancePage />} />
      </Route>

      {/* Accounts Dept routes */}
      <Route
        path="/accounts"
        element={
          <RequireAuth role="ACCOUNTS_DEPT">
            <AccountsShell />
          </RequireAuth>
        }
      >
        <Route index element={<AccountsDeptPage />} />
      </Route>

      {/* Root redirect — role-aware */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'ADMIN'              ? <Navigate to="/admin"        replace /> :
            user.role === 'FINANCE_OFFICER'    ? <Navigate to="/finance"      replace /> :
            user.role === 'FINANCE_HEAD'       ? <Navigate to="/finance-head" replace /> :
            user.role === 'CLUSTER_MANAGER'    ? <Navigate to="/cluster"      replace /> :
            user.role === 'CEO'                ? <Navigate to="/ceo"          replace /> :
            user.role === 'DELIVERY_INCHARGE'  ? <Navigate to="/delivery"     replace /> :
            user.role === 'INSURANCE'          ? <Navigate to="/insurance"    replace /> :
            user.role === 'ACCOUNTS_DEPT'      ? <Navigate to="/accounts"     replace /> :
            user.role === 'TEAM_LEADER'        ? <Navigate to="/sales"        replace /> :
                                                 <Navigate to="/sales"        replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
