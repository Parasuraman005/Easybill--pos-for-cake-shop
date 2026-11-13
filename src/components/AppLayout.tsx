import React, { useEffect, useState } from 'react';
import {
  Home,
  ShoppingBag,
  ClipboardList,
  BarChart3,
  Cake,
  Wallet,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatDateValue, formatTimeValue } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';
import { EasyBillLogo, ShopDefaultEmblem } from './EasyBillLogo';
import type { ModuleKey } from '../types';

interface AppLayoutProps {
  activePage: ModuleKey;
  onNavigate: (page: ModuleKey) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'billing', label: 'Billing', icon: ShoppingBag },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'sales', label: 'Sales', icon: BarChart3 },
  { key: 'products', label: 'Products', icon: Cake },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function AppLayout({ activePage, onNavigate, children }: AppLayoutProps) {
  const { user, logout, hasPermission } = useAuth();
  const { settings } = useSettings();
  const [now, setNow] = useState(() => new Date());
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const appName = settings.application.appName || 'Easy Bill';
  const appLogo = settings.application.appLogo;
  const companyName = settings.company.name || 'Velvet Crumb Patisserie';
  const companyLogo = settings.company.logo;

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.key === 'expenses' || item.key === 'settings' || hasPermission(item.key)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7FB] dark:bg-[#13101C] text-[#302A40] dark:text-[#F3F1FA]">
      {/* Fixed Top Bar: Minimized Header + Minimized Navigation Bar */}
      <div className="fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-[#1B1726]/95 backdrop-blur border-b border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_2px_8px_rgba(48,42,64,0.04)]">
        {/* Minimized Header */}
        <header className="px-4 sm:px-6 h-11 border-b border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-between gap-3">
          {/* Left: Easy Bill Logo + Name */}
          <div className="flex items-center gap-2 min-w-0">
            {appLogo ? (
              <img
                src={appLogo}
                alt={appName}
                className="w-7 h-7 rounded-[8px] object-contain border border-[#EAE7F0] dark:border-[#2E2842] bg-white p-0.5 shrink-0"
              />
            ) : (
              <EasyBillLogo className="w-7 h-7 shrink-0" />
            )}
            <span className="font-display text-sm sm:text-base font-bold tracking-tight text-[#302A40] dark:text-[#F3F1FA] whitespace-nowrap truncate">
              {appName}
            </span>
          </div>

          {/* Right: Dynamic Company / Cake Shop Name + Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-xs sm:text-sm font-semibold text-[#302A40] dark:text-[#E9E2FF] truncate text-right">
              {companyName}
            </span>
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="w-7 h-7 rounded-[8px] object-cover border border-[#EAE7F0] dark:border-[#2E2842] bg-white shrink-0"
              />
            ) : (
              <ShopDefaultEmblem className="w-7 h-7 shrink-0" />
            )}
          </div>
        </header>

        {/* Minimized Fixed Horizontal Navigation Bar */}
        <nav
          aria-label="Primary modules"
          className="px-4 sm:px-6"
        >
          <div className="flex items-center gap-1 overflow-x-auto thin-scrollbar py-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs sm:text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#7656C9] text-white shadow-[0_2px_6px_rgba(118,86,201,0.28)]'
                      : 'text-[#817A91] dark:text-[#A69FB8] hover:bg-[#E9E2FF]/60 dark:hover:bg-[#2A233D] hover:text-[#302A40] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main Content Area (padded for fixed header+nav top and fixed footer bottom) */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 pt-[100px] pb-16">
        {children}
      </main>

      {/* Fixed Global Footer */}
      <footer className="fixed bottom-0 inset-x-0 z-40 h-11 bg-white/95 dark:bg-[#1B1726]/95 backdrop-blur border-t border-[#EAE7F0] dark:border-[#2E2842] px-4 sm:px-6 flex items-center justify-between gap-4 text-xs">
        {/* Left: Developer Attribution */}
        <div className="font-medium text-[#817A91] dark:text-[#A69FB8] truncate hidden sm:block">
          Designed &amp; Developed by{' '}
          <span className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
            Algogenz Solutions
          </span>
        </div>

        {/* Center: Dynamic Date (DD-MM-YYYY) & Time (HH:MM) */}
        <div className="tabular-nums text-[#302A40] dark:text-[#E9E2FF] font-semibold flex items-center gap-2 shrink-0">
          <span>{formatDateValue(now, 'DD-MM-YYYY')}</span>
          <span aria-hidden="true" className="text-[#817A91]">·</span>
          <span>{formatTimeValue(now)}</span>
        </div>

        {/* Right: Logged-in Username + Logout */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-[#302A40] dark:text-[#E9E2FF] font-semibold">
            <UserIcon className="w-3.5 h-3.5 text-[#7656C9]" />
            <span>{user?.username}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D] transition-colors whitespace-nowrap shrink-0 font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmLogout}
        title="Confirm Logout"
        description={`Are you sure you want to end the current counter session for "${user?.username}"?`}
        confirmLabel="Logout"
        cancelLabel="Stay Logged In"
        variant="danger"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
