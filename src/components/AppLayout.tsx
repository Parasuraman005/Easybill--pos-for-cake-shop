import React, { useEffect, useState, useRef } from 'react';
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement | null>(null);

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
        setSidebarPinned(false);
        setSidebarExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const appName = settings.application.appName || 'Easy Bill';
  const appLogo = settings.application.appLogo;
  const companyName = settings.company.name || 'Velvet Crumb Patisserie';
  const companyLogo = settings.company.logo;
  const companyAddress = settings.company.address;
  const companyPhone = settings.company.phone;

  const visibleNavItems = NAV_ITEMS.filter((item) => hasPermission(item.key));
  const isDesktopOpen = sidebarExpanded || sidebarPinned;

  const handleHamburgerClick = () => {
    if (window.innerWidth >= 1024) {
      setSidebarPinned((prev) => {
        const next = !prev;
        setSidebarExpanded(next);
        return next;
      });
    } else {
      setMobileMenuOpen((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7FB] dark:bg-[#13101C] text-[#302A40] dark:text-[#F3F1FA]">
      {/* Global Compact Top Header */}
      <header className="fixed top-0 inset-x-0 z-40 h-11 sm:h-12 bg-white/95 dark:bg-[#1B1726]/95 backdrop-blur border-b border-[#EAE7F0] dark:border-[#2E2842] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 shadow-[0_2px_8px_rgba(48,42,64,0.03)]">
        {/* Left Section: Hamburger + Logo + Name + Version */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleHamburgerClick}
            aria-label="Toggle navigation sidebar"
            aria-expanded={mobileMenuOpen || isDesktopOpen}
            className="p-1.5 rounded-[8px] text-[#302A40] dark:text-[#F3F1FA] hover:bg-[#E9E2FF]/60 dark:hover:bg-[#2A233D] transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {appLogo ? (
              <img
                src={appLogo}
                alt={appName}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-[8px] object-contain border border-[#EAE7F0] dark:border-[#2E2842] bg-white p-0.5 shrink-0"
              />
            ) : (
              <EasyBillLogo className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            )}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-display text-sm sm:text-base font-bold tracking-tight text-[#302A40] dark:text-[#F3F1FA] whitespace-nowrap truncate">
                {appName}
              </span>
              <span className="px-1.5 py-0.5 rounded-[6px] bg-[#E9E2FF] dark:bg-[#2A233D] text-[#7656C9] dark:text-[#C5B3F7] text-[10px] font-bold tabular-nums tracking-wide shrink-0">
                v1.0.0
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Minimal Counter Session User */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#817A91] min-w-0 shrink-0 max-w-[42vw]">
          <span className="hidden sm:inline shrink-0">Counter Session:</span>
          <span className="text-[#302A40] dark:text-[#E9E2FF] truncate">{user?.username}</span>
        </div>
      </header>

      {/* Mobile / Tablet Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-[#302A40]/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Collapsible Hamburger Sidebar */}
      <aside
        ref={sidebarRef}
        aria-label="Primary Sidebar"
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => {
          if (!sidebarPinned) setSidebarExpanded(false);
        }}
        className={`fixed top-11 sm:top-12 bottom-10 sm:bottom-11 left-0 z-50 bg-white dark:bg-[#1B1726] border-r border-[#EAE7F0] dark:border-[#2E2842] shadow-[4px_0_24px_rgba(48,42,64,0.06)] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileMenuOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full lg:translate-x-0'
        } ${isDesktopOpen ? 'lg:w-72' : 'lg:w-20'}`}
      >
        {/* Mobile Close Button */}
        <div className="flex items-center justify-between p-3.5 lg:hidden border-b border-[#EAE7F0] dark:border-[#2E2842]">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-[#817A91]">
            Navigation
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation drawer"
            className="p-1.5 rounded-[8px] text-[#817A91] hover:text-[#302A40] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Company Profile Section */}
        <div className="p-3.5 bg-[#E9E2FF]/40 dark:bg-[#231C38] border-b border-[#EAE7F0] dark:border-[#2E2842] overflow-hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-5 h-5 text-[#7656C9]" />
              )}
            </div>
            <div
              className={`min-w-0 transition-opacity duration-200 ${
                isDesktopOpen || mobileMenuOpen ? 'opacity-100' : 'lg:opacity-0 lg:hidden'
              }`}
            >
              <h3 className="font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] truncate">
                {companyName}
              </h3>
              {companyAddress && (
                <p className="text-[11px] font-medium text-[#817A91] truncate mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0 text-[#7656C9]" />
                  <span className="truncate">{companyAddress}</span>
                </p>
              )}
              {companyPhone && (
                <p className="text-[11px] font-medium text-[#817A91] truncate mt-0.5 flex items-center gap-1 tabular-nums">
                  <Phone className="w-3 h-3 shrink-0 text-[#7656C9]" />
                  <span>{companyPhone}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav aria-label="Sidebar modules" className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-1.5">
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
                  setSidebarPinned(false);
                  setSidebarExpanded(false);
                }}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] font-display text-[14px] font-semibold transition-colors group ${
                  isActive
                    ? 'bg-[#E9E2FF] dark:bg-[#2A233D] text-[#7656C9] dark:text-[#C5B3F7] shadow-sm'
                    : 'text-[#817A91] dark:text-[#A69FB8] hover:bg-[#F7F7FB] dark:hover:bg-[#231E33] hover:text-[#302A40] dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#7656C9] dark:text-[#C5B3F7]' : 'text-[#817A91] group-hover:text-[#7656C9]'
                  }`}
                />
                <span
                  className={`whitespace-nowrap transition-opacity duration-200 ${
                    isDesktopOpen || mobileMenuOpen ? 'opacity-100' : 'lg:opacity-0 lg:hidden'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer Quick User Info in Sidebar when expanded */}
        <div
          className={`p-3 border-t border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#151220] transition-opacity duration-200 ${
            isDesktopOpen || mobileMenuOpen ? 'opacity-100' : 'lg:opacity-0 lg:hidden'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[#302A40] dark:text-[#E9E2FF] truncate">
              <UserIcon className="w-3.5 h-3.5 text-[#7656C9] shrink-0" />
              <span className="truncate">{user?.username}</span>
            </div>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#E9E2FF] text-[#4B3194] font-bold shrink-0">
              {user?.role}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-6 pt-[58px] sm:pt-[66px] pb-14 sm:pb-16 lg:pl-[96px] transition-all duration-300 min-w-0">
        {children}
      </main>

      {/* Fixed Global Footer */}
      <footer className="fixed bottom-0 inset-x-0 z-40 h-10 sm:h-11 bg-white/95 dark:bg-[#1B1726]/95 backdrop-blur border-t border-[#EAE7F0] dark:border-[#2E2842] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 text-xs">
        {/* Left: Developer Attribution */}
        <div className="font-medium text-[#817A91] dark:text-[#A69FB8] truncate hidden md:block">
          Designed &amp; Developed by{' '}
          <span className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
            Algogenz Solutions
          </span>
        </div>

        {/* Center: Dynamic Date (DD-MM-YYYY) & Time */}
        <div className="tabular-nums text-[#302A40] dark:text-[#E9E2FF] font-semibold flex items-center gap-1.5 sm:gap-2 shrink-0 text-[11px] sm:text-xs">
          <span>{formatDateValue(now, 'DD-MM-YYYY')}</span>
          <span aria-hidden="true" className="text-[#817A91]">·</span>
          <span>{formatTimeValue(now)}</span>
        </div>

        {/* Right: Logged-in Username + Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="items-center gap-1.5 text-[#302A40] dark:text-[#E9E2FF] font-semibold hidden sm:inline-flex">
            <UserIcon className="w-3.5 h-3.5 text-[#7656C9]" />
            <span className="truncate max-w-[120px]">{user?.username}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D] transition-colors whitespace-nowrap shrink-0 font-semibold text-[11px] sm:text-xs"
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
