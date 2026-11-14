import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Download,
  Edit3,
  Trash2,
  X,
  Wallet,
  Search,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  downloadCSV,
  formatCurrency,
  formatDateValue,
  formatMoneyExact,
  getTodayYMD,
} from '../lib/format';
import type { Expense, ExpenseCategory, ExpensePaymentMode } from '../types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Raw Materials',
  'Electricity',
  'Rent',
  'Employee Salary',
  'Packaging',
  'Transportation',
  'Maintenance',
  'Others',
];

const PAYMENT_MODES: ExpensePaymentMode[] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

export function ExpensesPage() {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExpenseCategory>('All');
  const [monthFilter, setMonthFilter] = useState(getTodayYMD().slice(0, 7));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    category: 'Raw Materials' as ExpenseCategory,
    description: '',
    amount: '',
    expenseDate: getTodayYMD(),
    paymentMode: 'Cash' as ExpensePaymentMode,
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sym = settings.application.currencySymbol || '₹';
  const dateFmt = settings.application.dateFormat || 'DD-MM-YYYY';

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiRequest<Expense[]>('/api/expenses');
      setExpenses(res);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load expenses.';
      setLoadError(msg);
      showToast('Failed to load expenses', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchSearch =
        !q ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'All' || e.category === categoryFilter;
      const matchMonth = !monthFilter || e.expenseDate.startsWith(monthFilter);
      return matchSearch && matchCat && matchMonth;
    });
  }, [expenses, search, categoryFilter, monthFilter]);

  const monthlySummary = useMemo(() => {
    const currentMonth = monthFilter || getTodayYMD().slice(0, 7);
    const inMonth = expenses.filter((e) => e.expenseDate.startsWith(currentMonth));
    const total = inMonth.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of inMonth) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
    let topCategory = 'None';
    let topAmount = 0;
    for (const [cat, amt] of byCategory.entries()) {
      if (amt > topAmount) {
        topAmount = amt;
        topCategory = cat;
      }
    }
    return { total, count: inMonth.length, topCategory, topAmount };
  }, [expenses, monthFilter]);

  const openAddModal = () => {
    setEditing(null);
    setForm({
      category: 'Raw Materials',
      description: '',
      amount: '',
      expenseDate: getTodayYMD(),
      paymentMode: 'Cash',
    });
    setModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditing(exp);
    setForm({
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      expenseDate: exp.expenseDate,
      paymentMode: exp.paymentMode,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) {
      showToast('Description Required', 'error');
      return;
    }
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Valid Amount Required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await apiRequest<Expense>(`/api/expenses/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...form, amount: amt }),
        });
        setExpenses((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
        showToast('Expense Updated', 'success');
      } else {
        const created = await apiRequest<Expense>('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({ ...form, amount: amt }),
        });
        setExpenses((prev) => [created, ...prev]);
        showToast('Expense Recorded', 'success');
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast('Save Failed', 'error', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/expenses/${deleteTarget.id}`, { method: 'DELETE' });
      setExpenses((prev) => prev.filter((ex) => ex.id !== deleteTarget.id));
      showToast('Expense Deleted', 'info');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('Delete Failed', 'error', err?.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      showToast('No expenses to export', 'info');
      return;
    }
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Mode', 'Recorded By'];
    const rows = filteredExpenses.map((e) => [
      formatDateValue(e.expenseDate, dateFmt),
      e.category,
      e.description,
      e.amount,
      e.paymentMode,
      e.username,
    ]);
    downloadCSV(`easybill-expenses-${monthFilter || 'all'}.csv`, headers, rows);
    showToast('Expense report exported', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] leading-tight font-bold text-[#302A40] dark:text-[#F3F1FA]">
            Expenses &amp; Shop Ledger
          </h1>
          <p className="text-[14px] font-normal text-[#817A91] mt-0.5">
            Track raw material purchases, utilities, rent, packaging, and staff payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-[14px] font-semibold whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Monthly Expense Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="eb-card p-4">
          <p className="text-[13px] font-semibold text-[#817A91]">
            Monthly Total Expenses ({monthFilter || 'All'})
          </p>
          <p className="mt-1.5 font-display text-[26px] sm:text-[28px] leading-tight font-bold tabular-nums text-[#302A40] dark:text-[#F3F1FA]">
            {formatCurrency(monthlySummary.total, sym)}
          </p>
        </div>
        <div className="eb-card p-4">
          <p className="text-[13px] font-semibold text-[#817A91]">Expense Entries</p>
          <p className="mt-1.5 font-display text-[26px] sm:text-[28px] leading-tight font-bold tabular-nums text-[#302A40] dark:text-[#F3F1FA]">
            {monthlySummary.count}
          </p>
        </div>
        <div className="eb-card p-4">
          <p className="text-[13px] font-semibold text-[#817A91]">Highest Spend Category</p>
          <p className="mt-1.5 font-display text-[19px] font-bold text-[#302A40] dark:text-[#F3F1FA] truncate">
            {monthlySummary.topCategory}{' '}
            {monthlySummary.topAmount > 0 && (
              <span className="text-[14px] font-bold text-[#7656C9] dark:text-[#C5B3F7] ml-1 tabular-nums">
                ({formatCurrency(monthlySummary.topAmount, sym)})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 text-[#817A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description or category..."
            className="pl-9 pr-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-medium w-full sm:w-60 focus:outline-none focus:border-[#7656C9]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'All' | ExpenseCategory)}
          aria-label="Filter by expense category"
          className="flex-1 min-w-[140px] sm:flex-none px-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-semibold focus:outline-none focus:border-[#7656C9]"
        >
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Filter by month"
          className="flex-1 min-w-[140px] sm:flex-none px-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
        />

        {monthFilter && (
          <button
            type="button"
            onClick={() => setMonthFilter('')}
            className="px-3 py-2 rounded-[10px] bg-[#E9E2FF] text-[#4B3194] text-xs font-semibold whitespace-nowrap"
          >
            All Months
          </button>
        )}
      </div>

      {/* Expense Table / Mobile Cards */}
      <div className="eb-card overflow-hidden">
        {loading ? (
          <div className="p-6 sm:p-8 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-[10px] bg-[#F7F7FB] dark:bg-[#13101C]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-9 h-9 mx-auto text-rose-500" />
            <div>
              <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                Unable to load expenses
              </p>
              <p className="text-xs font-medium text-[#817A91] mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadExpenses}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-10 sm:p-12 text-center">
            <Wallet className="w-9 h-9 mx-auto text-[#817A91]/50 mb-2" />
            <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              No expense entries found
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Expense Cards */}
            <div className="md:hidden divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#7656C9] dark:text-[#C5B3F7]">
                        {exp.category}
                      </span>
                      <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                        {exp.description}
                      </p>
                      <p className="text-[11px] font-medium text-[#817A91] tabular-nums">
                        {formatDateValue(exp.expenseDate, dateFmt)} · {exp.paymentMode} · {exp.username}
                      </p>
                    </div>
                    <p className="font-display text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums shrink-0">
                      {formatMoneyExact(exp.amount, sym)}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(exp)}
                      className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                      aria-label={`Edit ${exp.description}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(exp)}
                      className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50"
                      aria-label={`Delete ${exp.description}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Expense Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[14px] text-left">
                <thead className="bg-[#F7F7FB] dark:bg-[#151220] text-[13px] font-semibold text-[#817A91] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Added By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                  {filteredExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-[#F7F7FB]/80 dark:hover:bg-[#231E33] transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-[#817A91] tabular-nums whitespace-nowrap">
                        {formatDateValue(exp.expenseDate, dateFmt)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#7656C9] dark:text-[#C5B3F7] whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#302A40] dark:text-[#F3F1FA]">
                        {exp.description}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#817A91] whitespace-nowrap">
                        {exp.paymentMode}
                      </td>
                      <td className="px-4 py-3 text-right font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
                        {formatMoneyExact(exp.amount, sym)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#817A91] whitespace-nowrap">
                        {exp.username}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                            aria-label="Edit expense"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(exp)}
                            className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <h3 className="font-display text-base font-bold">
                {editing ? 'Edit Expense' : 'Add New Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Heavy cream & Belgian cocoa"
                  className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Amount ({sym}) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="1500"
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-bold tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Mode</label>
                  <select
                    value={form.paymentMode}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as ExpensePaymentMode }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-[14px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-[14px] font-semibold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Expense"
        description={`Are you sure you want to delete "${deleteTarget?.description}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
