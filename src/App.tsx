import React, { useCallback, useState } from 'react';
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
import type { ModuleKey, ReceiptData } from './types';

function EasyBillRouter() {
  const { user, loading, hasPermission } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [activePage, setActivePage] = useState<ModuleKey>('billing');
  const [activeReceipt, setActiveReceipt] = useState<{
    data: ReceiptData;
    autoPrint: boolean;
  } | null>(null);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const handlePrintReceipt = useCallback((receipt: ReceiptData, autoPrint = false) => {
    setActiveReceipt({ data: receipt, autoPrint });
  }, []);

  const handleNavigate = useCallback(
    (page: ModuleKey) => {
      if (page === 'expenses' || page === 'settings' || hasPermission(page)) {
        setActivePage(page);
      }
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
    return <LoginPage onSuccess={() => setActivePage('billing')} />;
  }

  const resolvedPage: ModuleKey =
    activePage === 'expenses' || activePage === 'settings' || hasPermission(activePage)
      ? activePage
      : hasPermission('home')
      ? 'home'
      : 'billing';

  return (
    <>
      <AppLayout activePage={resolvedPage} onNavigate={handleNavigate}>
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
