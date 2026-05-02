import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import AdminShell from './layouts/AdminShell';
import SalesShell from './layouts/SalesShell';

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

function RequireAuth({ children, role }: { children: JSX.Element; role?: string }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
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

      {/* Sales Manager routes */}
      <Route
        path="/sales"
        element={
          <RequireAuth role="SALES_MANAGER">
            <SalesShell />
          </RequireAuth>
        }
      >
        <Route index element={<HeatmapPage />} />
        <Route path="block" element={<BlockPage />} />
        <Route path="my-blockings" element={<MyBlockingsPage />} />
      </Route>

      {/* Root redirect */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'ADMIN' ? <Navigate to="/admin" replace /> : <Navigate to="/sales" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
