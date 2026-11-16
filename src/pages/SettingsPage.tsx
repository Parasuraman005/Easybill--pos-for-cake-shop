import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Sliders,
  Receipt,
  Printer,
  Users,
  Database,
  Save,
  Upload,
  Download,
  Plus,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Check,
  Sun,
  Moon,
  RotateCcw,
  RefreshCw,
  Shield,
  Package,
  Tag,
  UserCheck,
  FileText,
  Cake,
  Wallet,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatCurrency, formatMoneyExact, formatYMD, getTodayYMD } from '../lib/format';
import { THEME_PRESETS, type ThemePresetId } from '../lib/theme';
import type {
  AllSettings,
  AuthUser,
  BackupSummary,
  ModuleKey,
  ReceiptData,
  UserPermissions,
  UserRole,
} from '../types';

interface SettingsPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

type SettingsTab =
  | 'theme'
  | 'company'
  | 'application'
  | 'billing'
  | 'printer'
  | 'users'
  | 'backup';

const AVAILABLE_PRINTERS = [
  'Epson TM-T82 Thermal',
  'Star TSP143III USB Thermal',
  'Bixolon SRP-350plusIII',
  'HP LaserJet Pro A4',
  'System Default Printer',
];

const CURRENCY_QUICK_OPTIONS = ['₹', '$', '€', '£'];

const MODULE_LABELS: { key: ModuleKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'billing', label: 'Billing' },
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Products' },
  { key: 'expenses', label: 'Accounts' },
  { key: 'settings', label: 'Settings' },
];

const NAV_GROUPS: {
  groupLabel: string;
  items: {
    key: SettingsTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}[] = [
  {
    groupLabel: 'Brand & Visuals',
    items: [
      { key: 'theme', label: 'Theme & Appearance', shortLabel: 'Theme', icon: Palette },
      { key: 'company', label: 'Company Profile', shortLabel: 'Company', icon: Building2 },
      { key: 'application', label: 'Application', shortLabel: 'Application', icon: Sliders },
    ],
  },
  {
    groupLabel: 'Counter & Hardware',
    items: [
      { key: 'billing', label: 'Billing & GST', shortLabel: 'Billing & GST', icon: Receipt },
      { key: 'printer', label: 'Printer & Receipts', shortLabel: 'Printer', icon: Printer },
    ],
  },
  {
    groupLabel: 'Administration',
    items: [
      { key: 'users', label: 'Users & Roles', shortLabel: 'Users', icon: Users },
      { key: 'backup', label: 'Backup & Data', shortLabel: 'Backup', icon: Database },
    ],
  },
];

function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  if (role === 'admin') {
    return {
      home: true,
      billing: true,
      orders: true,
      sales: true,
      products: true,
      expenses: true,
      settings: true,
    };
  }
  if (role === 'manager') {
    return {
      home: true,
      billing: true,
      orders: true,
      sales: true,
      products: true,
      expenses: true,
      settings: false,
    };
  }
  return {
    home: true,
    billing: true,
    orders: true,
    sales: true,
    products: true,
    expenses: false,
    settings: false,
  };
}

export function SettingsPage({ onPrintReceipt }: SettingsPageProps) {
  const { user: currentUser, refreshUser } = useAuth();
  const {
    settings,
    updateSettings,
    reloadSettings,
    colorTheme,
    setColorTheme,
    themeMode,
    setThemeMode,
  } = useSettings();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('theme');
  const [draft, setDraft] = useState<AllSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Simulator state for Billing & GST preview
  const [simDiscountPct, setSimDiscountPct] = useState<number>(10);

  // Users state
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'cashier' as UserRole,
    active: true,
    permissions: getDefaultPermissionsForRole('cashier'),
  });
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AuthUser | null>(null);

  // Backup state
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [loadingBackupSummary, setLoadingBackupSummary] = useState(false);
  const [pendingRestoreJson, setPendingRestoreJson] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirtyMap = useMemo(
    () => ({
      company: JSON.stringify(draft.company) !== JSON.stringify(settings.company),
      application: JSON.stringify(draft.application) !== JSON.stringify(settings.application),
      billing: JSON.stringify(draft.billing) !== JSON.stringify(settings.billing),
      printer: JSON.stringify(draft.printer) !== JSON.stringify(settings.printer),
    }),
    [draft, settings]
  );

  const isAnyDirty =
    dirtyMap.company || dirtyMap.application || dirtyMap.billing || dirtyMap.printer;

  const isFormTab =
    activeTab === 'company' ||
    activeTab === 'application' ||
    activeTab === 'billing' ||
    activeTab === 'printer';

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const list = await apiRequest<AuthUser[]>('/api/users');
      setUsers(list);
    } catch {
      // ignore if restricted
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadBackupSummary = useCallback(async () => {
    setLoadingBackupSummary(true);
    try {
      const summary = await apiRequest<BackupSummary>('/api/backup/summary');
      setBackupSummary(summary);
    } catch {
      // keep previous summary if unavailable
    } finally {
      setLoadingBackupSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'backup') {
      loadBackupSummary();
    }
  }, [activeTab, loadUsers, loadBackupSummary]);

  useEffect(() => {
    if (!userModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [userModalOpen]);

  const handleLogoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'company' | 'application'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo too large', 'error', 'Please select an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'company') {
          setDraft((d) => ({ ...d, company: { ...d.company, logo: reader.result as string } }));
        } else {
          setDraft((d) => ({
            ...d,
            application: { ...d.application, appLogo: reader.result as string },
          }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const saveDraftSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings(draft);
      showToast('Settings Saved', 'success', 'Changes are now active across Easy Bill.');
    } catch (err: any) {
      showToast('Could not save settings', 'error', err?.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDraftSettings();
  };

  const handleDiscardChanges = () => {
    setDraft(settings);
    showToast('Changes Discarded', 'info', 'Reverted unsaved form inputs to active settings.');
  };

  const handleTestPrint = () => {
    const subtotal = 950;
    const taxRate = draft.billing.gstEnabled ? draft.billing.gstRate : 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;
    const sampleReceipt: ReceiptData = {
      billNumber: `${draft.billing.billPrefix || 'EB'}-TEST`,
      type: 'walkin',
      createdAt: new Date().toISOString(),
      customerName: 'Test Print Verification',
      customerPhone: draft.company.phone || '9876543210',
      customerAddress: '',
      items: [
        {
          productId: 'test-1',
          productName: 'Belgian Dark Chocolate Truffle',
          category: 'Cakes',
          unit: 'KG',
          quantity: 1,
          unitPrice: 950,
          subtotal: 950,
        },
      ],
      subtotal,
      discountPercent: 0,
      discountAmount: 0,
      taxRate,
      taxAmount,
      grandTotal,
      paymentMode: draft.billing.defaultPaymentMode || 'Cash',
      amountReceived: grandTotal,
      advanceAmount: 0,
      balanceAmount: 0,
      username: currentUser?.username || 'admin',
    };
    onPrintReceipt(sampleReceipt, true);
  };

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      password: '',
      fullName: '',
      role: 'cashier',
      active: true,
      permissions: getDefaultPermissionsForRole('cashier'),
    });
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: AuthUser) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      password: '',
      fullName: u.fullName,
      role: u.role,
      active: u.active,
      permissions: { ...u.permissions },
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username.trim()) {
      showToast('Username Required', 'error');
      return;
    }
    if (!editingUser && userForm.password.length < 4) {
      showToast('Password Required', 'error', 'Password must be at least 4 characters.');
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        const updated = await apiRequest<AuthUser>(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(userForm),
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        if (updated.id === currentUser?.id) {
          await refreshUser();
        }
        showToast('User Updated', 'success', updated.username);
      } else {
        const created = await apiRequest<AuthUser>('/api/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
        setUsers((prev) => [...prev, created]);
        showToast('User Created', 'success', created.username);
      }
      setUserModalOpen(false);
    } catch (err: any) {
      showToast('Save Failed', 'error', err?.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await apiRequest(`/api/users/${deleteUserTarget.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      showToast('User Deleted', 'info', deleteUserTarget.username);
      setDeleteUserTarget(null);
    } catch (err: any) {
      showToast('Could not delete user', 'error', err?.message);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await apiRequest<any>('/api/backup/export');
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `easybill-backup-${getTodayYMD()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup Downloaded', 'success');
    } catch (err: any) {
      showToast('Backup Failed', 'error', err?.message);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!Array.isArray(parsed.products)) {
          showToast('Invalid Backup File', 'error', 'Selected JSON does not match Easy Bill format.');
          return;
        }
        setPendingRestoreJson(parsed);
      } catch {
        showToast('Invalid JSON File', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreJson) return;
    setRestoring(true);
    try {
      await apiRequest('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify(pendingRestoreJson),
      });
      await Promise.all([reloadSettings(), loadBackupSummary()]);
      setPendingRestoreJson(null);
      showToast('Backup Restored', 'success', 'Database records and settings updated.');
    } catch (err: any) {
      showToast('Restore Failed', 'error', err?.message);
    } finally {
      setRestoring(false);
    }
  };

  const activePreset = THEME_PRESETS.find((p) => p.id === colorTheme) || THEME_PRESETS[0];
  const sym = draft.application.currencySymbol || settings.application.currencySymbol || '₹';

  // Live billing simulator calculation
  const simBaseSubtotal = 1000;
  const effectiveSimDiscPct = draft.billing.allowDiscount
    ? Math.min(Math.max(simDiscountPct, 0), Math.max(draft.billing.maxDiscountPercent || 0, 0))
    : 0;
  const simDiscountAmt = (simBaseSubtotal * effectiveSimDiscPct) / 100;
  const simTaxable = simBaseSubtotal - simDiscountAmt;
  const simTaxAmt = draft.billing.gstEnabled ? (simTaxable * (draft.billing.gstRate || 0)) / 100 : 0;
  const simGrandTotal = simTaxable + simTaxAmt;

  // User stats
  const activeUsersCount = users.filter((u) => u.active).length;
  const adminUsersCount = users.filter((u) => u.role === 'admin').length;
  const counterStaffCount = users.filter((u) => u.role !== 'admin').length;

  const inputClass =
    'w-full h-[38px] px-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[13.5px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15 transition-colors';

  const textareaClass =
    'w-full p-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[13.5px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15 transition-colors';

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Top Page Header Bar */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight">
            Settings &amp; Administration
          </h1>
          <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 truncate">
            Configure global appearance, shop branding, regional formats, billing rules, printers, staff access, and backups.
          </p>
        </div>

        {/* Dirty / Quick Save Bar */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isAnyDirty ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-[12px] font-medium whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Unsaved changes</span>
              </span>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="inline-flex items-center gap-1.5 h-[36px] px-3 rounded-[9px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
              <button
                type="button"
                disabled={savingSettings}
                onClick={saveDraftSettings}
                className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[12.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[9px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[var(--eb-text-muted)] text-[12px] font-medium whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--eb-accent)]" />
              <span>
                {activePreset.name} · {themeMode === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile & Tablet Horizontal Section Tabs */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-0.5 shrink-0">
        {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          const hasDirty =
            (item.key === 'company' && dirtyMap.company) ||
            (item.key === 'application' && dirtyMap.application) ||
            (item.key === 'billing' && dirtyMap.billing) ||
            (item.key === 'printer' && dirtyMap.printer);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`inline-flex items-center gap-1.5 h-[36px] px-3 rounded-[9px] text-[12.5px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white'
                  : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:bg-[var(--eb-accent-light)] hover:text-[var(--eb-accent-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.shortLabel}</span>
              {hasDirty && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-amber-500'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3.5">
        {/* Desktop Categorized Left Navigation Rail */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[252px] shrink-0 rounded-[12px] bg-[var(--eb-surface)] border border-[var(--eb-border)] overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-2.5 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.groupLabel}>
                <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                  {group.groupLabel}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.key;
                    const hasDirty =
                      (item.key === 'company' && dirtyMap.company) ||
                      (item.key === 'application' && dirtyMap.application) ||
                      (item.key === 'billing' && dirtyMap.billing) ||
                      (item.key === 'printer' && dirtyMap.printer);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
                        className={`w-full flex items-center justify-between gap-2 h-[38px] px-2.5 rounded-[9px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)] border border-[var(--eb-accent-border)]'
                            : 'text-[var(--eb-text-muted)] hover:bg-[var(--eb-surface-subtle)] hover:text-[var(--eb-text)] border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-[var(--eb-accent)]' : 'text-[var(--eb-text-subtle)]'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {hasDirty && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                            title="Unsaved edits"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Live System Configuration Snapshot */}
          <div className="shrink-0 border-t border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3 space-y-2 text-[11.5px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
              Active Configuration
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--eb-text-muted)]">Palette</span>
                <span className="font-semibold text-[var(--eb-text)] truncate">
                  {activePreset.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--eb-text-muted)]">Tax &amp; Currency</span>
                <span className="font-semibold text-[var(--eb-text)]">
                  {settings.billing.gstEnabled ? `GST ${settings.billing.gstRate}%` : 'No GST'} ·{' '}
                  {settings.application.currencySymbol || '₹'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--eb-text-muted)]">Printer</span>
                <span
                  className={`font-semibold ${
                    settings.printer.isConnected
                      ? 'text-[#16A34A] dark:text-emerald-400'
                      : 'text-[#F59E0B] dark:text-amber-400'
                  }`}
                >
                  {settings.printer.paperSize} ·{' '}
                  {settings.printer.isConnected ? 'Ready' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Section Workspace */}
        <div className="flex-1 min-h-0 rounded-[12px] bg-[var(--eb-surface)] border border-[var(--eb-border)] lg:overflow-y-auto thin-scrollbar p-4 sm:p-5">
          {/* ==============================================================
              SECTION 1: THEME & APPEARANCE
             ============================================================== */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3.5 border-b border-[var(--eb-border)]">
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                    Theme &amp; Appearance Mode
                  </h2>
                  <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                    Switch between Light and Dark mode or apply a curated color palette across the entire application.
                  </p>
                </div>

                {/* Instant Light / Dark Mode Segmented Switch */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <div className="inline-flex p-1 rounded-[10px] bg-[var(--eb-surface-subtle)] border border-[var(--eb-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('light');
                        showToast('Light Mode Active', 'success', 'Interface switched to Light mode.');
                      }}
                      className={`inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[7px] text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                        themeMode === 'light'
                          ? 'bg-[var(--eb-accent)] text-white'
                          : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('dark');
                        showToast('Dark Mode Active', 'success', 'Interface switched to Dark mode.');
                      }}
                      className={`inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[7px] text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                        themeMode === 'dark'
                          ? 'bg-[var(--eb-accent)] text-white'
                          : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {THEME_PRESETS.map((preset, idx) => {
                  const isSelected = colorTheme === preset.id;
                  const numLabel = String(idx + 1).padStart(2, '0');
                  const tokens = themeMode === 'dark' ? preset.dark : preset.light;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setColorTheme(preset.id);
                        showToast(
                          'Theme Updated',
                          'success',
                          `${preset.name} applied across the application.`
                        );
                      }}
                      className={`group cursor-pointer rounded-[12px] p-4 border transition-colors bg-[var(--eb-surface)] ${
                        isSelected
                          ? 'border-[var(--eb-accent)] ring-2 ring-[var(--eb-accent)]/35'
                          : 'border-[var(--eb-border)] hover:border-[var(--eb-accent)]/50'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-mono font-semibold text-[var(--eb-text-muted)] tabular-nums">
                              {numLabel}.
                            </span>
                            <h3 className="text-[15px] font-semibold text-[var(--eb-text)]">
                              {preset.name}
                            </h3>
                          </div>
                          <p className="text-[12px] font-medium text-[var(--eb-accent)] mt-0.5">
                            {preset.tagline}
                          </p>
                        </div>

                        {isSelected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)] text-[12px] font-semibold border border-[var(--eb-accent-border)] shrink-0 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active Theme</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorTheme(preset.id);
                              showToast(
                                'Theme Updated',
                                'success',
                                `${preset.name} applied across the application.`
                              );
                            }}
                            className="px-3 py-1 rounded-[8px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[12px] font-medium border border-sky-200 dark:border-sky-800/60 transition-colors shrink-0 whitespace-nowrap"
                          >
                            Apply Theme
                          </button>
                        )}
                      </div>

                      <p className="text-[12px] text-[var(--eb-text-muted)] mb-3 leading-snug">
                        {preset.description}
                      </p>

                      {/* Mini Live UI Frame Preview (Adapts to Light / Dark) */}
                      <div
                        className="rounded-[10px] p-2 mb-3 border"
                        style={{
                          backgroundColor: tokens.bg,
                          borderColor: tokens.border,
                        }}
                      >
                        <div className="space-y-2">
                          <div
                            className="h-6 rounded-[6px] px-2 flex items-center justify-between text-[10px] font-semibold"
                            style={{
                              backgroundColor: tokens.surface,
                              color: tokens.text,
                              borderColor: tokens.border,
                              borderWidth: 1,
                            }}
                          >
                            <span className="font-bold flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-xs inline-block"
                                style={{ backgroundColor: tokens.accent }}
                              />
                              {draft.application.appName || 'Easy Bill'}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] text-white"
                              style={{ backgroundColor: tokens.accent }}
                            >
                              {themeMode === 'dark' ? 'Dark' : 'Light'}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            <div
                              className="col-span-1 p-1.5 rounded-[6px] space-y-1"
                              style={{
                                backgroundColor: tokens.sidebarBg,
                              }}
                            >
                              <div
                                className="h-2 rounded-xs"
                                style={{ backgroundColor: tokens.accent }}
                              />
                              <div className="h-1.5 rounded-xs bg-white/30" />
                              <div className="h-1.5 rounded-xs bg-white/20" />
                              <div className="h-1.5 rounded-xs bg-white/20" />
                            </div>

                            <div className="col-span-3 space-y-1.5">
                              <div
                                className="p-2 rounded-[6px] border flex items-center justify-between"
                                style={{
                                  backgroundColor: tokens.surface,
                                  borderColor: tokens.border,
                                }}
                              >
                                <div>
                                  <div
                                    className="text-[9px] font-medium"
                                    style={{ color: tokens.textMuted }}
                                  >
                                    Daily Sales
                                  </div>
                                  <div
                                    className="text-[12px] font-bold tabular-nums"
                                    style={{ color: tokens.text }}
                                  >
                                    {formatCurrency(24850, sym)}
                                  </div>
                                </div>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: tokens.accent }}
                                >
                                  POS
                                </span>
                              </div>

                              <div
                                className="h-5 px-2 rounded-[4px] border flex items-center justify-between text-[9px]"
                                style={{
                                  backgroundColor: tokens.surface,
                                  borderColor: tokens.border,
                                  color: tokens.text,
                                }}
                              >
                                <span>Chocolate Truffle Cake</span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: tokens.accent }}
                                >
                                  {formatCurrency(950, sym)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4-Color Palette Swatches */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[var(--eb-border)]">
                        <div>
                          <div
                            className="h-6 rounded-[6px] border border-black/10 mb-1"
                            style={{ backgroundColor: preset.previewPalette.primary }}
                          />
                          <div className="text-[10px] font-semibold text-[var(--eb-text)]">
                            Primary
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-[var(--eb-text-muted)] truncate">
                            {preset.previewPalette.primary}
                          </div>
                        </div>
                        <div>
                          <div
                            className="h-6 rounded-[6px] border border-black/10 mb-1"
                            style={{ backgroundColor: preset.previewPalette.accent }}
                          />
                          <div className="text-[10px] font-semibold text-[var(--eb-text)]">
                            Accent
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-[var(--eb-text-muted)] truncate">
                            {preset.previewPalette.accent}
                          </div>
                        </div>
                        <div>
                          <div
                            className="h-6 rounded-[6px] border border-black/15 mb-1"
                            style={{ backgroundColor: preset.previewPalette.background }}
                          />
                          <div className="text-[10px] font-semibold text-[var(--eb-text)]">
                            Background
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-[var(--eb-text-muted)] truncate">
                            {preset.previewPalette.background}
                          </div>
                        </div>
                        <div>
                          <div
                            className="h-6 rounded-[6px] border border-black/15 mb-1"
                            style={{ backgroundColor: preset.previewPalette.surface }}
                          />
                          <div className="text-[10px] font-semibold text-[var(--eb-text)]">
                            Surface
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-[var(--eb-text-muted)] truncate">
                            {preset.previewPalette.surface}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==============================================================
              SECTION 2: COMPANY PROFILE
             ============================================================== */}
          {activeTab === 'company' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="pb-3 border-b border-[var(--eb-border)]">
                <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                  Company &amp; Cake Shop Profile
                </h2>
                <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                  Configure business identity, GSTIN, and contact details printed on thermal receipts and sales PDFs.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left Form */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="flex items-center gap-4 p-3.5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)]">
                    <div className="w-16 h-16 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface)] flex items-center justify-center overflow-hidden shrink-0">
                      {draft.company.logo ? (
                        <img
                          src={draft.company.logo}
                          alt="Company logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-[var(--eb-accent)]" />
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[9px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-[12.5px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Shop Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoFile(e, 'company')}
                            className="hidden"
                          />
                        </label>
                        {draft.company.logo && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, company: { ...d.company, logo: '' } }))
                            }
                            className="h-[34px] px-3 rounded-[9px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--eb-text-muted)]">
                        Recommended square PNG/JPG under 2MB. Used on printed bills &amp; top header.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Cake Shop Name
                      </label>
                      <input
                        type="text"
                        value={draft.company.name}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, company: { ...d.company, name: e.target.value } }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={draft.company.phone}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, company: { ...d.company, phone: e.target.value } }))
                        }
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Business Email
                      </label>
                      <input
                        type="email"
                        value={draft.company.email}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, company: { ...d.company, email: e.target.value } }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        GSTIN (Optional)
                      </label>
                      <input
                        type="text"
                        value={draft.company.gstin}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, company: { ...d.company, gstin: e.target.value } }))
                        }
                        className={`${inputClass} tabular-nums uppercase`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Shop Address
                      </label>
                      <textarea
                        rows={2}
                        value={draft.company.address}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            company: { ...d.company, address: e.target.value },
                          }))
                        }
                        className={textareaClass}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSettings ? 'Saving...' : 'Save Company Profile'}</span>
                    </button>
                    {dirtyMap.company && (
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Live Receipt Header Preview */}
                <div className="xl:col-span-5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                      Live Receipt Header Preview
                    </span>
                    <span className="text-[11px] font-medium text-[var(--eb-accent)] tabular-nums">
                      {draft.printer.paperSize}
                    </span>
                  </div>

                  <div className="rounded-[10px] bg-white text-slate-900 border border-slate-200 p-4 font-mono text-[11.5px] space-y-1.5 text-center">
                    {draft.company.logo && (
                      <div className="flex justify-center mb-1.5">
                        <img
                          src={draft.company.logo}
                          alt="Receipt Logo Preview"
                          className="w-11 h-11 rounded-[8px] object-cover border border-slate-200"
                        />
                      </div>
                    )}
                    <div className="text-[14px] font-bold tracking-tight">
                      {draft.company.name || 'Your Cake Shop Name'}
                    </div>
                    <div className="text-[11px] text-slate-600 leading-snug">
                      {draft.company.address || 'Shop Street Address'}
                    </div>
                    <div className="text-[11px] text-slate-700 tabular-nums">
                      Ph: {draft.company.phone || '—'}
                    </div>
                    {draft.company.email && (
                      <div className="text-[10.5px] text-slate-600">{draft.company.email}</div>
                    )}
                    {draft.company.gstin && (
                      <div className="text-[11px] font-semibold text-slate-800 tabular-nums">
                        GSTIN: {draft.company.gstin}
                      </div>
                    )}
                    <div className="border-t border-dashed border-slate-300 my-2 pt-2 flex items-center justify-between text-[10.5px] text-slate-600 tabular-nums">
                      <span>Bill: {draft.billing.billPrefix || 'EB'}-1001</span>
                      <span>{formatYMD(getTodayYMD(), draft.application.dateFormat)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ==============================================================
              SECTION 3: APPLICATION PREFERENCES
             ============================================================== */}
          {activeTab === 'application' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="pb-3 border-b border-[var(--eb-border)]">
                <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                  Application &amp; Regional Preferences
                </h2>
                <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                  Customize workspace branding, browser title, currency symbol, and global date display format.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left Form */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="flex items-center gap-4 p-3.5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)]">
                    <div className="w-16 h-16 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface)] flex items-center justify-center overflow-hidden shrink-0">
                      {draft.application.appLogo ? (
                        <img
                          src={draft.application.appLogo}
                          alt="App logo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Sliders className="w-6 h-6 text-[var(--eb-accent)]" />
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[9px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-[12.5px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Custom App Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoFile(e, 'application')}
                            className="hidden"
                          />
                        </label>
                        {draft.application.appLogo && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                application: { ...d.application, appLogo: '' },
                              }))
                            }
                            className="h-[34px] px-3 rounded-[9px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            Reset Default
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--eb-text-muted)]">
                        Appears in the sidebar brand slot and login screen.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Application Name
                      </label>
                      <input
                        type="text"
                        value={draft.application.appName}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            application: { ...d.application, appName: e.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Date Format (All Pages &amp; PDFs)
                      </label>
                      <select
                        value={draft.application.dateFormat}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            application: {
                              ...d.application,
                              dateFormat: e.target.value as any,
                            },
                          }))
                        }
                        className={`${inputClass} pr-9 tabular-nums`}
                      >
                        <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 24-11-2026)</option>
                        <option value="MM-DD-YYYY">MM-DD-YYYY (e.g. 11-24-2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-11-24)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Currency Symbol
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={draft.application.currencySymbol}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              application: { ...d.application, currencySymbol: e.target.value },
                            }))
                          }
                          className={`${inputClass} w-20 text-center font-semibold`}
                        />
                        <div className="flex items-center gap-1">
                          {CURRENCY_QUICK_OPTIONS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  application: { ...d.application, currencySymbol: c },
                                }))
                              }
                              className={`w-9 h-[38px] rounded-[9px] border text-[13px] font-semibold transition-colors ${
                                draft.application.currencySymbol === c
                                  ? 'bg-[var(--eb-accent-light)] border-[var(--eb-accent-border)] text-[var(--eb-accent-text)]'
                                  : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Color Palette (Instant Sync)
                      </label>
                      <select
                        value={colorTheme}
                        onChange={(e) => {
                          const next = e.target.value as ThemePresetId;
                          setColorTheme(next);
                          setDraft((d) => ({
                            ...d,
                            application: { ...d.application, colorTheme: next },
                          }));
                        }}
                        className={`${inputClass} pr-9`}
                      >
                        {THEME_PRESETS.map((p, idx) => (
                          <option key={p.id} value={p.id}>
                            {String(idx + 1).padStart(2, '0')}. {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSettings ? 'Saving...' : 'Save Application Settings'}</span>
                    </button>
                    {dirtyMap.application && (
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Live Regional Preview */}
                <div className="xl:col-span-5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-4 space-y-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                    Live Regional &amp; Brand Preview
                  </div>

                  {/* Mini Top Header Preview */}
                  <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-[8px] bg-[var(--eb-accent-light)] border border-[var(--eb-accent-border)] flex items-center justify-center overflow-hidden shrink-0">
                        {draft.application.appLogo ? (
                          <img
                            src={draft.application.appLogo}
                            alt="App"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Cake className="w-4 h-4 text-[var(--eb-accent)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--eb-text)] truncate">
                          {draft.application.appName || 'Easy Bill'}
                        </div>
                        <div className="text-[11px] text-[var(--eb-text-muted)] truncate">
                          {draft.company.name}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-[6px] bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)] font-medium shrink-0">
                      {themeMode === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </div>

                  {/* Regional Format Output */}
                  <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] divide-y divide-[var(--eb-border)] text-[12.5px] tabular-nums">
                    <div className="px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[var(--eb-text-muted)]">Today&apos;s Date Format</span>
                      <span className="font-semibold text-[var(--eb-text)]">
                        {formatYMD(getTodayYMD(), draft.application.dateFormat)}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[var(--eb-text-muted)]">Currency (Whole)</span>
                      <span className="font-semibold text-[var(--eb-text)]">
                        {formatCurrency(1250, draft.application.currencySymbol || '₹')}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[var(--eb-text-muted)]">Currency (Exact Line)</span>
                      <span className="font-semibold text-[var(--eb-text)]">
                        {formatMoneyExact(950.5, draft.application.currencySymbol || '₹')}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[var(--eb-text-muted)]">Browser Tab Title</span>
                      <span className="font-semibold text-[var(--eb-accent-text)] truncate max-w-[180px]">
                        {draft.application.appName || 'Easy Bill'} — {draft.company.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ==============================================================
              SECTION 4: BILLING & GST
             ============================================================== */}
          {activeTab === 'billing' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="pb-3 border-b border-[var(--eb-border)]">
                <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                  Billing, GST &amp; Counter Rules
                </h2>
                <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                  Control invoice numbering prefixes, tax calculation, counter discount caps, and default payment mode.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left Grouped Form */}
                <div className="xl:col-span-7 space-y-5">
                  {/* Group 1: Numbering */}
                  <div className="space-y-2.5">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                      Invoice &amp; Order Prefixes
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                          Walk-in Bill Prefix
                        </label>
                        <input
                          type="text"
                          value={draft.billing.billPrefix}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              billing: { ...d.billing, billPrefix: e.target.value },
                            }))
                          }
                          className={`${inputClass} uppercase`}
                        />
                        <p className="text-[11px] text-[var(--eb-text-subtle)] mt-1 tabular-nums">
                          Format: {draft.billing.billPrefix || 'EB'}-1042
                        </p>
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                          Cake Order Prefix
                        </label>
                        <input
                          type="text"
                          value={draft.billing.orderPrefix}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              billing: { ...d.billing, orderPrefix: e.target.value },
                            }))
                          }
                          className={`${inputClass} uppercase`}
                        />
                        <p className="text-[11px] text-[var(--eb-text-subtle)] mt-1 tabular-nums">
                          Format: {draft.billing.orderPrefix || 'ORD'}-208
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Tax & Discount Rules */}
                  <div className="space-y-2.5 pt-3 border-t border-[var(--eb-border)]">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                      Tax &amp; Discount Controls
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] space-y-2.5">
                        <label className="flex items-center justify-between gap-2 text-[13px] font-medium cursor-pointer text-[var(--eb-text)]">
                          <span>Enable GST / Tax on Bills</span>
                          <input
                            type="checkbox"
                            checked={draft.billing.gstEnabled}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                billing: { ...d.billing, gstEnabled: e.target.checked },
                              }))
                            }
                            className="w-4 h-4 accent-[var(--eb-accent)]"
                          />
                        </label>
                        <div>
                          <label className="block text-[11.5px] font-medium text-[var(--eb-text-muted)] mb-1">
                            GST / Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={28}
                            step="0.5"
                            disabled={!draft.billing.gstEnabled}
                            value={draft.billing.gstRate}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                billing: { ...d.billing, gstRate: Number(e.target.value) },
                              }))
                            }
                            className={`${inputClass} tabular-nums disabled:opacity-50`}
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] space-y-2.5">
                        <label className="flex items-center justify-between gap-2 text-[13px] font-medium cursor-pointer text-[var(--eb-text)]">
                          <span>Allow Counter Discounts</span>
                          <input
                            type="checkbox"
                            checked={draft.billing.allowDiscount}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                billing: { ...d.billing, allowDiscount: e.target.checked },
                              }))
                            }
                            className="w-4 h-4 accent-[var(--eb-accent)]"
                          />
                        </label>
                        <div>
                          <label className="block text-[11.5px] font-medium text-[var(--eb-text-muted)] mb-1">
                            Max Discount Cap (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={!draft.billing.allowDiscount}
                            value={draft.billing.maxDiscountPercent}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                billing: {
                                  ...d.billing,
                                  maxDiscountPercent: Number(e.target.value),
                                },
                              }))
                            }
                            className={`${inputClass} tabular-nums disabled:opacity-50`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Checkout Defaults & Receipt Footer */}
                  <div className="space-y-2.5 pt-3 border-t border-[var(--eb-border)]">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                      Checkout Defaults &amp; Footer
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                          Default Payment Mode
                        </label>
                        <select
                          value={draft.billing.defaultPaymentMode}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              billing: {
                                ...d.billing,
                                defaultPaymentMode: e.target.value as 'Cash' | 'UPI' | 'Card',
                              },
                            }))
                          }
                          className={`${inputClass} pr-9`}
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                        </select>
                        <p className="text-[11px] text-[var(--eb-text-subtle)] mt-1">
                          Pre-selected across POS Counter, Order Balance &amp; Accounts.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                          Receipt Thank-You Footer
                        </label>
                        <input
                          type="text"
                          value={draft.billing.receiptFooter}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              billing: { ...d.billing, receiptFooter: e.target.value },
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSettings ? 'Saving...' : 'Save Billing Settings'}</span>
                    </button>
                    {dirtyMap.billing && (
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Live Sample Tax / Billing Simulator */}
                <div className="xl:col-span-5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                      Live Tax &amp; Bill Simulator
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--eb-accent-text)] bg-[var(--eb-accent-light)] border border-[var(--eb-accent-border)] px-2 py-0.5 rounded-[6px] tabular-nums">
                      {draft.billing.billPrefix || 'EB'}-SAMPLE
                    </span>
                  </div>

                  <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] p-3.5 space-y-2.5 text-[12.5px] tabular-nums">
                    <div className="flex items-center justify-between text-[var(--eb-text)]">
                      <span>1.0 KG Belgian Truffle Cake</span>
                      <span className="font-semibold">{formatMoneyExact(simBaseSubtotal, sym)}</span>
                    </div>

                    {draft.billing.allowDiscount && (
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--eb-border)]">
                        <span className="text-[var(--eb-text-muted)]">
                          Test Discount (max {draft.billing.maxDiscountPercent}%)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={draft.billing.maxDiscountPercent}
                            value={effectiveSimDiscPct}
                            onChange={(e) => setSimDiscountPct(Number(e.target.value) || 0)}
                            className="w-14 h-[28px] px-2 rounded-[6px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-right text-[12px] font-semibold text-[var(--eb-text)]"
                          />
                          <span className="text-[11.5px] text-[var(--eb-text-muted)]">%</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-[var(--eb-border)] text-[12px]">
                      <div className="flex items-center justify-between text-[var(--eb-text-muted)]">
                        <span>Discount ({effectiveSimDiscPct}%)</span>
                        <span className="text-rose-600 dark:text-rose-400">
                          -{formatMoneyExact(simDiscountAmt, sym)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[var(--eb-text-muted)]">
                        <span>Taxable Amount</span>
                        <span>{formatMoneyExact(simTaxable, sym)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[var(--eb-text-muted)]">
                        <span>
                          GST ({draft.billing.gstEnabled ? `${draft.billing.gstRate}%` : 'Disabled'})
                        </span>
                        <span>{formatMoneyExact(simTaxAmt, sym)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-[var(--eb-border)] text-[14px] font-bold text-[var(--eb-text)]">
                        <span>Estimated Total ({draft.billing.defaultPaymentMode})</span>
                        <span className="text-[var(--eb-accent)]">
                          {formatMoneyExact(simGrandTotal, sym)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-[var(--eb-border)] text-center text-[11px] italic text-[var(--eb-text-muted)]">
                      &ldquo;{draft.billing.receiptFooter || 'Thank you for visiting!'}&rdquo;
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ==============================================================
              SECTION 5: PRINTER & RECEIPTS
             ============================================================== */}
          {activeTab === 'printer' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--eb-border)]">
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                    Thermal &amp; A4 Printer Setup
                  </h2>
                  <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                    Configure default receipt hardware, paper width, print copies, and auto-print trigger behavior.
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[12px] font-semibold shrink-0 whitespace-nowrap ${
                    draft.printer.isConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {draft.printer.isConnected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left Form */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Default Printer
                      </label>
                      <select
                        value={draft.printer.selectedPrinter}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            printer: { ...d.printer, selectedPrinter: e.target.value },
                          }))
                        }
                        className={`${inputClass} pr-9`}
                      >
                        {AVAILABLE_PRINTERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Paper Size
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['58mm', '80mm', 'A4'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, printer: { ...d.printer, paperSize: sz } }))
                            }
                            className={`h-[38px] rounded-[10px] text-[13px] font-medium border transition-colors ${
                              draft.printer.paperSize === sz
                                ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white'
                                : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                        Default Print Copies
                      </label>
                      <div className="grid grid-cols-5 gap-1.5 tabular-nums">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, printer: { ...d.printer, copies: num } }))
                            }
                            className={`h-[38px] rounded-[10px] text-[13px] font-semibold border transition-colors ${
                              (draft.printer.copies || 1) === num
                                ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white'
                                : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] space-y-2.5">
                    <label className="flex items-center justify-between gap-3 text-[13px] font-medium cursor-pointer text-[var(--eb-text)]">
                      <span>Printer Connected &amp; Ready</span>
                      <input
                        type="checkbox"
                        checked={draft.printer.isConnected}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            printer: { ...d.printer, isConnected: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 accent-[var(--eb-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 text-[13px] font-medium cursor-pointer text-[var(--eb-text)] pt-2 border-t border-[var(--eb-border)]">
                      <span>Auto-trigger print dialog on Save &amp; Print</span>
                      <input
                        type="checkbox"
                        checked={draft.printer.autoPrint}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            printer: { ...d.printer, autoPrint: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 accent-[var(--eb-accent)]"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSettings ? 'Saving...' : 'Save Printer Settings'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestPrint}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Test Print</span>
                    </button>

                    {dirtyMap.printer && (
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Hardware Profile Card */}
                <div className="xl:col-span-5 rounded-[12px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-4 space-y-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)]">
                    Hardware Output Profile
                  </div>
                  <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface)] divide-y divide-[var(--eb-border)] text-[12.5px] tabular-nums">
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[var(--eb-text-muted)]">Active Driver</span>
                      <span className="font-semibold text-[var(--eb-text)] truncate max-w-[200px]">
                        {draft.printer.selectedPrinter}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[var(--eb-text-muted)]">Roll / Sheet Width</span>
                      <span className="font-semibold text-[var(--eb-text)]">
                        {draft.printer.paperSize === '58mm'
                          ? '58mm Compact Thermal'
                          : draft.printer.paperSize === '80mm'
                          ? '80mm Standard POS'
                          : 'A4 Full Page Invoice'}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[var(--eb-text-muted)]">Copies per Print</span>
                      <span className="font-semibold text-[var(--eb-accent-text)]">
                        {draft.printer.copies || 1}{' '}
                        {(draft.printer.copies || 1) === 1 ? 'Copy' : 'Copies'}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[var(--eb-text-muted)]">Auto-Print Dialog</span>
                      <span className="font-semibold text-[var(--eb-text)]">
                        {draft.printer.autoPrint ? 'Enabled on Checkout' : 'Manual Preview'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-[var(--eb-text-muted)] leading-relaxed">
                    Receipt copy count and paper size automatically apply inside the Print Receipt modal across Billing, Cake Orders, and Sales History.
                  </p>
                </div>
              </div>
            </form>
          )}

          {/* ==============================================================
              SECTION 6: USERS & ROLES
             ============================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--eb-border)]">
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                    Staff &amp; Role Management
                  </h2>
                  <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                    Manage counter cashiers, managers, passwords, and granular module access permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddUserModal}
                  className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Staff User</span>
                </button>
              </div>

              {/* Staff Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3">
                  <div className="text-[11.5px] font-medium text-[var(--eb-text-muted)]">
                    Total Accounts
                  </div>
                  <div className="text-[20px] font-semibold text-[var(--eb-text)] mt-0.5">
                    {users.length}
                  </div>
                </div>
                <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3">
                  <div className="text-[11.5px] font-medium text-[var(--eb-text-muted)]">
                    Active Staff
                  </div>
                  <div className="text-[20px] font-semibold text-[#16A34A] dark:text-emerald-400 mt-0.5">
                    {activeUsersCount}
                  </div>
                </div>
                <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3">
                  <div className="text-[11.5px] font-medium text-[var(--eb-text-muted)]">
                    Administrators
                  </div>
                  <div className="text-[20px] font-semibold text-[var(--eb-accent-text)] mt-0.5">
                    {adminUsersCount}
                  </div>
                </div>
                <div className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3">
                  <div className="text-[11.5px] font-medium text-[var(--eb-text-muted)]">
                    Managers &amp; Cashiers
                  </div>
                  <div className="text-[20px] font-semibold text-[var(--eb-text)] mt-0.5">
                    {counterStaffCount}
                  </div>
                </div>
              </div>

              {loadingUsers && users.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[var(--eb-text-muted)]">
                  Loading staff accounts...
                </div>
              ) : (
                <>
                  {/* Mobile Staff Card List */}
                  <div className="md:hidden divide-y divide-[var(--eb-border)] border border-[var(--eb-border)] rounded-[12px]">
                    {users.map((u) => (
                      <div key={u.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--eb-accent-text)] truncate">
                              {u.username}
                            </p>
                            <p className="text-[14px] font-semibold text-[var(--eb-text)] truncate">
                              {u.fullName}
                            </p>
                          </div>
                          <div className="text-right shrink-0 text-[12px] font-medium">
                            <span className="capitalize block text-[var(--eb-text)]">{u.role}</span>
                            <span
                              className={
                                u.active
                                  ? 'text-[#16A34A] dark:text-emerald-400'
                                  : 'text-[var(--eb-text-muted)]'
                              }
                            >
                              {u.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[12px] font-normal text-[var(--eb-text-muted)]">
                          Modules:{' '}
                          {u.role === 'admin'
                            ? 'All Modules'
                            : MODULE_LABELS.filter((m) => u.permissions?.[m.key])
                                .map((m) => m.label)
                                .join(', ') || 'None'}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                            aria-label={`Edit ${u.username}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => setDeleteUserTarget(u)}
                              className="p-1.5 rounded-[8px] border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                              aria-label={`Delete ${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Staff Table */}
                  <div className="hidden md:block overflow-hidden border border-[var(--eb-border)] rounded-[12px]">
                    <table className="w-full table-fixed text-[13px] text-left border-collapse">
                      <thead className="bg-[var(--eb-table-header-bg)] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)] text-[12px]">
                        <tr>
                          <th className="px-4 py-2.5 w-[15%]">Username</th>
                          <th className="px-3 py-2.5 w-[19%]">Full Name</th>
                          <th className="px-3 py-2.5 w-[11%]">Role</th>
                          <th className="px-3 py-2.5 w-[10%]">Status</th>
                          <th className="px-3 py-2.5 w-[35%]">Allowed Modules</th>
                          <th className="px-4 py-2.5 w-[10%] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--eb-border)]">
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            className="hover:bg-[var(--eb-table-row-hover)] transition-colors"
                          >
                            <td className="px-4 py-2.5 font-semibold text-[var(--eb-accent-text)] truncate">
                              {u.username}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-[var(--eb-text)] truncate">
                              {u.fullName}
                            </td>
                            <td className="px-3 py-2.5 capitalize font-medium text-[var(--eb-text)] truncate">
                              <span className="inline-flex items-center gap-1">
                                {u.role === 'admin' && (
                                  <Shield className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
                                )}
                                <span>{u.role}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={
                                  u.active
                                    ? 'text-[#16A34A] dark:text-emerald-400 font-medium'
                                    : 'text-[var(--eb-text-muted)] font-medium'
                                }
                              >
                                {u.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-normal text-[var(--eb-text-muted)] truncate">
                              {u.role === 'admin'
                                ? 'All Modules'
                                : MODULE_LABELS.filter((m) => u.permissions?.[m.key])
                                    .map((m) => m.label)
                                    .join(', ') || 'None'}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditUserModal(u)}
                                  className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                                  aria-label={`Edit ${u.username}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {u.id !== currentUser?.id && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteUserTarget(u)}
                                    className="p-1.5 rounded-[8px] border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                                    aria-label={`Delete ${u.username}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==============================================================
              SECTION 7: BACKUP & DATA MANAGEMENT
             ============================================================== */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--eb-border)]">
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                    Backup &amp; Data Management
                  </h2>
                  <p className="text-[13px] text-[var(--eb-text-muted)] mt-0.5">
                    Inspect live database record counts, export a full JSON snapshot, or restore from an archive.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingBackupSummary}
                  onClick={loadBackupSummary}
                  className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-[12.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBackupSummary ? 'animate-spin' : ''}`} />
                  <span>Refresh Counts</span>
                </button>
              </div>

              {/* Live Database Inventory */}
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--eb-text-subtle)] mb-2.5">
                  Live Database Snapshot Inventory
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 tabular-nums">
                  {[
                    {
                      label: 'Products',
                      value: backupSummary?.products ?? '—',
                      icon: Package,
                    },
                    {
                      label: 'Categories',
                      value: backupSummary?.categories ?? '—',
                      icon: Tag,
                    },
                    {
                      label: 'Customers',
                      value: backupSummary?.customers ?? '—',
                      icon: UserCheck,
                    },
                    {
                      label: 'Bills',
                      value: backupSummary?.bills ?? '—',
                      icon: FileText,
                    },
                    {
                      label: 'Cake Orders',
                      value: backupSummary?.orders ?? '—',
                      icon: Cake,
                    },
                    {
                      label: 'Expenses',
                      value: backupSummary?.expenses ?? '—',
                      icon: Wallet,
                    },
                    {
                      label: 'Staff Users',
                      value: backupSummary?.users ?? '—',
                      icon: Users,
                    },
                  ].map((stat) => {
                    const StatIcon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className="rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-3"
                      >
                        <div className="flex items-center justify-between gap-1 text-[var(--eb-text-muted)]">
                          <span className="text-[11px] font-medium truncate">{stat.label}</span>
                          <StatIcon className="w-3.5 h-3.5 text-[var(--eb-accent)] shrink-0" />
                        </div>
                        <div className="text-[18px] font-semibold text-[var(--eb-text)] mt-1">
                          {stat.value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export & Restore Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-[12px] border border-[var(--eb-border)] p-4 space-y-3 bg-[var(--eb-surface-subtle)] flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h3 className="text-[15px] font-semibold text-[var(--eb-text)]">
                        Export Full Backup JSON
                      </h3>
                    </div>
                    <p className="text-[13px] font-normal text-[var(--eb-text-muted)] leading-relaxed">
                      Downloads a portable JSON archive containing all menu products, categories, customer profiles, bills, cake orders, expenses, and system settings.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Backup JSON</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[var(--eb-border)] p-4 space-y-3 bg-[var(--eb-surface-subtle)] flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <h3 className="text-[15px] font-semibold text-[var(--eb-text)]">
                        Restore From Archive
                      </h3>
                    </div>
                    <p className="text-[13px] font-normal text-[var(--eb-text-muted)] leading-relaxed">
                      Replaces current products, categories, orders, bills, expenses, and settings from an exported Easy Bill JSON snapshot.
                    </p>
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-[13.5px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0">
                      <Upload className="w-4 h-4" />
                      <span>Select Backup File</span>
                      <input
                        type="file"
                        accept="application/json"
                        onChange={handleBackupFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Sticky Footer Hint for Form Tabs */}
          {isFormTab && isAnyDirty && (
            <div className="lg:hidden mt-4 pt-3 border-t border-[var(--eb-border)] flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
                You have unsaved changes
              </span>
              <button
                type="button"
                disabled={savingSettings}
                onClick={saveDraftSettings}
                className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[12.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--eb-border)]">
              <h3 className="text-[18px] font-semibold text-[var(--eb-text)]">
                {editingUser ? `Edit User (${editingUser.username})` : 'Add Staff User'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] hover:bg-[var(--eb-btn-secondary-bg)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                    {editingUser ? 'New Password (Optional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editingUser ? 'Leave blank to keep' : 'Min 4 chars'}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={userForm.fullName}
                    onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1">
                    Role
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setUserForm((f) => ({
                        ...f,
                        role: nextRole,
                        permissions: editingUser
                          ? nextRole === 'admin'
                            ? getDefaultPermissionsForRole('admin')
                            : f.permissions
                          : getDefaultPermissionsForRole(nextRole),
                      }));
                    }}
                    className={`${inputClass} pr-9`}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-medium text-[var(--eb-text-muted)]">
                    Module Permissions
                  </p>
                  {userForm.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() =>
                        setUserForm((f) => ({
                          ...f,
                          permissions: getDefaultPermissionsForRole(f.role),
                        }))
                      }
                      className="text-[11px] font-medium text-[var(--eb-accent-text)] hover:underline"
                    >
                      Apply {userForm.role} defaults
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_LABELS.map((m) => (
                    <label
                      key={m.key}
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--eb-text)]"
                    >
                      <input
                        type="checkbox"
                        disabled={userForm.role === 'admin'}
                        checked={userForm.role === 'admin' || Boolean(userForm.permissions[m.key])}
                        onChange={(e) =>
                          setUserForm((f) => ({
                            ...f,
                            permissions: { ...f.permissions, [m.key]: e.target.checked },
                          }))
                        }
                        className="accent-[var(--eb-accent)]"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--eb-text)]">
                <input
                  type="checkbox"
                  checked={userForm.active}
                  onChange={(e) => setUserForm((f) => ({ ...f, active: e.target.checked }))}
                  className="accent-[var(--eb-accent)]"
                />
                <span>Account Active</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="h-[38px] px-4 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {savingUser ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        title="Delete User Account"
        description={`Are you sure you want to delete user "${deleteUserTarget?.username}"?`}
        confirmLabel="Delete User"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingRestoreJson)}
        title="Restore Database Backup"
        description="Restoring from a backup file will replace existing products, bills, orders, expenses, and settings. Continue?"
        confirmLabel="Restore Backup"
        cancelLabel="Cancel"
        variant="primary"
        loading={restoring}
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingRestoreJson(null)}
      />
    </div>
  );
}
