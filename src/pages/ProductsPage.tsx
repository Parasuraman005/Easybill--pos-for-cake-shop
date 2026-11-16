import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Star,
  Edit3,
  Trash2,
  Cake,
  Power,
  AlertCircle,
  RotateCcw,
  FolderPlus,
  X,
  Check,
  Tag,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProductImage } from '../components/ProductImage';
import { formatMoneyExact } from '../lib/format';
import { DEFAULT_PRODUCT_CATEGORIES, type CategoryItem, type Product } from '../types';

interface ProductsPageProps {
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
}

export function ProductsPage({ onAddProduct, onEditProduct }: ProductsPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    DEFAULT_PRODUCT_CATEGORIES.map((name, idx) => ({
      id: `default-${idx}`,
      name,
      isCustom: false,
      sortOrder: idx + 1,
      createdAt: '',
    }))
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Disabled' | 'Favorites'>('All');

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [updatingCat, setUpdatingCat] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const sym = settings.application.currencySymbol || '₹';

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<CategoryItem[]>('/api/categories').catch(() => null),
      ]);
      setProducts(prodRes);
      if (Array.isArray(catRes) && catRes.length > 0) {
        setCategories(catRes);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to load products.';
      setLoadError(msg);
      showToast('Failed to load products', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const productCountsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.category, (map.get(p.category) || 0) + 1);
    }
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);
      const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
      const matchStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Active'
          ? p.isActive
          : statusFilter === 'Disabled'
          ? !p.isActive
          : p.isFavorite;
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    let active = 0;
    let favorites = 0;
    for (const p of products) {
      if (p.isActive) active += 1;
      if (p.isFavorite) favorites += 1;
    }
    return { total: products.length, active, favorites };
  }, [products]);

  const handleToggleFavorite = async (product: Product) => {
    try {
      const updated = await apiRequest<Product>(`/api/products/${product.id}/favorite`, {
        method: 'PATCH',
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      showToast('Failed to update favorite', 'error', err?.message);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const updated = await apiRequest<Product>(`/api/products/${product.id}/toggle`, {
        method: 'PATCH',
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(
        updated.isActive ? 'Product Enabled' : 'Product Disabled',
        'info',
        updated.name
      );
    } catch (err: any) {
      showToast('Failed to update status', 'error', err?.message);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast('Product Deleted', 'info', deleteTarget.name);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast('Delete Failed', 'error', err?.message);
    } finally {
      setDeleting(false);
    }
  };

  const openCategoryModal = (catToEdit?: CategoryItem) => {
    setCategoryModalOpen(true);
    setNewCategoryName('');
    if (catToEdit && catToEdit.isCustom) {
      setEditingCatId(catToEdit.id);
      setEditingCatName(catToEdit.name);
    } else {
      setEditingCatId(null);
      setEditingCatName('');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) {
      showToast('Category Name Required', 'error', 'Enter a custom category name.');
      return;
    }

    setSavingCategory(true);
    try {
      const created = await apiRequest<CategoryItem>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: clean }),
      });
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
      showToast('Category Added', 'success', created.name);
    } catch (err: any) {
      showToast('Could not add category', 'error', err?.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveCategoryRename = async (cat: CategoryItem) => {
    const clean = editingCatName.trim();
    if (!clean) {
      showToast('Category Name Required', 'error');
      return;
    }
    if (clean === cat.name) {
      setEditingCatId(null);
      setEditingCatName('');
      return;
    }

    setUpdatingCat(true);
    try {
      const updated = await apiRequest<CategoryItem>(`/api/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: clean }),
      });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setProducts((prev) =>
        prev.map((p) => (p.category === cat.name ? { ...p, category: updated.name } : p))
      );
      if (categoryFilter === cat.name) {
        setCategoryFilter(updated.name);
      }
      setEditingCatId(null);
      setEditingCatName('');
      showToast('Category Updated', 'success', updated.name);
    } catch (err: any) {
      showToast('Could not update category', 'error', err?.message);
    } finally {
      setUpdatingCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true);
    try {
      await apiRequest(`/api/categories/${deleteCategoryTarget.id}`, {
        method: 'DELETE',
      });
      setCategories((prev) => prev.filter((c) => c.id !== deleteCategoryTarget.id));
      setProducts((prev) =>
        prev.map((p) =>
          p.category === deleteCategoryTarget.name ? { ...p, category: 'Others' } : p
        )
      );
      if (categoryFilter === deleteCategoryTarget.name) {
        setCategoryFilter('All');
      }
      showToast(
        'Category Deleted',
        'info',
        `${deleteCategoryTarget.name} removed (products moved to Others)`
      );
      setDeleteCategoryTarget(null);
    } catch (err: any) {
      showToast('Delete Failed', 'error', err?.message);
    } finally {
      setDeletingCategory(false);
    }
  };

  const customCategories = useMemo(
    () => categories.filter((c) => c.isCustom),
    [categories]
  );

  const builtInCategories = useMemo(
    () => categories.filter((c) => !c.isCustom),
    [categories]
  );

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* 1. Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight">
            Products &amp; Menu Catalog
          </h1>
          <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 truncate">
            Add and manage cakes, pastries, and other bakery products with pricing, units, images, and favorite options.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openCategoryModal()}
            className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Category</span>
          </button>

          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Category & Product Filter Bar */}
      <section aria-label="Catalog Filters" className="eb-card p-2.5 space-y-2 shrink-0">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[var(--eb-border)]">
          <button
            type="button"
            onClick={() => setCategoryFilter('All')}
            className={`px-2.5 py-1 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap ${
              categoryFilter === 'All'
                ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                : 'bg-[var(--eb-bg)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] border border-[var(--eb-border)]'
            }`}
          >
            All Categories
          </button>

          {categories.map((cat) => {
            const active = categoryFilter === cat.name;
            if (!cat.isCustom) {
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`px-2.5 py-1 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                      : 'bg-[var(--eb-bg)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] border border-[var(--eb-border)]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            }

            return (
              <div
                key={cat.id}
                className={`inline-flex items-center rounded-[8px] border transition-colors ${
                  active
                    ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                    : 'bg-[var(--eb-bg)] border-[var(--eb-border)] text-[var(--eb-text)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter(cat.name)}
                  className="pl-2.5 pr-1 py-1 text-[12px] font-medium whitespace-nowrap"
                >
                  {cat.name}
                </button>
                <button
                  type="button"
                  onClick={() => openCategoryModal(cat)}
                  aria-label={`Edit category ${cat.name}`}
                  title={`Edit ${cat.name}`}
                  className={`p-1 transition-colors ${
                    active
                      ? 'text-white/85 hover:text-amber-200'
                      : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteCategoryTarget(cat)}
                  aria-label={`Delete category ${cat.name}`}
                  title={`Delete ${cat.name}`}
                  className={`pr-1.5 pl-0.5 py-1 transition-colors ${
                    active
                      ? 'text-white/85 hover:text-rose-200'
                      : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Search & Product Status Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or category..."
              className="w-full h-[38px] pl-9 pr-8 py-1.5 rounded-[10px] bg-[var(--eb-bg)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear product search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[var(--eb-bg)] border border-[var(--eb-border)] self-start sm:self-auto overflow-x-auto max-w-full">
            {(['All', 'Active', 'Disabled', 'Favorites'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                    : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Products Table / Mobile Cards */}
      <section aria-label="Products Table" className="eb-card flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2.5 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3 my-auto">
            <AlertCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                Unable to load products
              </p>
              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadCatalog}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-10 text-center my-auto space-y-2">
            <Cake className="w-9 h-9 mx-auto text-[var(--eb-accent)]/50" />
            <p className="text-[14px] font-semibold text-[var(--eb-text)]">
              No products match the active filters
            </p>
            {(search || categoryFilter !== 'All' || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('All');
                  setStatusFilter('All');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Product Cards */}
            <div className="md:hidden divide-y divide-[var(--eb-border)]">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`p-3.5 space-y-2.5 ${!product.isActive ? 'opacity-65' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-12 rounded-[10px] overflow-hidden shrink-0 border border-[var(--eb-border)]">
                      <ProductImage src={product.image} alt={product.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] text-[var(--eb-text)] truncate">
                        {product.name}
                      </p>
                      <p className="text-[12px] font-medium text-[var(--eb-text-muted)]">
                        {product.category} · {product.unit}
                      </p>
                      <p className="mt-0.5 text-[14px] font-bold text-[var(--eb-text)] tabular-nums">
                        {formatMoneyExact(product.price, sym)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(product)}
                      aria-label={`Toggle favorite for ${product.name}`}
                      className="p-1.5 rounded-[10px] hover:bg-amber-50 dark:hover:bg-amber-950/40 shrink-0 transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          product.isFavorite
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-[var(--eb-text-muted)]'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-[10px] border transition-colors whitespace-nowrap shrink-0 ${
                        product.isActive
                          ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{product.isActive ? 'Active' : 'Disabled'}</span>
                    </button>

                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditProduct(product)}
                        className="p-1.5 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                        aria-label={`Edit ${product.name}`}
                        title={`Edit ${product.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(product)}
                        className="p-1.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Products Table (Fits screen width, internal vertical scroll) */}
            <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar">
              <table className="w-full table-fixed text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--eb-table-header-bg)] text-[12px] font-semibold text-[var(--eb-text-muted)] border-b border-[var(--eb-border)]">
                  <tr>
                    <th className="px-4 py-3 w-[34%]">Product</th>
                    <th className="px-3 py-3 w-[15%]">Category</th>
                    <th className="px-3 py-3 w-[9%]">Unit</th>
                    <th className="px-3 py-3 w-[12%] text-right">Price</th>
                    <th className="px-3 py-3 w-[9%] text-center">Favorite</th>
                    <th className="px-3 py-3 w-[11%] text-center">Status</th>
                    <th className="px-4 py-3 w-[10%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--eb-border)]">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-[var(--eb-table-row-hover)] transition-colors ${
                        !product.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-9 rounded-[9px] overflow-hidden shrink-0 border border-[var(--eb-border)]">
                            <ProductImage src={product.image} alt={product.name} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[13px] text-[var(--eb-text)] truncate">
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-[12px] font-medium text-[var(--eb-text-muted)] truncate">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--eb-text-muted)] truncate">
                        {product.category}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-[var(--eb-text)] whitespace-nowrap">
                        {product.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-bold text-[var(--eb-text)] tabular-nums whitespace-nowrap">
                        {formatMoneyExact(product.price, sym)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(product)}
                          aria-label={`Toggle favorite for ${product.name}`}
                          className="p-1.5 rounded-[10px] hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              product.isFavorite
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-[var(--eb-text-muted)]'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-[10px] border transition-colors whitespace-nowrap shrink-0 ${
                            product.isActive
                              ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{product.isActive ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditProduct(product)}
                            className="p-1.5 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                            aria-label={`Edit ${product.name}`}
                            title={`Edit ${product.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            className="p-1.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                            aria-label={`Delete ${product.name}`}
                            title={`Delete ${product.name}`}
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

            {/* Compact Catalog Footer */}
            <div className="px-4 py-2.5 border-t border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-[var(--eb-text-muted)] shrink-0 tabular-nums">
              <span>
                Showing{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {filteredProducts.length}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--eb-text)]">
                  {stats.total}
                </strong>{' '}
                products
              </span>
              <span className="flex items-center gap-2.5">
                <span>
                  Active:{' '}
                  <strong className="font-semibold text-[#16A34A]">
                    {stats.active}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Favorites:{' '}
                  <strong className="font-semibold text-[var(--eb-accent)]">
                    {stats.favorites}
                  </strong>
                </span>
              </span>
            </div>
          </>
        )}
      </section>

      {/* Add / Manage Categories Modal */}
      {categoryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-lg rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-[0_16px_40px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--eb-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[var(--eb-accent)]" />
                <h2
                  id="category-modal-title"
                  className="text-[18px] font-semibold text-[var(--eb-text)]"
                >
                  Manage Categories
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategoryModalOpen(false);
                  setEditingCatId(null);
                }}
                aria-label="Close category modal"
                className="p-1.5 rounded-[8px] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto thin-scrollbar">
              {/* Add Category Form */}
              <form onSubmit={handleAddCategory} className="space-y-1.5">
                <label
                  htmlFor="new-category-name"
                  className="block text-[12px] font-medium text-[var(--eb-text-muted)]"
                >
                  Add Custom Category
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="new-category-name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Cheesecake, Brownies, Hampers..."
                    maxLength={40}
                    autoFocus={!editingCatId}
                    className="flex-1 h-[40px] px-3 py-2 rounded-[10px] bg-[var(--eb-input-bg)] border border-[var(--eb-border)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="inline-flex items-center gap-1.5 h-[40px] px-4 rounded-[10px] bg-[var(--eb-accent)] hover:opacity-90 disabled:opacity-60 text-white text-[14px] font-medium whitespace-nowrap shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingCategory ? 'Adding...' : 'Add'}</span>
                  </button>
                </div>
              </form>

              {/* Custom Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[var(--eb-text)]">
                    Custom Categories ({customCategories.length})
                  </h3>
                  <span className="text-[12px] text-[var(--eb-text-muted)]">
                    Editable &amp; removable
                  </span>
                </div>

                {customCategories.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] p-4 text-center text-[12px] text-[var(--eb-text-muted)]">
                    No custom categories yet. Add one above to organize specialized menu items.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--eb-border)] rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)]">
                    {customCategories.map((cat) => {
                      const isEditingThis = editingCatId === cat.id;
                      const count = productCountsByCategory.get(cat.name) || 0;
                      return (
                        <div
                          key={cat.id}
                          className="px-3 py-2.5 flex items-center justify-between gap-2"
                        >
                          {isEditingThis ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editingCatName}
                                onChange={(e) => setEditingCatName(e.target.value)}
                                maxLength={40}
                                autoFocus
                                className="flex-1 h-[36px] px-2.5 rounded-[8px] bg-[var(--eb-surface)] border border-[var(--eb-accent)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={updatingCat}
                                onClick={() => handleSaveCategoryRename(cat)}
                                aria-label="Save category name"
                                className="p-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(null);
                                  setEditingCatName('');
                                }}
                                aria-label="Cancel rename"
                                className="p-1.5 rounded-[8px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[var(--eb-text)] truncate">
                                  {cat.name}
                                </p>
                                <p className="text-[12px] text-[var(--eb-text-muted)] tabular-nums">
                                  {count} {count === 1 ? 'product' : 'products'}
                                </p>
                              </div>
                              <div className="inline-flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatId(cat.id);
                                    setEditingCatName(cat.name);
                                  }}
                                  aria-label={`Rename ${cat.name}`}
                                  className="p-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteCategoryTarget(cat)}
                                  aria-label={`Delete ${cat.name}`}
                                  className="p-1.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Built-in Categories Preview */}
              <div className="space-y-1.5">
                <p className="text-[12px] font-semibold text-[var(--eb-text-muted)]">
                  Default Categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {builtInCategories.map((c) => (
                    <span
                      key={c.id}
                      className="px-2.5 py-1 rounded-[8px] bg-[var(--eb-surface-subtle)] border border-[var(--eb-border)] text-[12px] font-medium text-[var(--eb-text-muted)]"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Product */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.name}" from your menu catalog?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm Delete Custom Category */}
      <ConfirmDialog
        open={Boolean(deleteCategoryTarget)}
        title="Delete Custom Category"
        description={`Delete category "${deleteCategoryTarget?.name}"? Any products in this category will automatically be moved to "Others".`}
        confirmLabel="Delete Category"
        cancelLabel="Cancel"
        variant="danger"
        loading={deletingCategory}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCategoryTarget(null)}
      />
    </div>
  );
}
