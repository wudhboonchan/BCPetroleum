import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { auth } from './lib/auth.js';
import { ToastProvider } from './components/Toast.jsx';
import TopBar from './components/TopBar.jsx';
import Loading from './components/Loading.jsx';

const Login      = lazy(() => import('./pages/Login.jsx'));
const Dashboard  = lazy(() => import('./pages/Dashboard.jsx'));
const Daily      = lazy(() => import('./pages/Daily.jsx'));
const Credit     = lazy(() => import('./pages/Credit.jsx'));
const Cash       = lazy(() => import('./pages/Cash.jsx'));
const Accounting = lazy(() => import('./pages/Accounting.jsx'));
const Customers  = lazy(() => import('./pages/Customers.jsx'));
const Reports       = lazy(() => import('./pages/Reports.jsx'));
const PublicInvoice = lazy(() => import('./pages/PublicInvoice.jsx'));

function RequireAuth({ children }) {
  return auth.isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  return (
    <>
      <TopBar />
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <RequireAuth>
                <Layout><Dashboard /></Layout>
              </RequireAuth>
            } />
            <Route path="/daily" element={
              <RequireAuth><Layout><Daily /></Layout></RequireAuth>
            } />
            <Route path="/credit" element={
              <RequireAuth><Layout><Credit /></Layout></RequireAuth>
            } />
            <Route path="/cash" element={
              <RequireAuth><Layout><Cash /></Layout></RequireAuth>
            } />
            <Route path="/accounting" element={
              <RequireAuth><Layout><Accounting /></Layout></RequireAuth>
            } />
            <Route path="/customers" element={
              <RequireAuth><Layout><Customers /></Layout></RequireAuth>
            } />
            <Route path="/reports" element={
              <RequireAuth><Layout><Reports /></Layout></RequireAuth>
            } />
            {/* Public — ไม่ต้อง login */}
            <Route path="/invoice/:id" element={
              <Suspense fallback={<Loading />}><PublicInvoice /></Suspense>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
