import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Star,
  Edit3,
  Trash2,
  X,
  Upload,
  Cake,
  Power,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProductImage } from '../components/ProductImage';
import { formatMoneyExact } from '../lib/format';
import type { MeasurementUnit, Product, ProductCategory } from '../types';

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Cakes',
  'Pastries',
  'Cupcakes',
  'Chocolates',
  'Cookies',
  'Desserts',
  'Snacks',
  'Beverages',
  'Others',
];

const MEASUREMENT_UNITS: MeasurementUnit[] = ['KG', 'Gram', 'Piece'];

const PRESET_IMAGES = [
  { label: 'Truffle Cake', url: '/src/assets/images/product_truffle_cake_1794586326747.jpg' },
  { label: 'Red Velvet', url: '/src/assets/images/product_red_velvet_1794586327823.jpg' },
  { label: 'Fruit Pastry', url: '/src/assets/images/product_fruit_pastry_1794586327935.jpg' },
  { label: 'Cupcakes', url: '/src/assets/images/product_gourmet_cupcakes_1794586328314.jpg' },
  { label: 'Chocolates', url: '/src/assets/images/product_chocolate_truffles_1794586329086.jpg' },
  { label: 'Cookies', url: '/src/assets/images/product_bakery_cookies_1794586329016.jpg' },
];

export function ProductsPage() {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductCategory>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Disabled' | 'Favorites'>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Cakes' as ProductCategory,
    price: '',
    unit: 'KG' as MeasurementUnit,
    image: '',
    isFavorite: false,
    isActive: true,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sym = settings.application.currencySymbol || '₹';

  const loadProducts = useCallback(async () => {
    try {
      const res = await apiRequest<Product[]>('/api/products');
      setProducts(res);
    } catch (err: any) {
      showToast('Failed to load products', 'error', err?.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
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

  const openAddModal = () => {
    setEditing(null);
    setForm({
      name: '',
      category: 'Cakes',
      price: '',
      unit: 'KG',
      image: PRESET_IMAGES[0].url,
      isFavorite: false,
      isActive: true,
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      image: product.image,
      isFavorite: product.isFavorite,
      isActive: product.isActive,
      description: product.description,
    });
    setModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Image too large', 'error', 'Please choose an image smaller than 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((f) => ({ ...f, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Product Name Required', 'error');
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      showToast('Valid Price Required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await apiRequest<Product>(`/api/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...form, price: priceNum }),
        });
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast('Product Updated', 'success', updated.name);
      } else {
        const created = await apiRequest<Product>('/api/products', {
          method: 'POST',
          body: JSON.stringify({ ...form, price: priceNum }),
        });
        setProducts((prev) => [created, ...prev]);
        showToast('Product Added', 'success', created.name);
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast('Save Failed', 'error', err?.message);
    } finally {
      setSaving(false);
    }
  };

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

  const handleDelete = async () => {
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[#302A40] dark:text-[#F3F1FA]">
            Products &amp; Menu Catalog
          </h1>
          <p className="text-xs font-medium text-[#817A91] mt-0.5">
            Add cakes, pastries, and bakery items with pricing, units, images, and favorites.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#817A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 pr-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-medium w-56 focus:outline-none focus:border-[#7656C9]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'All' | ProductCategory)}
            aria-label="Filter by category"
            className="px-3 py-2 rounded-[10px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-xs font-semibold focus:outline-none focus:border-[#7656C9]"
          >
            <option value="All">All Categories</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-[12px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842]">
          {(['All', 'Active', 'Disabled', 'Favorites'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[#7656C9] text-white'
                  : 'text-[#817A91] hover:text-[#302A40] dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="eb-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-[10px] bg-[#F7F7FB] dark:bg-[#13101C]" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Cake className="w-9 h-9 mx-auto text-[#817A91]/50 mb-2" />
            <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              No products found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F7F7FB] dark:bg-[#151220] text-xs font-semibold text-[#817A91] border-b border-[#EAE7F0] dark:border-[#2E2842]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-center">Favorite</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-[#F7F7FB]/80 dark:hover:bg-[#231E33] transition-colors ${
                      !product.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-[10px] overflow-hidden shrink-0 border border-[#EAE7F0] dark:border-[#2E2842]">
                          <ProductImage src={product.image} alt={product.name} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="text-xs font-medium text-[#817A91] truncate max-w-xs">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-[#817A91] whitespace-nowrap">
                      {product.category}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF] whitespace-nowrap">
                      {product.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums whitespace-nowrap">
                      {formatMoneyExact(product.price, sym)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(product)}
                        aria-label="Toggle favorite"
                        className="p-1.5 rounded-[10px] hover:bg-[#E9E2FF]/60"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            product.isFavorite
                              ? 'text-[#7656C9] fill-[#7656C9]'
                              : 'text-[#817A91]'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-[10px] border transition-colors ${
                          product.isActive
                            ? 'border-[#EAE7F0] bg-[#E9E2FF] text-[#4B3194]'
                            : 'border-[#EAE7F0] bg-[#F7F7FB] text-[#817A91]'
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
                          onClick={() => openEditModal(product)}
                          className="p-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194]"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          className="p-1.5 rounded-[10px] border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50"
                          aria-label={`Delete ${product.name}`}
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
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_16px_44px_rgba(48,42,64,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE7F0] dark:border-[#2E2842]">
              <h3 className="font-display text-base font-bold">
                {editing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-[10px] text-[#817A91] hover:text-[#302A40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold mb-1">Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Belgian Chocolate Truffle"
                  className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))}
                    className="w-full px-2.5 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as MeasurementUnit }))}
                    className="w-full px-2.5 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  >
                    {MEASUREMENT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Price ({sym}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="950"
                    className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-bold tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Product Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 rounded-[10px] overflow-hidden border border-[#EAE7F0] dark:border-[#2E2842] shrink-0">
                    <ProductImage src={form.image} alt={form.name || 'Preview'} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, image: preset.url }))}
                          className={`px-2 py-0.5 rounded-[8px] text-[11px] font-medium border ${
                            form.image === preset.url
                              ? 'border-[#7656C9] bg-[#E9E2FF] text-[#4B3194] font-semibold'
                              : 'border-[#EAE7F0] dark:border-[#2E2842] text-[#817A91]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of flavor or ingredients..."
                  className="w-full px-3 py-2 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFavorite}
                    onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))}
                    className="accent-[#7656C9]"
                  />
                  <span>Mark as Favorite</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="accent-[#7656C9]"
                  />
                  <span>Active in POS Billing</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.name}" from your menu catalog?`}
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
