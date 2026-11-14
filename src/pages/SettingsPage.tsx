import React, { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getTodayYMD } from '../lib/format';
import type {
  AllSettings,
  AuthUser,
  ModuleKey,
  ReceiptData,
  UserPermissions,
  UserRole,
} from '../types';

interface SettingsPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

type SettingsTab =
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

const MODULE_LABELS: { key: ModuleKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'billing', label: 'Billing' },
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Products' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'settings', label: 'Settings' },
];

export function SettingsPage({ onPrintReceipt }: SettingsPageProps) {
  const { user: currentUser, refreshUser } = useAuth();
  const { settings, updateSettings, reloadSettings } = useSettings();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [draft, setDraft] = useState<AllSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'cashier' as UserRole,
    active: true,
    permissions: {
      home: true,
      billing: true,
      orders: true,
      sales: true,
      products: true,
      expenses: false,
      settings: false,
    } as UserPermissions,
  });
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AuthUser | null>(null);

  const [pendingRestoreJson, setPendingRestoreJson] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const loadUsers = useCallback(async () => {
    try {
      const list = await apiRequest<AuthUser[]>('/api/users');
      setUsers(list);
    } catch {
      // ignore if restricted
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, loadUsers]);

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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleTestPrint = () => {
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
      subtotal: 950,
      discountPercent: 0,
      discountAmount: 0,
      taxRate: draft.billing.gstEnabled ? draft.billing.gstRate : 0,
      taxAmount: draft.billing.gstEnabled ? (950 * draft.billing.gstRate) / 100 : 0,
      grandTotal: draft.billing.gstEnabled ? 950 + (950 * draft.billing.gstRate) / 100 : 950,
      paymentMode: 'Cash',
      amountReceived: draft.billing.gstEnabled ? 950 + (950 * draft.billing.gstRate) / 100 : 950,
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
      permissions: {
        home: true,
        billing: true,
        orders: true,
        sales: true,
        products: true,
        expenses: false,
        settings: false,
      },
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
      await reloadSettings();
      setPendingRestoreJson(null);
      showToast('Backup Restored', 'success', 'Database records and settings updated.');
    } catch (err: any) {
      showToast('Restore Failed', 'error', err?.message);
    } finally {
      setRestoring(false);
    }
  };

  const TABS: { key: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'company', label: 'Company', icon: Building2 },
    { key: 'application', label: 'Application', icon: Sliders },
    { key: 'billing', label: 'Billing & GST', icon: Receipt },
    { key: 'printer', label: 'Printer', icon: Printer },
    { key: 'users', label: 'Users & Roles', icon: Users },
    { key: 'backup', label: 'Backup & Data', icon: Database },
  ];

  const inputClass =
    'w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-[14px] font-medium text-[#302A40] dark:text-[#F3F1FA] focus:outline-none focus:border-[#7656C9]';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[22px] sm:text-[26px] leading-tight font-bold text-[#302A40] dark:text-[#F3F1FA]">
          Settings &amp; Administration
        </h1>
        <p className="text-[14px] font-normal text-[#817A91] mt-0.5">
          Configure cake shop branding, tax rates, thermal printers, staff permissions, and data backups.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[14px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#7656C9] border-[#7656C9] text-white'
                  : 'bg-white dark:bg-[#1B1726] border-[#EAE7F0] dark:border-[#2E2842] text-[#817A91] hover:bg-[#E9E2FF]/50 hover:text-[#302A40]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="eb-card p-4 sm:p-6">
        {/* 1. Company Settings */}
        {activeTab === 'company' && (
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Company / Cake Shop Settings</h2>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] flex items-center justify-center overflow-hidden shrink-0">
                {draft.company.logo ? (
                  <img
                    src={draft.company.logo}
                    alt="Company logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-[#7656C9]" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold cursor-pointer">
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
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-medium text-[#817A91]">
                  Displayed in the global header and printed receipts.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Cake Shop Name</label>
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
                <label className="block text-xs font-semibold mb-1">Phone Number</label>
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
                <label className="block text-xs font-semibold mb-1">Email</label>
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
                <label className="block text-xs font-semibold mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={draft.company.gstin}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, gstin: e.target.value } }))
                  }
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Shop Address</label>
                <textarea
                  rows={2}
                  value={draft.company.address}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, address: e.target.value } }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Saving...' : 'Save Company Settings'}</span>
            </button>
          </form>
        )}

        {/* 2. Application Settings */}
        {activeTab === 'application' && (
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Application Preferences</h2>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] flex items-center justify-center overflow-hidden shrink-0">
                {draft.application.appLogo ? (
                  <img
                    src={draft.application.appLogo}
                    alt="App logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Sliders className="w-6 h-6 text-[#7656C9]" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold cursor-pointer">
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
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Application Name</label>
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
                <label className="block text-xs font-semibold mb-1">Theme Mode</label>
                <select
                  value={draft.application.theme}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      application: {
                        ...d.application,
                        theme: e.target.value as 'light' | 'dark',
                      },
                    }))
                  }
                  className={inputClass}
                >
                  <option value="light">Mid-White Lavender (Light)</option>
                  <option value="dark">Deep Violet (Dark)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Date Format</label>
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
                  className={`${inputClass} tabular-nums`}
                >
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Currency Symbol</label>
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
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Saving...' : 'Save Application Settings'}</span>
            </button>
          </form>
        )}

        {/* 3. Billing Settings */}
        {activeTab === 'billing' && (
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Billing, Tax &amp; Receipt Settings</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Bill Number Prefix</label>
                <input
                  type="text"
                  value={draft.billing.billPrefix}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billing: { ...d.billing, billPrefix: e.target.value },
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Order Number Prefix</label>
                <input
                  type="text"
                  value={draft.billing.orderPrefix}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billing: { ...d.billing, orderPrefix: e.target.value },
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Default Payment Mode</label>
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
                  className={inputClass}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">GST / Tax Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.5"
                  value={draft.billing.gstRate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billing: { ...d.billing, gstRate: Number(e.target.value) },
                    }))
                  }
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Max Discount Allowed (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.billing.maxDiscountPercent}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billing: { ...d.billing, maxDiscountPercent: Number(e.target.value) },
                    }))
                  }
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.billing.gstEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        billing: { ...d.billing, gstEnabled: e.target.checked },
                      }))
                    }
                    className="accent-[#7656C9]"
                  />
                  <span>Enable GST / Tax on Bills</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.billing.allowDiscount}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        billing: { ...d.billing, allowDiscount: e.target.checked },
                      }))
                    }
                    className="accent-[#7656C9]"
                  />
                  <span>Allow Counter Discounts</span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Receipt Thank-You Footer</label>
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

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Saving...' : 'Save Billing Settings'}</span>
            </button>
          </form>
        )}

        {/* 4. Printer Settings */}
        {activeTab === 'printer' && (
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Thermal &amp; A4 Printer Settings</h2>
              <div
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  draft.printer.isConnected
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {draft.printer.isConnected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Disconnected</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Default Printer</label>
                <select
                  value={draft.printer.selectedPrinter}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      printer: { ...d.printer, selectedPrinter: e.target.value },
                    }))
                  }
                  className={inputClass}
                >
                  {AVAILABLE_PRINTERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Paper Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['58mm', '80mm', 'A4'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, printer: { ...d.printer, paperSize: sz } }))
                      }
                      className={`py-2 rounded-[10px] text-xs font-semibold border ${
                        draft.printer.paperSize === sz
                          ? 'bg-[#7656C9] border-[#7656C9] text-white'
                          : 'bg-[#E9E2FF]/55 dark:bg-[#2A233D] border-[#EAE7F0] dark:border-[#2E2842] text-[#4B3194] dark:text-[#D9CEFF]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.printer.isConnected}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        printer: { ...d.printer, isConnected: e.target.checked },
                      }))
                    }
                    className="accent-[#7656C9]"
                  />
                  <span>Printer Connected &amp; Ready</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.printer.autoPrint}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        printer: { ...d.printer, autoPrint: e.target.checked },
                      }))
                    }
                    className="accent-[#7656C9]"
                  />
                  <span>Auto-trigger print dialog on Save &amp; Print</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Printer Settings'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestPrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-[14px] font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>Test Print</span>
              </button>
            </div>
          </form>
        )}

        {/* 5. User Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Staff &amp; Role Management</h2>
                <p className="text-[14px] font-normal text-[#817A91] mt-0.5">
                  Manage counter cashiers, managers, passwords, and module access permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddUserModal}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold whitespace-nowrap shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {/* Mobile Staff Card List */}
            <div className="md:hidden divide-y divide-[#EAE7F0] dark:divide-[#2E2842] border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px]">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#7656C9] dark:text-[#C5B3F7] truncate">
                        {u.username}
                      </p>
                      <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                        {u.fullName}
                      </p>
                    </div>
                    <div className="text-right shrink-0 text-xs font-semibold">
                      <span className="capitalize block text-[#302A40] dark:text-[#E9E2FF]">
                        {u.role}
                      </span>
                      <span
                        className={
                          u.active
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-[#817A91]'
                        }
                      >
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-[#817A91]">
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
                      className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                      aria-label={`Edit ${u.username}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => setDeleteUserTarget(u)}
                        className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50"
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
            <div className="hidden md:block overflow-x-auto border border-[#EAE7F0] dark:border-[#2E2842] rounded-[12px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F7F7FB] dark:bg-[#151220] font-semibold text-[#817A91] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Allowed Modules</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-semibold text-[#7656C9] dark:text-[#C5B3F7]">
                        {u.username}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#302A40] dark:text-[#F3F1FA]">
                        {u.fullName}
                      </td>
                      <td className="px-4 py-3 capitalize font-semibold">{u.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            u.active
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'text-[#817A91] font-semibold'
                          }
                        >
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#817A91]">
                        {u.role === 'admin'
                          ? 'All Modules'
                          : MODULE_LABELS.filter((m) => u.permissions?.[m.key])
                              .map((m) => m.label)
                              .join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                            aria-label={`Edit ${u.username}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => setDeleteUserTarget(u)}
                              className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50"
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
          </div>
        )}

        {/* 6. Backup & Data Management */}
        {activeTab === 'backup' && (
          <div className="max-w-2xl space-y-5">
            <h2 className="font-display text-[17px] sm:text-[19px] font-semibold">Backup &amp; Data Management</h2>
            <p className="text-[14px] font-normal text-[#817A91] leading-relaxed">
              Export a complete JSON snapshot of your products, customers, bills, orders, expenses, and settings—or restore from a previous Easy Bill backup file.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] p-4 space-y-3 bg-[#F7F7FB] dark:bg-[#13101C]">
                <h3 className="font-display text-[15px] font-semibold">Export / Backup Data</h3>
                <p className="text-[13px] font-medium text-[#817A91]">
                  Downloads a portable JSON archive of all shop transactions and settings.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup JSON</span>
                </button>
              </div>

              <div className="rounded-[12px] border border-[#EAE7F0] dark:border-[#2E2842] p-4 space-y-3 bg-[#F7F7FB] dark:bg-[#13101C]">
                <h3 className="font-display text-[15px] font-semibold">Restore / Import Data</h3>
                <p className="text-[13px] font-medium text-[#817A91]">
                  Replaces current products, orders, bills, expenses, and settings from a backup file.
                </p>
                <label className="font-display inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-[14px] font-semibold cursor-pointer">
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
        )}
      </div>

      {/* Add / Edit User Modal */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <h3 className="font-display text-base font-bold">
                {editingUser ? `Edit User (${editingUser.username})` : 'Add Staff User'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Username *</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
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
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userForm.fullName}
                    onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, role: e.target.value as UserRole }))
                    }
                    className={inputClass}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2">Module Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_LABELS.map((m) => (
                    <label key={m.key} className="inline-flex items-center gap-2 text-xs font-medium">
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
                        className="accent-[#7656C9]"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={userForm.active}
                  onChange={(e) => setUserForm((f) => ({ ...f, active: e.target.checked }))}
                  className="accent-[#7656C9]"
                />
                <span>Account Active</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-[14px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold"
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
