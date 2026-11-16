import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Star,
  Power,
  AlertCircle,
  RotateCcw,
  Cake,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ProductImage } from '../components/ProductImage';
import { formatMoneyExact } from '../lib/format';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  type CategoryItem,
  type MeasurementUnit,
  type Product,
  type ProductCategory,
} from '../types';

export const PRODUCT_CATEGORIES: string[] = [...DEFAULT_PRODUCT_CATEGORIES];

export const MEASUREMENT_UNITS: MeasurementUnit[] = ['KG', 'Gram', 'Piece'];

export const PRESET_IMAGES = [
  { label: 'Truffle Cake', url: '/images/product_truffle_cake_1794586326747.jpg' },
  { label: 'Red Velvet', url: '/images/product_red_velvet_1794586327823.jpg' },
  { label: 'Fruit Pastry', url: '/images/product_fruit_pastry_1794586327935.jpg' },
  { label: 'Cupcakes', url: '/images/product_gourmet_cupcakes_1794586328314.jpg' },
  { label: 'Chocolates', url: '/images/product_chocolate_truffles_1794586329086.jpg' },
  { label: 'Cookies', url: '/images/product_bakery_cookies_1794586329016.jpg' },
];

interface ProductFormPageProps {
  mode: 'new' | 'edit';
  productId?: string;
  initialProduct?: Product | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function ProductFormPage({
  mode,
  productId,
  initialProduct,
  onCancel,
  onSaved,
}: ProductFormPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const sym = settings.application.currencySymbol || '₹';

  const isEdit = mode === 'edit';

  const [loading, setLoading] = useState(
    isEdit && (!initialProduct || initialProduct.id !== productId)
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>(PRODUCT_CATEGORIES);

  useEffect(() => {
    let active = true;
    apiRequest<CategoryItem[]>('/api/categories')
      .then((rows) => {
        if (!active || !Array.isArray(rows) || rows.length === 0) return;
        setCategories(rows.map((r) => r.name));
      })
      .catch(() => {
        // Keep built-in categories fallback if request fails
      });
    return () => {
      active = false;
    };
  }, []);

  const [form, setForm] = useState(() => {
    if (isEdit && initialProduct && initialProduct.id === productId) {
      return {
        name: initialProduct.name,
        category: initialProduct.category,
        price: String(initialProduct.price),
        unit: initialProduct.unit,
        image: initialProduct.image,
        isFavorite: initialProduct.isFavorite,
        isActive: initialProduct.isActive,
        description: initialProduct.description || '',
      };
    }
    return {
      name: '',
      category: 'Cakes' as ProductCategory,
      price: '',
      unit: 'KG' as MeasurementUnit,
      image: PRESET_IMAGES[0].url,
      isFavorite: false,
      isActive: true,
      description: '',
    };
  });

  const loadProduct = useCallback(async () => {
    if (!isEdit || !productId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const product = await apiRequest<Product>(
        `/api/products/${encodeURIComponent(productId)}`
      );
      setForm({
        name: product.name,
        category: product.category,
        price: String(product.price),
        unit: product.unit,
        image: product.image,
        isFavorite: product.isFavorite,
        isActive: product.isActive,
        description: product.description || '',
      });
    } catch (err: any) {
      const msg = err?.message || 'Unable to load product details.';
      setLoadError(msg);
      showToast('Failed to load product', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [isEdit, productId, showToast]);

  useEffect(() => {
    if (isEdit) {
      if (initialProduct && initialProduct.id === productId) {
        setForm({
          name: initialProduct.name,
          category: initialProduct.category,
          price: String(initialProduct.price),
          unit: initialProduct.unit,
          image: initialProduct.image,
          isFavorite: initialProduct.isFavorite,
          isActive: initialProduct.isActive,
          description: initialProduct.description || '',
        });
        setLoading(false);
        setLoadError(null);
      } else {
        loadProduct();
      }
    } else {
      setLoading(false);
      setLoadError(null);
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
    }
  }, [isEdit, productId, initialProduct, loadProduct]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (isEdit && productId) {
        const updated = await apiRequest<Product>(
          `/api/products/${encodeURIComponent(productId)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ ...form, name: form.name.trim(), price: priceNum }),
          }
        );
        showToast('Product Updated', 'success', updated.name);
      } else {
        const created = await apiRequest<Product>('/api/products', {
          method: 'POST',
          body: JSON.stringify({ ...form, name: form.name.trim(), price: priceNum }),
        });
        showToast('Product Added', 'success', created.name);
      }
      onSaved();
    } catch (err: any) {
      showToast('Save Failed', 'error', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const previewPrice = Number(form.price);
  const displayPreviewPrice =
    Number.isFinite(previewPrice) && previewPrice > 0
      ? formatMoneyExact(previewPrice, sym)
      : formatMoneyExact(0, sym);

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden w-full">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Back to Products"
            className="p-2 rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[var(--eb-text)] hover:bg-[var(--eb-accent)]/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--eb-accent)]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-[var(--eb-text)] leading-tight truncate">
              {isEdit ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-[13px] font-normal text-[var(--eb-text-muted)] truncate">
              {isEdit
                ? 'Update product pricing, unit, image, and POS visibility.'
                : 'Create a new bakery item with pricing, unit, and image.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 animate-pulse lg:overflow-y-auto thin-scrollbar">
          <div className="lg:col-span-7 eb-card p-5 space-y-3.5">
            <div className="h-6 w-40 rounded bg-[var(--eb-surface-subtle)]" />
            <div className="h-10 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-10 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
              <div className="h-10 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
              <div className="h-10 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
            </div>
            <div className="h-20 rounded-[10px] bg-[var(--eb-surface-subtle)]" />
          </div>
          <div className="lg:col-span-5 eb-card p-5 space-y-3.5">
            <div className="h-6 w-36 rounded bg-[var(--eb-surface-subtle)]" />
            <div className="h-44 rounded-[12px] bg-[var(--eb-surface-subtle)]" />
          </div>
        </div>
      ) : loadError ? (
        <div className="eb-card p-8 sm:p-10 text-center space-y-4 max-w-lg mx-auto my-auto">
          <AlertCircle className="w-10 h-10 mx-auto text-[#DC2626]" />
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--eb-text)]">
              Unable to load product
            </h2>
            <p className="text-[14px] text-[var(--eb-text-muted)] mt-1">{loadError}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={loadProduct}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[14px] font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Products</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch lg:overflow-y-auto thin-scrollbar"
        >
          {/* Left Column: All Product Fields, Visibility Toggles & Save Actions */}
          <section className="lg:col-span-7 eb-card p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-h-0">
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--eb-border)]">
                <Cake className="w-4.5 h-4.5 text-[var(--eb-accent)]" />
                <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                  Product Details
                </h2>
              </div>

              <div>
                <label
                  htmlFor="product-name"
                  className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1"
                >
                  Product Name *
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Belgian Chocolate Truffle"
                  autoFocus={!isEdit}
                  className="w-full h-[40px] px-3 py-2 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="product-category"
                    className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="product-category"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))
                    }
                    className="w-full h-[40px] pl-3 pr-9 py-2 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    {(categories.includes(form.category)
                      ? categories
                      : [form.category, ...categories]
                    )
                      .filter(Boolean)
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="product-unit"
                    className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1"
                  >
                    Unit
                  </label>
                  <select
                    id="product-unit"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value as MeasurementUnit }))
                    }
                    className="w-full h-[40px] pl-3 pr-9 py-2 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  >
                    {MEASUREMENT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="product-price"
                    className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1"
                  >
                    Price ({sym}) *
                  </label>
                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="950"
                    className="w-full h-[40px] px-3 py-2 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-bold text-[var(--eb-text)] tabular-nums focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="product-description"
                  className="block text-[12px] font-medium text-[var(--eb-text-muted)] mb-1"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="product-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of flavor, filling, or ingredients..."
                  className="w-full p-2.5 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-input-bg)] text-[13px] font-medium text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)] focus:ring-2 focus:ring-[var(--eb-accent)]/15"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <label className="flex items-start gap-2.5 p-2.5 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] cursor-pointer hover:border-[var(--eb-accent)]/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isFavorite}
                    onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))}
                    className="mt-0.5 accent-[var(--eb-accent)] w-4 h-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--eb-text)]">
                      <Star className="w-3.5 h-3.5 text-[var(--eb-accent)]" />
                      Mark as Favorite
                    </span>
                    <span className="block text-[11px] text-[var(--eb-text-muted)] leading-snug mt-0.5">
                      Show in Favorites on POS Billing
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-[10px] border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)] cursor-pointer hover:border-[var(--eb-accent)]/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="mt-0.5 accent-[var(--eb-accent)] w-4 h-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--eb-text)]">
                      <Power className="w-3.5 h-3.5 text-[var(--eb-accent)]" />
                      Active in POS Billing
                    </span>
                    <span className="block text-[11px] text-[var(--eb-text-muted)] leading-snug mt-0.5">
                      Available for counter billing
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[var(--eb-border)]">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="h-[38px] px-4 rounded-[10px] bg-[var(--eb-btn-secondary-bg)] hover:bg-[var(--eb-btn-secondary-hover)] text-[var(--eb-btn-secondary-text)] border border-[var(--eb-border)] text-[13px] font-medium transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 h-[38px] px-5 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[13px] font-medium transition-colors disabled:opacity-60 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}</span>
              </button>
            </div>
          </section>

          {/* Right Column: Compact Product Image, Upload, Presets & Live Summary */}
          <section className="lg:col-span-5 eb-card p-4 sm:p-5 flex flex-col justify-between gap-3 min-h-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--eb-border)]">
                <h2 className="text-[17px] font-semibold text-[var(--eb-text)]">
                  Product Image
                </h2>
                <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="h-40 sm:h-44 w-full rounded-[12px] overflow-hidden border border-[var(--eb-border)] bg-[var(--eb-surface-subtle)]">
                <ProductImage src={form.image} alt={form.name || 'Product Preview'} />
              </div>

              <div>
                <p className="text-[12px] font-medium text-[var(--eb-text-muted)] mb-1.5">
                  Bakery Presets
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image: preset.url }))}
                      className={`px-2 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors text-center truncate ${
                        form.image === preset.url
                          ? 'border-[var(--eb-accent)] bg-[var(--eb-accent)]/10 text-[var(--eb-accent)] font-semibold'
                          : 'border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[10px] bg-[var(--eb-surface-subtle)] border border-[var(--eb-border)] px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--eb-text-muted)]">
                  Catalog Preview
                </p>
                <p className="font-semibold text-[14px] text-[var(--eb-text)] truncate">
                  {form.name.trim() || 'Untitled Product'}
                </p>
                <p className="text-[12px] text-[var(--eb-text-muted)]">
                  {form.category} · per {form.unit}
                </p>
              </div>
              <span className="text-[16px] font-bold text-[var(--eb-accent)] tabular-nums shrink-0">
                {displayPreviewPrice}
              </span>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
