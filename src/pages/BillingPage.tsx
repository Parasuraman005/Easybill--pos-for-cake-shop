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
  Cookie,
  Coffee,
  Sparkles,
  UtensilsCrossed,
  Gift,
  Croissant,
  Candy,
  LayoutGrid,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ProductImage } from '../components/ProductImage';
import { billToReceipt, formatMoneyExact, getTodayYMD } from '../lib/format';
import type {
  Bill,
  CakeOrder,
  CartItem,
  Customer,
  PaymentMode,
  Product,
  ProductCategory,
  ReceiptData,
} from '../types';

interface BillingPageProps {
  onPrintReceipt: (receipt: ReceiptData, autoPrint?: boolean) => void;
}

const CATEGORIES: {
  key: 'All' | 'Favorites' | ProductCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'All', label: 'All', icon: LayoutGrid },
  { key: 'Favorites', label: 'Favorites', icon: Star },
  { key: 'Cakes', label: 'Cakes', icon: Cake },
  { key: 'Pastries', label: 'Pastries', icon: Croissant },
  { key: 'Cupcakes', label: 'Cupcakes', icon: Sparkles },
  { key: 'Chocolates', label: 'Chocolates', icon: Candy },
  { key: 'Cookies', label: 'Cookies', icon: Cookie },
  { key: 'Desserts', label: 'Desserts', icon: UtensilsCrossed },
  { key: 'Snacks', label: 'Snacks', icon: ShoppingCart },
  { key: 'Beverages', label: 'Beverages', icon: Coffee },
  { key: 'Others', label: 'Others', icon: Gift },
];

const KG_PRESETS = [0.5, 1, 1.5, 2];

export function BillingPage({ onPrintReceipt }: BillingPageProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [deliveryDate, setDeliveryDate] = useState(getTodayYMD());
  const [deliveryTime, setDeliveryTime] = useState('18:00');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sym = settings.application.currencySymbol || '₹';

  const loadData = useCallback(async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<Customer[]>('/api/customers'),
      ]);
      setProducts(prodRes.filter((p) => p.isActive));
      setCustomers(custRes);
    } catch (err: any) {
      showToast('Failed to load catalog', 'error', err?.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    ? Math.max(0, Math.min(discountPercent || 0, settings.billing.maxDiscountPercent || 100))
    : 0;
  const discountAmount = round2((subtotal * safeDiscountPct) / 100);
  const taxable = Math.max(0, round2(subtotal - discountAmount));
  const taxRate = settings.billing.gstEnabled ? Number(settings.billing.gstRate || 0) : 0;
  const taxAmount = round2((taxable * taxRate) / 100);
  const grandTotal = round2(taxable + taxAmount);

  const parsedAdvance =
    billingMode === 'order' && paymentMode === 'Advance'
      ? Number(advanceAmount || 0)
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
        showToast('Delivery Date Required', 'error', 'Select an expected delivery date.');
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
          deliveryDate,
          deliveryTime,
          notes: orderNotes.trim(),
        }),
      });

      showToast(
        `${billingMode === 'order' ? 'Order & Bill' : 'Bill'} ${response.bill.billNumber} Saved`,
        'success',
        response.order ? `Order ${response.order.orderNumber} scheduled.` : 'Transaction completed.'
      );

      apiRequest<Customer[]>('/api/customers')
        .then(setCustomers)
        .catch(() => {});

      setCart([]);
      setDiscountPercent(0);
      setAdvanceAmount('');
      setOrderNotes('');
      clearCustomer();

      onPrintReceipt(billToReceipt(response.bill, response.order), true);
    } catch (err: any) {
      showToast('Transaction Failed', 'error', err?.message || 'Could not save bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* Left Side: Product Catalog */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        {/* Sticky Product Search Bar & Category Filter Bar */}
        <div className="sticky top-[96px] z-35 bg-[#F7F7FB] dark:bg-[#13101C] pt-1 pb-3 space-y-3">
          {/* A. Product Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#817A91] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cakes, pastries, cupcakes or categories..."
              className="w-full pl-10 pr-10 py-2.5 rounded-[12px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] text-sm font-medium text-[#302A40] dark:text-[#F3F1FA] placeholder:text-[#817A91]/80 focus:outline-none focus:ring-2 focus:ring-[#7656C9]/20 focus:border-[#7656C9] transition-colors shadow-[0_2px_8px_rgba(48,42,64,0.04)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#817A91] hover:text-[#302A40] p-1"
                aria-label="Clear product search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

        {/* B. Circular Category Buttons */}
        <div className="flex items-center gap-3 overflow-x-auto thin-scrollbar pb-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                    active
                      ? 'bg-[#7656C9] border-[#7656C9] text-white shadow-[0_4px_12px_rgba(118,86,201,0.3)] scale-[1.03]'
                      : 'bg-white dark:bg-[#1B1726] border-[#EAE7F0] dark:border-[#2E2842] text-[#817A91] dark:text-[#A69FB8] group-hover:border-[#7656C9] group-hover:text-[#7656C9] group-hover:bg-[#E9E2FF]/40'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    active
                      ? 'text-[#7656C9] dark:text-[#C5B3F7] font-semibold'
                      : 'text-[#817A91] font-medium'
                  }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

        {/* C. Product Grid — 5 Product Cards Per Row on Desktop */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="h-60 eb-card animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="eb-card p-10 text-center">
            <Cake className="w-8 h-8 mx-auto text-[#817A91]/50 mb-2" />
            <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
              No matching products found
            </p>
            <p className="text-xs font-medium text-[#817A91] mt-1">
              Try another category or clear your search filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const selectedWt = getProductAddQty(product);
              const inCart = cart.find((c) => c.productId === product.id);
              return (
                <div
                  key={product.id}
                  className="eb-card overflow-hidden flex flex-col justify-between hover:border-[#7656C9]/60 hover:shadow-[0_6px_18px_rgba(118,86,201,0.09)] transition-all"
                >
                  <div>
                    <div className="relative aspect-[4/3] bg-[#F7F7FB] dark:bg-[#13101C] overflow-hidden">
                      <ProductImage src={product.image} alt={product.name} />
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(product.id, e)}
                        aria-label={product.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                          product.isFavorite
                            ? 'bg-[#E9E2FF] text-[#7656C9] shadow-sm'
                            : 'bg-[#302A40]/45 text-white hover:bg-[#7656C9]'
                        }`}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${product.isFavorite ? 'fill-[#7656C9]' : ''}`}
                        />
                      </button>
                      {inCart && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-[8px] bg-[#7656C9] text-white text-[11px] font-semibold tabular-nums shadow-sm">
                          {inCart.quantity} {product.unit} in cart
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="text-[11px] font-medium text-[#817A91] truncate">
                        {product.category} · {product.unit}
                      </p>
                      <h3 className="mt-0.5 font-display text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA] line-clamp-2 leading-snug min-h-[2.4rem]">
                        {product.name}
                      </h3>

                      <div className="mt-2 flex items-baseline justify-between gap-1">
                        <span className="font-display text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                          {formatMoneyExact(product.price, sym)}
                        </span>
                        <span className="text-[11px] font-medium text-[#817A91]">/{product.unit}</span>
                      </div>

                      {product.unit === 'KG' && (
                        <div className="mt-2 grid grid-cols-4 gap-1">
                          {KG_PRESETS.map((wt) => (
                            <button
                              key={wt}
                              type="button"
                              onClick={() =>
                                setCardWeights((prev) => ({ ...prev, [product.id]: wt }))
                              }
                              className={`py-1 rounded-[8px] text-[10px] font-semibold tabular-nums border transition-colors ${
                                selectedWt === wt
                                  ? 'bg-[#7656C9] text-white border-[#7656C9]'
                                  : 'bg-[#F7F7FB] dark:bg-[#13101C] text-[#817A91] border-[#EAE7F0] dark:border-[#2E2842] hover:border-[#7656C9] hover:text-[#302A40]'
                              }`}
                            >
                              {wt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="w-full py-2 px-3 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        Add {product.unit === 'KG' ? `${selectedWt} KG` : 'to Cart'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D. Right-Side Sticky Shopping Cart / Billing Panel */}
      <aside
        aria-label="Billing panel"
        className="w-full lg:w-[410px] xl:w-[435px] shrink-0 lg:sticky lg:top-[100px] eb-card overflow-hidden flex flex-col max-h-[calc(100vh-9.5rem)]"
      >
        {/* Cart Header: Walk-in vs Orders Toggle */}
        <div className="p-3.5 border-b border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-between gap-3 bg-[#F7F7FB] dark:bg-[#151220]">
          <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[#E9E2FF]/70 dark:bg-[#2A233D] w-full">
            <button
              type="button"
              onClick={() => setBillingMode('walkin')}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                billingMode === 'walkin'
                  ? 'bg-[#7656C9] text-white shadow-sm'
                  : 'text-[#4B3194] dark:text-[#D9CEFF] hover:text-[#302A40]'
              }`}
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setBillingMode('order')}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                billingMode === 'order'
                  ? 'bg-[#7656C9] text-white shadow-sm'
                  : 'text-[#4B3194] dark:text-[#D9CEFF] hover:text-[#302A40]'
              }`}
            >
              Orders
            </button>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs font-semibold text-[#817A91] hover:text-red-600 whitespace-nowrap shrink-0 px-1.5"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Cart + Payment + Customer Body */}
        <div className="flex-1 overflow-y-auto thin-scrollbar divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
          {/* Cart Items */}
          <div className="p-4">
            {cart.length === 0 ? (
              <div className="py-8 text-center">
                <ShoppingCart className="w-8 h-8 mx-auto text-[#817A91]/50 mb-2" />
                <p className="text-sm font-semibold text-[#302A40] dark:text-[#F3F1FA]">
                  Cart is empty
                </p>
                <p className="text-xs font-medium text-[#817A91] mt-0.5">
                  Select products on the left to start billing.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const step = item.unit === 'KG' ? 0.5 : 1;
                  return (
                    <div
                      key={item.productId}
                      className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#EAE7F0] dark:border-[#2E2842] last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] font-medium text-[#817A91] tabular-nums mt-0.5">
                          {formatMoneyExact(item.unitPrice, sym)} / {item.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity - step)}
                          aria-label="Decrease quantity"
                          className="w-6 h-6 rounded-[8px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0.1"
                          step={item.unit === 'KG' ? '0.25' : '1'}
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQty(item.productId, parseFloat(e.target.value))
                          }
                          aria-label={`Quantity for ${item.productName}`}
                          className="w-14 text-center py-0.5 rounded-[8px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-semibold tabular-nums focus:outline-none focus:border-[#7656C9]"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity + step)}
                          aria-label="Increase quantity"
                          className="w-6 h-6 rounded-[8px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0 min-w-[74px]">
                        <p className="font-display text-xs font-bold text-[#302A40] dark:text-[#F3F1FA] tabular-nums">
                          {formatMoneyExact(item.subtotal, sym)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-[#817A91] hover:text-red-600 mt-0.5"
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

          {/* Billing Summary */}
          <div className="p-4 space-y-2 text-xs bg-[#F7F7FB]/80 dark:bg-[#151220] tabular-nums">
            <div className="flex justify-between font-medium text-[#817A91]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                {formatMoneyExact(subtotal, sym)}
              </span>
            </div>

            {settings.billing.allowDiscount && (
              <div className="flex items-center justify-between gap-2 font-medium text-[#817A91]">
                <label htmlFor="billing-discount" className="whitespace-nowrap font-semibold">
                  Discount (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="billing-discount"
                    type="number"
                    min={0}
                    max={settings.billing.maxDiscountPercent || 100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-16 text-right px-2 py-1 rounded-[8px] border border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726] text-xs font-semibold text-[#302A40] dark:text-[#F3F1FA] focus:outline-none focus:border-[#7656C9]"
                  />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 min-w-[64px] text-right">
                    -{formatMoneyExact(discountAmount, sym)}
                  </span>
                </div>
              </div>
            )}

            {settings.billing.gstEnabled && (
              <div className="flex justify-between font-medium text-[#817A91]">
                <span>GST ({taxRate}%)</span>
                <span>{formatMoneyExact(taxAmount, sym)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-[#EAE7F0] dark:border-[#2E2842] text-[#302A40] dark:text-[#F3F1FA]">
              <span className="font-display text-sm font-bold">Grand Total</span>
              <span className="font-display text-xl font-bold text-[#7656C9] dark:text-[#C5B3F7]">
                {formatMoneyExact(grandTotal, sym)}
              </span>
            </div>
          </div>

          {/* Payment Mode */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                Payment Mode
              </span>
              <span className="text-xs font-semibold text-[#817A91] tabular-nums">
                Payable: {formatMoneyExact(grandTotal, sym)}
              </span>
            </div>

            <div className={`grid gap-1.5 ${billingMode === 'order' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {(['Cash', 'UPI', 'Card', ...(billingMode === 'order' ? ['Advance'] : [])] as PaymentMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 px-2 rounded-[10px] text-xs font-semibold border transition-colors whitespace-nowrap ${
                      paymentMode === mode
                        ? 'bg-[#7656C9] border-[#7656C9] text-white'
                        : 'bg-[#E9E2FF]/55 dark:bg-[#2A233D] border-[#EAE7F0] dark:border-[#2E2842] text-[#4B3194] dark:text-[#D9CEFF] hover:bg-[#E9E2FF]'
                    }`}
                  >
                    {mode}
                  </button>
                )
              )}
            </div>

            {billingMode === 'order' && paymentMode === 'Advance' && (
              <div className="rounded-[12px] bg-[#F7F7FB] dark:bg-[#13101C] border border-[#EAE7F0] dark:border-[#2E2842] p-3 space-y-2 tabular-nums">
                <div>
                  <label
                    htmlFor="advance-received"
                    className="block text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF] mb-1"
                  >
                    Advance Amount Received ({sym})
                  </label>
                  <input
                    id="advance-received"
                    type="number"
                    min={0}
                    max={grandTotal}
                    step="0.01"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726] text-sm font-bold text-[#302A40] dark:text-[#F3F1FA] focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div className="text-xs font-medium space-y-1 pt-1">
                  <div className="flex justify-between text-[#817A91]">
                    <span>Total Order Amount</span>
                    <span>{formatMoneyExact(grandTotal, sym)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Advance Received</span>
                    <span>{formatMoneyExact(parsedAdvance, sym)}</span>
                  </div>
                  <div className="flex justify-between font-display font-bold text-[#302A40] dark:text-[#F3F1FA]">
                    <span>Remaining Balance</span>
                    <span>{formatMoneyExact(balanceAmount, sym)}</span>
                  </div>
                </div>
              </div>
            )}

            {billingMode === 'order' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label
                    htmlFor="order-delivery-date"
                    className="block text-[11px] font-semibold text-[#302A40] dark:text-[#E9E2FF] mb-1"
                  >
                    Delivery Date *
                  </label>
                  <input
                    id="order-delivery-date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="order-delivery-time"
                    className="block text-[11px] font-semibold text-[#302A40] dark:text-[#E9E2FF] mb-1"
                  >
                    Delivery Time
                  </label>
                  <input
                    id="order-delivery-time"
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Cake message / customization notes..."
                    className="w-full px-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* G. Customer Information */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#302A40] dark:text-[#E9E2FF]">
                Customer Details {billingMode === 'order' ? '(Required)' : '(Optional)'}
              </span>
              {(customerName || customerPhone) && (
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="text-[11px] font-semibold text-[#7656C9] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative">
              <UserPlus className="w-3.5 h-3.5 text-[#817A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={customerSearch}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 180)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                placeholder="Search existing customer by name or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
              />
              {showCustomerDropdown && matchingCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 z-30 rounded-[12px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_10px_28px_rgba(48,42,64,0.12)] max-h-40 overflow-y-auto divide-y divide-[#EAE7F0] dark:divide-[#2E2842]">
                  {matchingCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F7F7FB] dark:hover:bg-[#231E33] text-xs flex justify-between items-center gap-2"
                    >
                      <span className="font-semibold text-[#302A40] dark:text-[#F3F1FA] truncate">
                        {c.name}
                      </span>
                      <span className="text-[#817A91] tabular-nums shrink-0">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={billingMode === 'order' ? 'Customer Name *' : 'Customer Name'}
                className="px-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={billingMode === 'order' ? 'Phone Number *' : 'Phone Number'}
                className="px-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726] text-xs font-medium tabular-nums focus:outline-none focus:border-[#7656C9]"
              />
            </div>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Customer Address (Optional)"
              className="w-full px-3 py-1.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726] text-xs font-medium focus:outline-none focus:border-[#7656C9]"
            />
          </div>
        </div>

        {/* H. Prominent SAVE & PRINT Action */}
        <div className="p-3.5 border-t border-[#EAE7F0] dark:border-[#2E2842] bg-white dark:bg-[#1B1726]">
          <button
            type="button"
            disabled={submitting || cart.length === 0}
            onClick={handleSaveAndPrint}
            className="w-full py-3 px-4 rounded-[12px] bg-[#7656C9] hover:bg-[#6947BB] disabled:bg-[#EAE7F0] dark:disabled:bg-[#2A233D] disabled:text-[#817A91] text-white font-display text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(118,86,201,0.28)] transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>{submitting ? 'SAVING TRANSACTION...' : 'SAVE & PRINT'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
