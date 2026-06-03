import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { auth } from './lib/auth.js';
import { ToastProvider } from './components/Toast.jsx';
import TopBar from './components/TopBar.jsx';
import Login      from './pages/Login.jsx';
import Dashboard  from './pages/Dashboard.jsx';
import Daily      from './pages/Daily.jsx';
import Credit     from './pages/Credit.jsx';
import Cash       from './pages/Cash.jsx';
import Accounting from './pages/Accounting.jsx';
import Customers  from './pages/Customers.jsx';
import Reports       from './pages/Reports.jsx';
import PublicInvoice from './pages/PublicInvoice.jsx';

function RequireAuth({ children }) {
  return auth.isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function AppShell() {
  const location = useLocation();
  const noBar = location.pathname === '/login' || location.pathname.startsWith('/invoice/');

  return (
    <>
      {!noBar && auth.isAuthenticated() && <TopBar />}
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/daily" element={<RequireAuth><Daily /></RequireAuth>} />
          <Route path="/credit" element={<RequireAuth><Credit /></RequireAuth>} />
          <Route path="/cash" element={<RequireAuth><Cash /></RequireAuth>} />
          <Route path="/accounting" element={<RequireAuth><Accounting /></RequireAuth>} />
          <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/invoice/:id" element={<PublicInvoice />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
