import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  Plus,
  Minus,
  Trash2,
  Printer,
  ShoppingCart,
  UserPlus,
  Cake,
  Store,
  Truck,
  X,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ProductImage } from '../components/ProductImage';
import { billToReceipt, formatCurrency, formatMoneyExact, getTodayYMD } from '../lib/format';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  type Bill,
  type CakeOrder,
  type CartItem,
  type CategoryItem,
  type Customer,
  type FulfillmentType,
  type PaymentMode,
  type Product,
  type ProductCategory,
  type ReceiptData,
} from '../types';

interface BillingPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

const DEFAULT_CATEGORY_TABS: {
  key: 'All' | 'Favorites' | ProductCategory;
  label: string;
}[] = [
  { key: 'All', label: 'All' },
  { key: 'Favorites', label: 'Favorites' },
  ...DEFAULT_PRODUCT_CATEGORIES.map((c) => ({ key: c, label: c })),
];

const KG_PRESETS = [0.5, 1, 1.5, 2];
const GRAM_PRESETS = [0.5, 1, 2, 5];

export function BillingPage({ onPrintReceipt }: BillingPageProps) {
  const { settings, loaded } = useSettings();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categoryTabs, setCategoryTabs] = useState(DEFAULT_CATEGORY_TABS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Favorites' | ProductCategory>('All');
  const [cardWeights, setCardWeights] = useState<Record<string, number>>({});

  const [billingMode, setBillingMode] = useState<'walkin' | 'order'>('walkin');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    settings.billing.defaultPaymentMode || 'Cash'
  );
  const [advanceAmount, setAdvanceAmount] = useState<string>('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Pickup');
  const [deliveryDate, setDeliveryDate] = useState(getTodayYMD());
  const [deliveryTime, setDeliveryTime] = useState('18:00');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sym = settings.application.currencySymbol || '₹';

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodRes, custRes, catRes] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<Customer[]>('/api/customers'),
        apiRequest<CategoryItem[]>('/api/categories').catch(() => [] as CategoryItem[]),
      ]);
      setProducts(prodRes.filter((p) => p.isActive));
      setCustomers(custRes);
      if (Array.isArray(catRes) && catRes.length > 0) {
        setCategoryTabs([
          { key: 'All', label: 'All' },
          { key: 'Favorites', label: 'Favorites' },
          ...catRes.map((c) => ({ key: c.name, label: c.name })),
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to load menu catalog.';
      setLoadError(msg);
      showToast('Failed to load catalog', 'error', msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loaded && cart.length === 0 && paymentMode !== 'Advance') {
      setPaymentMode(settings.billing.defaultPaymentMode || 'Cash');
    }
  }, [loaded, settings.billing.defaultPaymentMode, cart.length]);

  useEffect(() => {
    if (billingMode === 'walkin' && paymentMode === 'Advance') {
      setPaymentMode(settings.billing.defaultPaymentMode || 'Cash');
    }
  }, [billingMode, paymentMode, settings.billing.defaultPaymentMode]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'All'
          ? true
          : selectedCategory === 'Favorites'
          ? p.isFavorite
          : p.category === selectedCategory;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const matchingCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 6);
  }, [customers, customerSearch]);

  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  const toggleFavorite = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await apiRequest<Product>(`/api/products/${productId}/favorite`, {
        method: 'PATCH',
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    } catch (err: any) {
      showToast('Could not update favorite', 'error', err?.message);
    }
  };

  const getProductAddQty = (p: Product): number => {
    if (cardWeights[p.id] !== undefined) return cardWeights[p.id];
    return 1;
  };

  const addToCart = (product: Product, qtyOverride?: number) => {
    const addQty = qtyOverride ?? getProductAddQty(product);
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = round2(next[idx].quantity + addQty);
        next[idx] = {
          ...next[idx],
          quantity: newQty,
          subtotal: round2(newQty * next[idx].unitPrice),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          category: product.category,
          unit: product.unit,
          quantity: addQty,
          unitPrice: product.price,
          subtotal: round2(addQty * product.price),
        },
      ];
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0 || Number.isNaN(newQty)) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const cleanQty = round2(newQty);
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: cleanQty, subtotal: round2(cleanQty * i.unitPrice) }
          : i
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const subtotal = useMemo(
    () => round2(cart.reduce((sum, item) => sum + item.subtotal, 0)),
    [cart]
  );

  const safeDiscountPct = settings.billing.allowDiscount
    ? Math.max(0, Math.min(Number.isFinite(discountPercent) ? discountPercent : 0, settings.billing.maxDiscountPercent || 100))
    : 0;
  const discountAmount = round2((subtotal * safeDiscountPct) / 100);
  const taxable = Math.max(0, round2(subtotal - discountAmount));
  const taxRate = settings.billing.gstEnabled ? Number(settings.billing.gstRate || 0) : 0;
  const taxAmount = round2((taxable * taxRate) / 100);
  const grandTotal = round2(taxable + taxAmount);

  const parsedAdvance =
    billingMode === 'order' && paymentMode === 'Advance'
      ? Math.max(0, Number(advanceAmount || 0))
      : grandTotal;
  const balanceAmount =
    billingMode === 'order' && paymentMode === 'Advance'
      ? Math.max(0, round2(grandTotal - parsedAdvance))
      : 0;

  const selectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address || '');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setAdvanceAmount('');
    setOrderNotes('');
    setPaymentMode(settings.billing.defaultPaymentMode || 'Cash');
    showToast('Cart cleared', 'info');
  };

  const handleSaveAndPrint = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error', 'Add at least one product before billing.');
      return;
    }

    if (billingMode === 'order') {
      if (!customerName.trim()) {
        showToast('Customer Name Required', 'error', 'Please enter the customer name for an order.');
        return;
      }
      if (customerPhone.replace(/\D/g, '').length < 10) {
        showToast('Valid Phone Required', 'error', 'Enter a valid 10-digit customer phone number.');
        return;
      }
      if (!deliveryDate) {
        showToast('Schedule Date Required', 'error', `Select an expected ${fulfillmentType.toLowerCase()} date.`);
        return;
      }
      if (fulfillmentType === 'Delivery' && !customerAddress.trim()) {
        showToast('Delivery Address Required', 'error', 'Enter the delivery address when Delivery is selected.');
        return;
      }
      if (paymentMode === 'Advance') {
        if (!Number.isFinite(parsedAdvance) || parsedAdvance < 0) {
          showToast('Invalid Advance', 'error', 'Advance amount cannot be negative.');
          return;
        }
        if (parsedAdvance > grandTotal) {
          showToast('Invalid Advance', 'error', 'Advance amount cannot exceed the Grand Total.');
          return;
        }
      }
    } else if (customerPhone.trim() && customerPhone.replace(/\D/g, '').length < 10) {
      showToast('Invalid Phone Number', 'error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest<{ bill: Bill; order: CakeOrder | null }>('/api/bills', {
        method: 'POST',
        body: JSON.stringify({
          type: billingMode,
          items: cart,
          discountPercent: safeDiscountPct,
          paymentMode,
          advanceAmount:
            billingMode === 'order' && paymentMode === 'Advance' ? parsedAdvance : grandTotal,
          customerId: selectedCustomerId,
          customerName: customerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          fulfillmentType: billingMode === 'order' ? fulfillmentType : undefined,
          deliveryDate,
          deliveryTime,
          notes: orderNotes.trim(),
        }),
      });

      showToast(
        `${billingMode === 'order' ? 'Order & Bill' : 'Bill'} ${response.bill.billNumber} Saved`,
        'success',
        response.order
          ? `Order ${response.order.orderNumber} (${fulfillmentType}) scheduled.`
          : 'Transaction completed.'
      );

      apiRequest<Customer[]>('/api/customers')
        .then(setCustomers)
        .catch(() => {});

      setCart([]);
      setDiscountPercent(0);
      setAdvanceAmount('');
      setOrderNotes('');
      setPaymentMode(settings.billing.defaultPaymentMode || 'Cash');
      clearCustomer();

      onPrintReceipt(billToReceipt(response.bill, response.order), true);
    } catch (err: any) {
      showToast('Transaction Failed', 'error', err?.message || 'Could not save bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCartPanel = () => {
    document.getElementById('billing-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Left Side: Product Selection Catalog */}
      <div className="flex-1 min-w-0 w-full lg:h-full lg:min-h-0 flex flex-col gap-3">
        {/* Top Search Bar & Category Filter Strip */}
        <div className="sticky top-12 lg:static z-20 bg-[var(--eb-bg)] pb-1 lg:pb-0 space-y-2 shrink-0">
          {/* Search Input & Mobile Cart Jump */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cakes, pastries, cupcakes..."
                className="w-full h-[40px] pl-10 pr-9 rounded-[10px] bg-[var(--eb-surface)] border border-[var(--eb-border)] text-[13px] font-normal text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--eb-accent)]/15 focus:border-[var(--eb-accent)] transition-colors shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] p-1"
                  aria-label="Clear product search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="hidden sm:inline-block text-[12px] font-medium text-[var(--eb-text-muted)] tabular-nums whitespace-nowrap">
              {filteredProducts.length} items
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={scrollToCartPanel}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-xs font-medium tabular-nums shadow-sm whitespace-nowrap shrink-0"
                aria-label="Jump to shopping cart"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{cart.length}</span>
                <span className="hidden min-[380px]:inline">· {formatMoneyExact(grandTotal, sym)}</span>
              </button>
            )}
          </div>

          {/* Mini-Box Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto thin-scrollbar pb-0.5">
            {categoryTabs.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium whitespace-nowrap transition-colors border shrink-0 ${
                    active
                      ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                      : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:border-[var(--eb-accent)] hover:text-[var(--eb-text)]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Product Grid */}
        <div className="flex-1 min-h-0 lg:overflow-y-auto thin-scrollbar lg:pr-1">
          {loading ? (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="h-56 eb-card animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="eb-card p-10 text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-[#DC2626]" />
              <div>
                <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                  Unable to load product catalog
                </p>
                <p className="text-[12px] font-normal text-[var(--eb-text-muted)] mt-1">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="eb-card p-10 text-center">
              <Cake className="w-8 h-8 mx-auto text-[var(--eb-text-muted)]/50 mb-2" />
              <p className="text-[14px] font-semibold text-[var(--eb-text)]">
                No matching products found
              </p>
              <p className="text-[12px] font-normal text-[var(--eb-text-muted)] mt-1">
                Try another category or clear your search filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 pb-1">
              {filteredProducts.map((product) => {
                const selectedWt = getProductAddQty(product);
                const inCart = cart.find((c) => c.productId === product.id);
                const presets =
                  product.unit === 'KG'
                    ? KG_PRESETS
                    : product.unit === 'Gram'
                    ? GRAM_PRESETS
                    : null;

                return (
                  <div
                    key={product.id}
                    className="eb-card overflow-hidden flex flex-col justify-between hover:border-[var(--eb-accent)]/60 hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="relative aspect-[16/10] bg-[var(--eb-bg)] overflow-hidden">
                        <ProductImage src={product.image} alt={product.name} />
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(product.id, e)}
                          aria-label={product.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                            product.isFavorite
                              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-500 border border-amber-300 dark:border-amber-700 shadow-sm'
                              : 'bg-black/40 text-white hover:bg-amber-500'
                          }`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${product.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`}
                          />
                        </button>
                        {inCart && (
                          <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-[6px] bg-[var(--eb-accent)] text-white text-[10px] font-semibold tabular-nums shadow-sm">
                            {inCart.quantity} {product.unit} in cart
                          </span>
                        )}
                      </div>

                      <div className="p-2.5">
                        <p className="text-[11px] font-normal text-[var(--eb-text-muted)] truncate">
                          {product.category} · {product.unit}
                        </p>
                        <h3 className="mt-0.5 text-[13px] font-semibold text-[var(--eb-text)] line-clamp-2 leading-snug min-h-[2.2rem]">
                          {product.name}
                        </h3>

                        <div className="mt-1 flex items-baseline justify-between gap-1">
                          <span className="text-[14px] font-bold text-[var(--eb-text)] tabular-nums">
                            {formatMoneyExact(product.price, sym)}
                          </span>
                          <span className="text-[11px] font-normal text-[var(--eb-text-muted)]">/{product.unit}</span>
                        </div>

                        {presets && (
                          <div className="mt-1.5 grid grid-cols-4 gap-1">
                            {presets.map((wt) => (
                              <button
                                key={wt}
                                type="button"
                                onClick={() =>
                                  setCardWeights((prev) => ({ ...prev, [product.id]: wt }))
                                }
                                className={`py-0.5 rounded-[6px] text-[10px] font-semibold tabular-nums border transition-colors ${
                                  selectedWt === wt
                                    ? 'bg-[var(--eb-accent)] text-white border-[var(--eb-accent)]'
                                    : 'bg-[var(--eb-bg)] text-[var(--eb-text-muted)] border-[var(--eb-border)] hover:border-[var(--eb-accent)] hover:text-[var(--eb-text)]'
                                }`}
                              >
                                {wt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-2.5 pb-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="w-full py-1.5 px-2.5 rounded-[8px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[12px] font-medium inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          Add {presets ? `${selectedWt} ${product.unit}` : 'to Cart'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Full-Height Shopping Cart & Checkout Panel */}
      <aside
        id="billing-cart-panel"
        aria-label="Billing panel"
        className="w-full lg:w-[370px] xl:w-[400px] 2xl:w-[420px] shrink-0 lg:h-full lg:min-h-0 eb-card overflow-hidden flex flex-col"
      >
        {/* Walk-in vs Orders Toggle */}
        <div className="p-2.5 border-b border-[var(--eb-border)] flex items-center justify-between gap-2 bg-[var(--eb-bg)] shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-[9px] bg-[var(--eb-btn-secondary-bg)] border border-[var(--eb-border)] flex-1">
            <button
              type="button"
              onClick={() => setBillingMode('walkin')}
              className={`flex-1 py-1.5 px-2.5 rounded-[7px] text-xs font-medium transition-colors whitespace-nowrap ${
                billingMode === 'walkin'
                  ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                  : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
              }`}
            >
              Walk-in Bill
            </button>
            <button
              type="button"
              onClick={() => setBillingMode('order')}
              className={`flex-1 py-1.5 px-2.5 rounded-[7px] text-xs font-medium transition-colors whitespace-nowrap ${
                billingMode === 'order'
                  ? 'bg-[var(--eb-accent)] text-white shadow-sm'
                  : 'text-[var(--eb-text-muted)] hover:text-[var(--eb-text)]'
              }`}
            >
              Cake Orders
            </button>
          </div>
          {cart.length > 0 && (
            <span className="px-2.5 py-1 rounded-[8px] bg-[var(--eb-accent-light)] text-[var(--eb-accent)] border border-[var(--eb-accent-border)] text-xs font-bold tabular-nums shrink-0">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {/* Scrollable Cart Items, Payment Options & Customer Details */}
        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar divide-y divide-[var(--eb-border)]">
          {/* Cart Items */}
          <div className="p-3">
            {cart.length === 0 ? (
              <div className="py-5 text-center">
                <ShoppingCart className="w-7 h-7 mx-auto text-[var(--eb-text-muted)]/50 mb-1.5" />
                <p className="text-[13px] font-semibold text-[var(--eb-text)]">
                  Cart is empty
                </p>
                <p className="text-[12px] font-normal text-[var(--eb-text-muted)] mt-0.5">
                  Select products on the left to start billing.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cart.map((item) => {
                  const step = item.unit === 'KG' || item.unit === 'Gram' ? 0.5 : 1;
                  return (
                    <div
                      key={item.productId}
                      className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--eb-border)] last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--eb-text)] truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] font-normal text-[var(--eb-text-muted)] tabular-nums mt-0.5">
                          {formatMoneyExact(item.unitPrice, sym)} / {item.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity - step)}
                          aria-label="Decrease quantity"
                          className="w-6 h-6 rounded-[6px] bg-[var(--eb-btn-secondary-bg)] hover:bg-[var(--eb-border)] text-[var(--eb-btn-secondary-text)] border border-[var(--eb-border)] flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0.1"
                          step={item.unit === 'Piece' ? '1' : '0.25'}
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQty(item.productId, parseFloat(e.target.value))
                          }
                          aria-label={`Quantity for ${item.productName}`}
                          className="w-12 text-center py-0.5 rounded-[6px] border border-[var(--eb-border)] bg-[var(--eb-bg)] text-xs font-semibold tabular-nums focus:outline-none focus:border-[var(--eb-accent)]"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity + step)}
                          aria-label="Increase quantity"
                          className="w-6 h-6 rounded-[6px] bg-[var(--eb-btn-secondary-bg)] hover:bg-[var(--eb-border)] text-[var(--eb-btn-secondary-text)] border border-[var(--eb-border)] flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0 min-w-[70px]">
                        <p className="text-[13px] font-bold text-[var(--eb-text)] tabular-nums">
                          {formatMoneyExact(item.subtotal, sym)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 rounded-[6px] text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 mt-0.5 transition-colors"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Mode & Orders Options */}
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--eb-text)]">
                Payment Mode
              </span>
              <span className="text-[12px] font-normal text-[var(--eb-text-muted)] tabular-nums">
                Payable: {formatMoneyExact(grandTotal, sym)}
              </span>
            </div>

            <div className={`grid gap-1.5 ${billingMode === 'order' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              {(['Cash', 'UPI', 'Card', ...(billingMode === 'order' ? ['Advance'] : [])] as PaymentMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-1.5 px-2 rounded-[8px] text-xs font-medium border transition-colors whitespace-nowrap ${
                      paymentMode === mode
                        ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                        : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text)] hover:bg-[var(--eb-accent-light)]'
                    }`}
                  >
                    {mode}
                  </button>
                )
              )}
            </div>

            {billingMode === 'order' && paymentMode === 'Advance' && (
              <div className="rounded-[10px] bg-[var(--eb-bg)] border border-[var(--eb-border)] p-2.5 space-y-1.5 tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="advance-received"
                    className="text-xs font-medium text-[var(--eb-text)]"
                  >
                    Advance Received ({sym})
                  </label>
                  <div className="flex items-center gap-1">
                    {[0.25, 0.5].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAdvanceAmount(String(round2(grandTotal * ratio)))}
                        className="px-2 py-0.5 rounded-[6px] bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800/60 transition-colors"
                      >
                        {ratio * 100}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="advance-received"
                  type="number"
                  min={0}
                  max={grandTotal}
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-sm font-bold text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)]"
                />
                <div className="text-xs font-normal space-y-0.5 pt-0.5">
                  <div className="flex justify-between text-[#16A34A]">
                    <span>Advance Received</span>
                    <span>{formatMoneyExact(parsedAdvance, sym)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[var(--eb-text)]">
                    <span>Remaining Balance</span>
                    <span>{formatMoneyExact(balanceAmount, sym)}</span>
                  </div>
                </div>
              </div>
            )}

            {billingMode === 'order' && (
              <div className="space-y-2 pt-0.5">
                {/* Pickup vs Delivery Toggle + Order Status */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(['Pickup', 'Delivery'] as FulfillmentType[]).map((ft) => {
                    const Icon = ft === 'Pickup' ? Store : Truck;
                    const active = fulfillmentType === ft;
                    return (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => setFulfillmentType(ft)}
                        className={`py-1.5 px-2.5 rounded-[8px] text-xs font-medium border inline-flex items-center justify-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-[var(--eb-accent)] border-[var(--eb-accent)] text-white shadow-sm'
                            : 'bg-[var(--eb-surface)] border-[var(--eb-border)] text-[var(--eb-text-muted)] hover:border-[var(--eb-accent)] hover:text-[var(--eb-text)]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ft}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Schedule Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="order-delivery-date"
                      className="block text-[11px] font-medium text-[var(--eb-text-muted)] mb-1"
                    >
                      {fulfillmentType} Date *
                    </label>
                    <input
                      id="order-delivery-date"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[12px] font-normal tabular-nums focus:outline-none focus:border-[var(--eb-accent)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="order-delivery-time"
                      className="block text-[11px] font-medium text-[var(--eb-text-muted)] mb-1"
                    >
                      {fulfillmentType} Time
                    </label>
                    <input
                      id="order-delivery-time"
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[12px] font-normal tabular-nums focus:outline-none focus:border-[var(--eb-accent)]"
                    />
                  </div>
                </div>

                {/* Cake Customization Notes */}
                <div>
                  <textarea
                    id="order-custom-notes"
                    rows={2}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Message on cake, eggless preference, icing flavor..."
                    className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[12px] font-normal focus:outline-none focus:border-[var(--eb-accent)] resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[var(--eb-text)]">
                Customer Details {billingMode === 'order' ? '(Required)' : '(Optional)'}
              </span>
              {(customerName || customerPhone || customerAddress) && (
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative">
              <UserPlus className="w-3.5 h-3.5 text-[var(--eb-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={customerSearch}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 180)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                placeholder="Search customer by name or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-xs font-normal focus:outline-none focus:border-[var(--eb-accent)]"
              />
              {showCustomerDropdown && matchingCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 z-30 rounded-[12px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-lg max-h-44 overflow-y-auto divide-y divide-[var(--eb-border)]">
                  {matchingCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-[var(--eb-accent-light)] text-xs flex justify-between items-center gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[var(--eb-text)] truncate block">
                          {c.name}
                        </span>
                        <span className="text-[10px] text-[var(--eb-text-muted)] tabular-nums">
                          {c.totalOrders} {c.totalOrders === 1 ? 'order' : 'orders'} · {formatCurrency(c.totalSpent, sym)}
                        </span>
                      </div>
                      <span className="text-[var(--eb-text-muted)] tabular-nums shrink-0">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={billingMode === 'order' ? 'Customer Name *' : 'Customer Name'}
                className="px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-xs font-normal focus:outline-none focus:border-[var(--eb-accent)]"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={billingMode === 'order' ? 'Phone Number *' : 'Phone Number'}
                className="px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-xs font-normal tabular-nums focus:outline-none focus:border-[var(--eb-accent)]"
              />
            </div>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder={
                billingMode === 'order' && fulfillmentType === 'Delivery'
                  ? 'Delivery Address *'
                  : 'Customer Address (Optional)'
              }
              className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-xs font-normal focus:outline-none focus:border-[var(--eb-accent)]"
            />
          </div>
        </div>

        {/* Pinned Totals + Clear & SAVE & PRINT Checkout Footer */}
        <div className="border-t border-[var(--eb-border)] bg-[var(--eb-surface)] shrink-0">
          <div className="px-3.5 py-2.5 space-y-1.5 text-xs bg-[var(--eb-bg)]/80 border-b border-[var(--eb-border)] tabular-nums">
            <div className="flex justify-between font-normal text-[var(--eb-text-muted)]">
              <span>Subtotal</span>
              <span className="font-semibold text-[var(--eb-text)]">
                {formatMoneyExact(subtotal, sym)}
              </span>
            </div>

            {settings.billing.allowDiscount && (
              <div className="flex items-center justify-between gap-2 font-normal text-[var(--eb-text-muted)]">
                <label htmlFor="billing-discount" className="whitespace-nowrap text-[12px] font-medium text-[var(--eb-text)]">
                  Discount (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="billing-discount"
                    type="number"
                    min={0}
                    max={settings.billing.maxDiscountPercent || 100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                    className="w-14 text-right px-2 py-0.5 rounded-[7px] border border-[var(--eb-border)] bg-[var(--eb-surface)] text-[12px] font-semibold text-[var(--eb-text)] focus:outline-none focus:border-[var(--eb-accent)]"
                  />
                  <span className="font-semibold text-[#16A34A] min-w-[60px] text-right">
                    -{formatMoneyExact(discountAmount, sym)}
                  </span>
                </div>
              </div>
            )}

            {settings.billing.gstEnabled && (
              <div className="flex justify-between text-[12px] font-normal text-[var(--eb-text-muted)]">
                <span>GST ({taxRate}%)</span>
                <span>{formatMoneyExact(taxAmount, sym)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-[var(--eb-border)] text-[var(--eb-text)]">
              <span className="text-[14px] font-semibold">Grand Total</span>
              <span className="text-[22px] font-bold text-[var(--eb-accent)] leading-none">
                {formatMoneyExact(grandTotal, sym)}
              </span>
            </div>
          </div>

          <div className="p-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleClearCart}
              className="px-3 py-2 rounded-[9px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-45 disabled:cursor-not-allowed text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleSaveAndPrint}
              className="flex-1 min-w-0 py-2 px-3 rounded-[9px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-[var(--eb-border)] disabled:text-[var(--eb-text-muted)] text-white text-[13px] font-semibold tracking-wide inline-flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>{submitting ? 'SAVING...' : 'SAVE & PRINT'}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
