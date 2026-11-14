import React, { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { SplashScreen } from './components/SplashScreen';
import { LoginPage } from './components/LoginPage';
import { AppLayout } from './components/AppLayout';
import { ReceiptModal } from './components/ReceiptModal';
import { DashboardPage } from './pages/DashboardPage';
import { BillingPage } from './pages/BillingPage';
import { OrdersPage } from './pages/OrdersPage';
import { SalesPage } from './pages/SalesPage';
import { ProductsPage } from './pages/ProductsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { ModuleKey, ReceiptData } from './types';

const VALID_MODULES: ModuleKey[] = [
  'home',
  'billing',
  'orders',
  'sales',
  'products',
  'expenses',
  'settings',
];

function parseRouteFromPathname(pathname: string): { page: ModuleKey | 'not-found' } {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '' || clean === '/') {
    return { page: 'billing' };
  }
  const segment = clean.slice(1) as ModuleKey;
  if (VALID_MODULES.includes(segment)) {
    return { page: segment };
  }
  return { page: 'not-found' };
}

function EasyBillRouter() {
  const { user, loading, hasPermission } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [routeState, setRouteState] = useState<{ page: ModuleKey | 'not-found' }>(() =>
    parseRouteFromPathname(window.location.pathname)
  );
  const [activeReceipt, setActiveReceipt] = useState<{
    data: ReceiptData;
    autoPrint: boolean;
  } | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setRouteState(parseRouteFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const handlePrintReceipt = useCallback((receipt: ReceiptData, autoPrint = false) => {
    setActiveReceipt({ data: receipt, autoPrint });
  }, []);

  const handleNavigate = useCallback(
    (page: ModuleKey) => {
      if (!hasPermission(page)) return;
      const targetPath = page === 'billing' ? '/billing' : `/${page}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      setRouteState({ page });
    },
    [hasPermission]
  );

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7FB] dark:bg-[#13101C] text-sm font-medium text-[#817A91]">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onSuccess={() => {
          const current = parseRouteFromPathname(window.location.pathname);
          if (current.page !== 'not-found') {
            setRouteState(current);
          } else {
            window.history.replaceState(null, '', '/billing');
            setRouteState({ page: 'billing' });
          }
        }}
      />
    );
  }

  const fallbackPage: ModuleKey = hasPermission('billing')
    ? 'billing'
    : hasPermission('home')
    ? 'home'
    : VALID_MODULES.find((m) => hasPermission(m)) || 'billing';

  const isNotFound = routeState.page === 'not-found';
  const resolvedPage: ModuleKey =
    !isNotFound && routeState.page !== 'not-found' && hasPermission(routeState.page)
      ? routeState.page
      : fallbackPage;

  return (
    <>
      <AppLayout activePage={resolvedPage} onNavigate={handleNavigate}>
        {isNotFound ? (
          <div className="eb-card p-8 sm:p-12 text-center max-w-lg mx-auto my-8 space-y-4">
            <div className="w-12 h-12 rounded-[12px] bg-[#E9E2FF] dark:bg-[#2A233D] text-[#7656C9] dark:text-[#C5B3F7] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-[22px] sm:text-[26px] font-bold text-[#302A40] dark:text-[#F3F1FA]">
                Page Not Found
              </h1>
              <p className="text-[14px] font-normal text-[#817A91] mt-1.5">
                The requested page does not exist in Easy Bill. Return to the main billing counter to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate(fallbackPage)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white font-display text-[14px] font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to {fallbackPage === 'billing' ? 'POS Billing' : 'Dashboard'}</span>
            </button>
          </div>
        ) : (
          <>
            {resolvedPage === 'home' && (
              <DashboardPage
                onNavigate={handleNavigate}
                onPrintReceipt={handlePrintReceipt}
              />
            )}
            {resolvedPage === 'billing' && (
              <BillingPage onPrintReceipt={handlePrintReceipt} />
            )}
            {resolvedPage === 'orders' && (
              <OrdersPage onPrintReceipt={handlePrintReceipt} />
            )}
            {resolvedPage === 'sales' && (
              <SalesPage onPrintReceipt={handlePrintReceipt} />
            )}
            {resolvedPage === 'products' && <ProductsPage />}
            {resolvedPage === 'expenses' && <ExpensesPage />}
            {resolvedPage === 'settings' && (
              <SettingsPage onPrintReceipt={handlePrintReceipt} />
            )}
          </>
        )}
      </AppLayout>

      <ReceiptModal
        receipt={activeReceipt?.data || null}
        autoTriggerPrint={activeReceipt?.autoPrint || false}
        onClose={() => setActiveReceipt(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <EasyBillRouter />
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
