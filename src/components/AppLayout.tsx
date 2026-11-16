import React, { useEffect, useState } from 'react';
import {
  Menu,
  Home,
  ShoppingBag,
  ClipboardList,
  BarChart3,
  Cake,
  Wallet,
  Settings,
  LogOut,
  User as UserIcon,
  Phone,
  MapPin,
  Building2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatDateValue, formatTimeValue } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';
import { EasyBillLogo } from './EasyBillLogo';
import type { ModuleKey } from '../types';

interface AppLayoutProps {
  activePage: ModuleKey;
  onNavigate: (page: ModuleKey) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  key: ModuleKey;
  label: string;
  pageTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'home', label: 'Home', pageTitle: 'Dashboard Overview', icon: Home },
  { key: 'billing', label: 'Billing', pageTitle: 'POS Billing Counter', icon: ShoppingBag },
  { key: 'orders', label: 'Orders', pageTitle: 'Cake Orders', icon: ClipboardList },
  { key: 'sales', label: 'Sales', pageTitle: 'Sales History', icon: BarChart3 },
  { key: 'products', label: 'Products', pageTitle: 'Products & Menu Catalog', icon: Cake },
  { key: 'expenses', label: 'Accounts', pageTitle: 'Accounts & Shop Ledger', icon: Wallet },
  { key: 'settings', label: 'Settings', pageTitle: 'Settings & Administration', icon: Settings },
];

export function AppLayout({ activePage, onNavigate, children }: AppLayoutProps) {
  const { user, logout, hasPermission } = useAuth();
  const { settings } = useSettings();
  const [now, setNow] = useState(() => new Date());
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const appName = settings.application.appName || 'Easy Bill';
  const appLogo = settings.application.appLogo;
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';
  const companyName = settings.company.name || 'Velvet Crumb Patisserie';
  const companyLogo = settings.company.logo;
  const companyAddress = settings.company.address;
  const companyPhone = settings.company.phone;

  const visibleNavItems = NAV_ITEMS.filter((item) => hasPermission(item.key));
  const activeNavMeta = NAV_ITEMS.find((item) => item.key === activePage) || NAV_ITEMS[0];
  const ActiveIcon = activeNavMeta.icon;

  const handleToggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setDesktopSidebarOpen((prev) => !prev);
    } else {
      setMobileMenuOpen((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[var(--eb-bg)] text-[var(--eb-text)] transition-colors">
      {/* Global Top Header */}
      <header className="sticky top-0 lg:static z-40 h-12 shrink-0 bg-[var(--eb-bg)] border-b border-[var(--eb-border)] px-3 sm:px-4 flex items-center justify-between gap-3 transition-colors">
        {/* Left: Sidebar Toggle + App Brand + Active Workspace Module */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleToggleSidebar}
            aria-label={desktopSidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
            aria-expanded={mobileMenuOpen || desktopSidebarOpen}
            className="w-8 h-8 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] hover:border-[var(--eb-accent)] text-[var(--eb-text)] flex items-center justify-center transition-colors shrink-0"
          >
            <Menu className="w-4 h-4 lg:hidden" />
            {desktopSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 hidden lg:block text-[var(--eb-text-muted)]" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 hidden lg:block text-[var(--eb-accent)]" />
            )}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {appLogo ? (
              <img
                src={appLogo}
                alt={appName}
                className="w-7 h-7 rounded-[8px] object-contain border border-[var(--eb-border)] bg-[var(--eb-surface)] p-0.5 shrink-0"
              />
            ) : (
              <EasyBillLogo className="w-7 h-7 shrink-0" />
            )}
            <span className="text-[15px] font-semibold tracking-tight text-[var(--eb-text)] whitespace-nowrap truncate">
              {appName}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-2.5 ml-0.5 border-l border-[var(--eb-border)] min-w-0">
            <ActiveIcon className="w-4 h-4 text-[var(--eb-accent)] shrink-0" />
            <span className="text-[13px] font-medium text-[var(--eb-text-muted)] whitespace-nowrap truncate">
              {activeNavMeta.pageTitle}
            </span>
          </div>
        </div>

        {/* Right: Shop Context & Active User Session */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--eb-text-muted)] max-w-[240px] truncate">
            <Building2 className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
            <span className="truncate">{companyName}</span>
          </span>

          <div className="h-4 w-px bg-[var(--eb-border)] hidden xl:block shrink-0" aria-hidden="true" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-[8px] bg-[var(--eb-accent-light)] border border-[var(--eb-accent-border)] text-[var(--eb-accent-text)] flex items-center justify-center text-[12px] font-bold uppercase shrink-0">
              {(user?.username || 'U').slice(0, 1)}
            </div>
            <div className="hidden sm:flex flex-col leading-none min-w-0">
              <span className="text-[12px] font-semibold text-[var(--eb-text)] truncate max-w-[120px]">
                {user?.username}
              </span>
              <span className="text-[10px] font-medium text-[var(--eb-text-muted)] capitalize mt-0.5">
                {user?.role}
              </span>
            </div>
          </div>

          {hasPermission('settings') && activePage !== 'settings' && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              title="Open Settings"
              aria-label="Open Settings"
              className="hidden sm:inline-flex w-8 h-8 rounded-[8px] border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 items-center justify-center transition-colors shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Middle Workspace: Docked Collapsible Desktop Sidebar + Main Canvas */}
      <div className="flex-1 min-h-0 flex relative overflow-x-hidden lg:overflow-hidden">
        {/* Mobile / Tablet Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] lg:hidden"
          />
        )}

        {/* Sidebar Navigation (Unified bg-[var(--eb-bg)] matching header, canvas, and footer) */}
        <aside
          aria-label="Primary Sidebar"
          className={`fixed top-0 bottom-0 left-0 z-50 lg:static lg:z-auto bg-[var(--eb-bg)] text-[var(--eb-text)] border-r border-[var(--eb-border)] flex flex-col shrink-0 transition-all duration-200 ease-out ${
            mobileMenuOpen ? 'translate-x-0 w-[256px] max-w-[85vw] shadow-2xl' : '-translate-x-full lg:translate-x-0'
          } ${desktopSidebarOpen ? 'lg:w-[224px]' : 'lg:w-[68px]'}`}
        >
          {/* Mobile Drawer Header */}
          <div className="h-12 px-3.5 flex items-center justify-between lg:hidden border-b border-[var(--eb-border)] shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--eb-text-muted)]">
              Navigation
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation drawer"
              className="p-1.5 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] hover:bg-[var(--eb-surface)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Company Profile Strip */}
          <div
            className={`border-b border-[var(--eb-border)] shrink-0 transition-all ${
              desktopSidebarOpen || mobileMenuOpen ? 'p-3' : 'lg:py-3 lg:px-2 flex justify-center'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[9px] bg-[var(--eb-surface)] border border-[var(--eb-border)] flex items-center justify-center shrink-0 overflow-hidden">
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-4 h-4 text-[var(--eb-accent)]" />
                )}
              </div>
              <div
                className={`min-w-0 ${
                  desktopSidebarOpen || mobileMenuOpen ? 'block' : 'lg:hidden'
                }`}
              >
                <h3 className="text-[12px] font-semibold text-[var(--eb-text)] truncate leading-snug">
                  {companyName}
                </h3>
                {companyPhone ? (
                  <p className="text-[11px] font-normal text-[var(--eb-text-muted)] truncate flex items-center gap-1 tabular-nums mt-0.5">
                    <Phone className="w-3 h-3 shrink-0 text-[var(--eb-accent)]" />
                    <span className="truncate">{companyPhone}</span>
                  </p>
                ) : companyAddress ? (
                  <p className="text-[11px] font-normal text-[var(--eb-text-muted)] truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0 text-[var(--eb-accent)]" />
                    <span className="truncate">{companyAddress}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav aria-label="Sidebar modules" className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-2.5 space-y-1">
            {(desktopSidebarOpen || mobileMenuOpen) && (
              <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--eb-text-muted)] select-none">
                Workspace
              </p>
            )}
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate(item.key);
                    setMobileMenuOpen(false);
                  }}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full h-10 flex items-center rounded-[9px] text-[13px] transition-colors group whitespace-nowrap border ${
                    desktopSidebarOpen || mobileMenuOpen ? 'px-3 gap-2.5' : 'lg:justify-center lg:px-0'
                  } ${
                    isActive
                      ? 'bg-[var(--eb-surface)] border-[var(--eb-accent-border)] text-[var(--eb-accent-text)] font-semibold shadow-2xs'
                      : 'border-transparent text-[var(--eb-text-muted)] font-medium hover:bg-[var(--eb-surface)] hover:text-[var(--eb-text)]'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive
                        ? 'text-[var(--eb-accent)]'
                        : 'text-[var(--eb-text-muted)] group-hover:text-[var(--eb-accent)]'
                    }`}
                  />
                  <span
                    className={`truncate ${
                      desktopSidebarOpen || mobileMenuOpen ? 'inline' : 'lg:hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Bottom Collapse Toggle & Session Strip */}
          <div className="p-2.5 border-t border-[var(--eb-border)] shrink-0 space-y-2">
            {(desktopSidebarOpen || mobileMenuOpen) && (
              <div className="px-2.5 py-1.5 rounded-[8px] bg-[var(--eb-surface)] border border-[var(--eb-border)] flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-[var(--eb-text)] font-medium min-w-0">
                  <UserIcon className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
                  <span className="truncate">{user?.username}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--eb-text-muted)] font-semibold shrink-0">
                  {user?.role}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDesktopSidebarOpen((prev) => !prev)}
              className="hidden lg:flex w-full h-8 items-center justify-center gap-2 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] hover:bg-[var(--eb-surface)] text-[12px] font-medium transition-colors"
              aria-label={desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {desktopSidebarOpen ? (
                <>
                  <PanelLeftClose className="w-4 h-4 shrink-0" />
                  <span>Collapse Menu</span>
                </>
              ) : (
                <PanelLeftOpen className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-h-0 w-full max-w-[1680px] mx-auto px-3 py-3 sm:px-5 sm:py-4 flex flex-col">
            {children}
          </div>
        </main>
      </div>

      {/* Slim Enterprise Footer */}
      <footer className="sticky bottom-0 lg:static z-40 h-9 shrink-0 bg-[var(--eb-bg)] border-t border-[var(--eb-border)] px-3 sm:px-4 flex items-center justify-between gap-3 text-[12px] transition-colors">
        {/* Left: Developer Attribution */}
        <div className="font-normal text-[var(--eb-text-muted)] truncate hidden md:block">
          Designed &amp; Developed by{' '}
          <span className="font-semibold text-[var(--eb-text)]">
            Algogenz Solutions
          </span>
        </div>

        {/* Center: Live Date & Time */}
        <div className="tabular-nums text-[var(--eb-text)] font-medium flex items-center gap-1.5 shrink-0 text-[11px] sm:text-[12px]">
          <span>{formatDateValue(now, dateFmt)}</span>
          <span aria-hidden="true" className="text-[var(--eb-text-muted)]">·</span>
          <span>{formatTimeValue(now)}</span>
        </div>

        {/* Right: Active Session & Logout */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--eb-text-muted)]">
            <UserIcon className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
            <span className="text-[var(--eb-text)] truncate max-w-[120px]">{user?.username}</span>
          </span>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 transition-colors whitespace-nowrap shrink-0 font-medium text-[11px] sm:text-[12px]"
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
