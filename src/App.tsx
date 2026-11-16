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
import { ProductFormPage } from './pages/ProductFormPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { ModuleKey, Product, ReceiptData } from './types';

const VALID_MODULES: ModuleKey[] = [
  'home',
  'billing',
  'orders',
  'sales',
  'products',
  'expenses',
  'settings',
];

type RouteState =
  | { page: ModuleKey; productMode?: undefined; productId?: undefined }
  | { page: 'products'; productMode: 'new'; productId?: undefined }
  | { page: 'products'; productMode: 'edit'; productId: string }
  | { page: 'not-found'; productMode?: undefined; productId?: undefined };

function parseRouteFromPathname(pathname: string): RouteState {
  const clean = pathname.replace(/\/+$/, '');
  const lower = clean.toLowerCase();
  if (lower === '' || lower === '/') {
    return { page: 'billing' };
  }
  if (lower === '/products/new') {
    return { page: 'products', productMode: 'new' };
  }
  const editMatch = clean.match(/^\/products\/([^/]+)\/edit$/i);
  if (editMatch) {
    return {
      page: 'products',
      productMode: 'edit',
      productId: decodeURIComponent(editMatch[1]),
    };
  }
  const segment = lower.slice(1) as ModuleKey;
  if (VALID_MODULES.includes(segment)) {
    return { page: segment };
  }
  return { page: 'not-found' };
}

function EasyBillRouter() {
  const { user, loading, hasPermission } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>(() =>
    parseRouteFromPathname(window.location.pathname)
  );
  const [editingProductCache, setEditingProductCache] = useState<Product | null>(null);
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
      setEditingProductCache(null);
      setRouteState({ page });
    },
    [hasPermission]
  );

  const handleOpenAddProduct = useCallback(() => {
    if (!hasPermission('products')) return;
    if (window.location.pathname !== '/products/new') {
      window.history.pushState(null, '', '/products/new');
    }
    setEditingProductCache(null);
    setRouteState({ page: 'products', productMode: 'new' });
  }, [hasPermission]);

  const handleOpenEditProduct = useCallback(
    (product: Product) => {
      if (!hasPermission('products')) return;
      const targetPath = `/products/${encodeURIComponent(product.id)}/edit`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      setEditingProductCache(product);
      setRouteState({ page: 'products', productMode: 'edit', productId: product.id });
    },
    [hasPermission]
  );

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--eb-bg)] text-sm font-medium text-[var(--eb-text-muted)]">
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
    routeState.page !== 'not-found' && hasPermission(routeState.page)
      ? routeState.page
      : fallbackPage;

  return (
    <>
      <AppLayout activePage={resolvedPage} onNavigate={handleNavigate}>
        {isNotFound ? (
          <div className="eb-card p-8 sm:p-12 text-center max-w-lg mx-auto my-8 space-y-4">
            <div className="w-12 h-12 rounded-[12px] bg-[var(--eb-accent-light)] text-[var(--eb-accent)] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold text-[var(--eb-text)]">
                Page Not Found
              </h1>
              <p className="text-[14px] font-normal text-[var(--eb-text-muted)] mt-1.5">
                The requested page does not exist in Easy Bill. Return to the main billing counter to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate(fallbackPage)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[14px] font-medium transition-colors"
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
              <SalesPage onPrintReceipt={handlePrintReceipt} onNavigate={handleNavigate} />
            )}
            {resolvedPage === 'products' &&
              (routeState.page === 'products' && routeState.productMode ? (
                <ProductFormPage
                  mode={routeState.productMode}
                  productId={routeState.productId}
                  initialProduct={editingProductCache}
                  onCancel={() => handleNavigate('products')}
                  onSaved={() => handleNavigate('products')}
                />
              ) : (
                <ProductsPage
                  onAddProduct={handleOpenAddProduct}
                  onEditProduct={handleOpenEditProduct}
                />
              ))}
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
