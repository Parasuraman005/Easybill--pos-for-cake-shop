import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  db,
  initDatabase,
  verifyPassword,
  hashPassword,
  createAuthToken,
  verifyAuthToken,
} from './db.ts';
import type {
  AuthUser,
  Bill,
  CakeOrder,
  CartItem,
  CategoryItem,
  Customer,
  Expense,
  OrderPaymentEntry,
  OrderStatus,
  Product,
  UserPermissions,
} from '../src/types.ts';

interface AuthenticatedRequest extends Request {
  currentUser?: AuthUser;
}

function mapUserRow(row: any): AuthUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    permissions: JSON.parse(row.permissions),
    active: Boolean(row.active),
    createdAt: row.createdAt,
  };
}

function mapCategoryRow(row: any): CategoryItem {
  return {
    id: row.id,
    name: row.name,
    isCustom: Boolean(row.isCustom),
    sortOrder: Number(row.sortOrder || 0),
    createdAt: row.createdAt,
  };
}

function mapProductRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    unit: row.unit,
    image: row.image || '',
    isFavorite: Boolean(row.isFavorite),
    isActive: Boolean(row.isActive),
    description: row.description || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapBillRow(row: any): Bill {
  return {
    id: row.id,
    billNumber: row.billNumber,
    type: row.type,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone || '',
    customerAddress: row.customerAddress || '',
    items: JSON.parse(row.items || '[]'),
    subtotal: Number(row.subtotal),
    discountPercent: Number(row.discountPercent),
    discountAmount: Number(row.discountAmount),
    taxRate: Number(row.taxRate),
    taxAmount: Number(row.taxAmount),
    grandTotal: Number(row.grandTotal),
    paymentMode: row.paymentMode,
    amountPaid: Number(row.amountPaid),
    balanceAmount: Number(row.balanceAmount),
    paymentStatus: row.paymentStatus,
    userId: row.userId,
    username: row.username,
    createdAt: row.createdAt,
  };
}

function mapOrderRow(row: any): CakeOrder {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    billId: row.billId,
    billNumber: row.billNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerAddress: row.customerAddress || '',
    items: JSON.parse(row.items || '[]'),
    subtotal: Number(row.subtotal),
    discountPercent: Number(row.discountPercent),
    discountAmount: Number(row.discountAmount),
    taxRate: Number(row.taxRate),
    taxAmount: Number(row.taxAmount),
    grandTotal: Number(row.grandTotal),
    advanceAmount: Number(row.advanceAmount),
    balanceAmount: Number(row.balanceAmount),
    paymentMode: row.paymentMode,
    paymentHistory: JSON.parse(row.paymentHistory || '[]'),
    status: row.status,
    fulfillmentType: row.fulfillmentType === 'Delivery' ? 'Delivery' : 'Pickup',
    orderDate: row.orderDate,
    deliveryDate: row.deliveryDate,
    deliveryTime: row.deliveryTime,
    notes: row.notes || '',
    userId: row.userId,
    username: row.username,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapExpenseRow(row: any): Expense {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expenseDate: row.expenseDate,
    paymentMode: row.paymentMode,
    userId: row.userId,
    username: row.username,
    createdAt: row.createdAt,
  };
}

function getAllSettingsObject(): Record<string, any> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, any> = {};
  for (const r of rows) {
    out[r.key] = JSON.parse(r.value);
  }
  return out;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const verified = verifyAuthToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(verified.userId) as any;
  if (!userRow || !userRow.active) {
    res.status(401).json({ error: 'User account is inactive or no longer exists.' });
    return;
  }
  req.currentUser = mapUserRow(userRow);
  next();
}

function generateNextCode(prefix: string, table: 'bills' | 'orders', column: 'billNumber' | 'orderNumber'): string {
  const rows = db.prepare(`SELECT ${column} as code FROM ${table}`).all() as { code: string }[];
  let maxNum = table === 'bills' ? 1000 : 500;
  for (const r of rows) {
    const match = String(r.code || '').match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    initDatabase();
    initialized = true;
  }
}

export function createApiApp(): express.Express {
  ensureInitialized();

  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Normalize Netlify Functions base path if routed directly via /.netlify/functions/api/*
  app.use((req, _res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const rest = req.url.slice('/.netlify/functions/api'.length);
      req.url = `/api${rest.startsWith('/') || rest === '' ? rest : `/${rest}`}`;
    }
    next();
  });

  // Health Check Route
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'easybill-api' });
  });

  // Public Auth Routes
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Please enter both username and password.' });
      return;
    }

    const userRow = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) as any;
    if (!userRow) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    if (!userRow.active) {
      res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
      return;
    }

    if (!verifyPassword(password, userRow.passwordHash)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const user = mapUserRow(userRow);
    const token = createAuthToken(user.id, user.username);
    res.json({ token, user });
  });

  // Public Settings Subset (for Header/Branding/Theme on Login if needed)
  app.get('/api/settings/public', (_req: Request, res: Response) => {
    const settings = getAllSettingsObject();
    res.json({
      company: settings.company,
      application: settings.application,
    });
  });

  // Authenticated Routes
  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.currentUser });
  });

  // Dashboard Summary
  app.get('/api/dashboard', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const allBills = db.prepare('SELECT * FROM bills ORDER BY createdAt DESC').all().map(mapBillRow);
    const allOrders = db.prepare('SELECT * FROM orders ORDER BY deliveryDate ASC, deliveryTime ASC').all().map(mapOrderRow);
    const allExpenses = db.prepare('SELECT * FROM expenses').all().map(mapExpenseRow);

    const ordersById = new Map<string, CakeOrder>();
    for (const o of allOrders) {
      ordersById.set(o.id, o);
    }

    let todaySales = 0;
    let todayBillCount = 0;
    let todayCollections = 0;
    let monthlySales = 0;
    let monthlyBillCount = 0;
    let monthlyCollections = 0;

    const activeBills: Bill[] = [];

    for (const b of allBills) {
      const linkedOrder = b.orderId ? ordersById.get(b.orderId) : undefined;
      if (linkedOrder && linkedOrder.status === 'Cancelled') {
        continue;
      }
      activeBills.push(b);

      const collected = linkedOrder ? linkedOrder.advanceAmount : b.amountPaid;
      const localDate = new Date(b.createdAt);
      const bDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      const bMonth = bDate.slice(0, 7);

      if (bDate === todayStr) {
        todaySales += b.grandTotal;
        todayCollections += collected;
        todayBillCount += 1;
      }
      if (bMonth === monthPrefix) {
        monthlySales += b.grandTotal;
        monthlyCollections += collected;
        monthlyBillCount += 1;
      }
    }

    let monthlyExpenses = 0;
    for (const e of allExpenses) {
      if (e.expenseDate.startsWith(monthPrefix)) {
        monthlyExpenses += e.amount;
      }
    }

    const pendingOrders = allOrders.filter(
      (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
    );
    const pendingBalanceDue = allOrders
      .filter((o) => o.status !== 'Cancelled' && o.balanceAmount > 0)
      .reduce((sum, o) => sum + o.balanceAmount, 0);

    const recentBills = activeBills.slice(0, 6);

    res.json({
      todaySales: roundMoney(todaySales),
      todayBillCount,
      todayCollections: roundMoney(todayCollections),
      monthlySales: roundMoney(monthlySales),
      monthlyBillCount,
      monthlyCollections: roundMoney(monthlyCollections),
      monthlyExpenses: roundMoney(monthlyExpenses),
      pendingBalanceDue: roundMoney(pendingBalanceDue),
      pendingOrders,
      recentBills,
    });
  });

  // Categories
  app.get('/api/categories', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY isCustom ASC, sortOrder ASC, name ASC').all();
    res.json(rows.map(mapCategoryRow));
  });

  app.post('/api/categories', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const cleanName = String(req.body?.name || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    if (cleanName.length > 40) {
      res.status(400).json({ error: 'Category name must be 40 characters or fewer.' });
      return;
    }

    const duplicate = db
      .prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)')
      .get(cleanName);
    if (duplicate) {
      res.status(409).json({ error: `Category "${cleanName}" already exists.` });
      return;
    }

    const maxSortRow = db.prepare('SELECT MAX(sortOrder) as maxSort FROM categories').get() as {
      maxSort: number | null;
    };
    const nextSort = Math.max(100, Number(maxSortRow?.maxSort || 99) + 1);
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO categories (id, name, isCustom, sortOrder, createdAt)
      VALUES (?, ?, 1, ?, ?)
    `).run(id, cleanName, nextSort, nowIso);

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.status(201).json(mapCategoryRow(created));
  });

  app.put('/api/categories/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    if (!existing.isCustom) {
      res.status(400).json({ error: 'Built-in categories cannot be renamed.' });
      return;
    }

    const cleanName = String(req.body?.name || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    if (cleanName.length > 40) {
      res.status(400).json({ error: 'Category name must be 40 characters or fewer.' });
      return;
    }

    const duplicate = db
      .prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?')
      .get(cleanName, id);
    if (duplicate) {
      res.status(409).json({ error: `Category "${cleanName}" already exists.` });
      return;
    }

    const nowIso = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(cleanName, id);
      db.prepare('UPDATE products SET category = ?, updatedAt = ? WHERE category = ?').run(
        cleanName,
        nowIso,
        existing.name
      );
    });
    tx();

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(mapCategoryRow(updated));
  });

  app.delete('/api/categories/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    if (!existing.isCustom) {
      res.status(400).json({ error: 'Built-in categories cannot be deleted.' });
      return;
    }

    const nowIso = new Date().toISOString();
    let reassignedCount = 0;
    const tx = db.transaction(() => {
      const resUpdate = db
        .prepare('UPDATE products SET category = ?, updatedAt = ? WHERE category = ?')
        .run('Others', nowIso, existing.name);
      reassignedCount = resUpdate.changes;
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    });
    tx();

    res.json({ success: true, reassignedCategory: 'Others', reassignedCount });
  });

  // Products
  app.get('/api/products', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY isFavorite DESC, name ASC').all();
    res.json(rows.map(mapProductRow));
  });

  app.get('/api/products/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json(mapProductRow(row));
  });

  app.post('/api/products', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { name, category, price, unit, image, isFavorite, isActive, description } = req.body || {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      res.status(400).json({ error: 'Valid product price is required.' });
      return;
    }

    const id = `prd-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO products (id, name, category, price, unit, image, isFavorite, isActive, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(name).trim(),
      String(category || 'Cakes'),
      roundMoney(numPrice),
      String(unit || 'Piece'),
      String(image || ''),
      isFavorite ? 1 : 0,
      isActive === false ? 0 : 1,
      String(description || '').trim(),
      now,
      now
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.status(201).json(mapProductRow(created));
  });

  app.put('/api/products/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const { name, category, price, unit, image, isFavorite, isActive, description } = req.body || {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      res.status(400).json({ error: 'Valid product price is required.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE products
      SET name = ?, category = ?, price = ?, unit = ?, image = ?, isFavorite = ?, isActive = ?, description = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      String(name).trim(),
      String(category || 'Cakes'),
      roundMoney(numPrice),
      String(unit || 'Piece'),
      String(image || ''),
      isFavorite ? 1 : 0,
      isActive === false ? 0 : 1,
      String(description || '').trim(),
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(mapProductRow(updated));
  });

  app.patch('/api/products/:id/favorite', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const nextVal = existing.isFavorite ? 0 : 1;
    db.prepare('UPDATE products SET isFavorite = ?, updatedAt = ? WHERE id = ?').run(nextVal, new Date().toISOString(), id);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(mapProductRow(updated));
  });

  app.patch('/api/products/:id/toggle', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const nextVal = existing.isActive ? 0 : 1;
    db.prepare('UPDATE products SET isActive = ?, updatedAt = ? WHERE id = ?').run(nextVal, new Date().toISOString(), id);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(mapProductRow(updated));
  });

  app.delete('/api/products/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Customers
  app.get('/api/customers', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as Customer[];
    res.json(rows);
  });

  app.post('/api/customers', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { name, phone, address } = req.body || {};
    if (!name || !phone) {
      res.status(400).json({ error: 'Customer name and phone are required.' });
      return;
    }
    const id = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO customers (id, name, phone, address, totalOrders, totalSpent, createdAt)
      VALUES (?, ?, ?, ?, 0, 0, ?)
    `).run(id, String(name).trim(), String(phone).trim(), String(address || '').trim(), now);
    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.status(201).json(created);
  });

  // Bills & Unified Sales History
  app.get('/api/bills', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM bills ORDER BY createdAt DESC').all();
    res.json(rows.map(mapBillRow));
  });

  app.get('/api/sales', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const billRows = db.prepare('SELECT * FROM bills ORDER BY createdAt DESC').all().map(mapBillRow);
    const orderRows = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all().map(mapOrderRow);

    const ordersById = new Map<string, CakeOrder>();
    for (const o of orderRows) {
      ordersById.set(o.id, o);
    }

    const coveredOrderIds = new Set<string>();
    const transactions: any[] = [];

    for (const b of billRows) {
      const linkedOrder = b.orderId ? ordersById.get(b.orderId) : undefined;
      if (b.orderId) {
        coveredOrderIds.add(b.orderId);
      }
      if (linkedOrder && linkedOrder.status === 'Cancelled') {
        continue;
      }

      const isOrder = b.type === 'order' || Boolean(linkedOrder);
      const amountReceived = linkedOrder ? linkedOrder.advanceAmount : b.amountPaid;
      const advanceAmount = isOrder ? (linkedOrder ? linkedOrder.advanceAmount : b.amountPaid) : 0;
      const balanceAmount = linkedOrder ? linkedOrder.balanceAmount : b.balanceAmount;

      transactions.push({
        id: b.id,
        billNumber: b.billNumber,
        orderNumber: b.orderNumber || linkedOrder?.orderNumber || null,
        type: isOrder ? 'order' : 'walkin',
        orderId: b.orderId || null,
        customerId: b.customerId || null,
        customerName: b.customerName || linkedOrder?.customerName || 'Walk-in Customer',
        customerPhone: b.customerPhone || linkedOrder?.customerPhone || '',
        customerAddress: b.customerAddress || linkedOrder?.customerAddress || '',
        items: b.items,
        subtotal: b.subtotal,
        discountPercent: b.discountPercent,
        discountAmount: b.discountAmount,
        taxRate: b.taxRate,
        taxAmount: b.taxAmount,
        grandTotal: b.grandTotal,
        paymentMode: b.paymentMode,
        amountReceived,
        advanceAmount,
        balanceAmount,
        paymentStatus: linkedOrder
          ? linkedOrder.balanceAmount <= 0
            ? 'Paid'
            : linkedOrder.advanceAmount > 0
            ? 'Partial'
            : 'Pending'
          : b.paymentStatus,
        paymentHistory: linkedOrder?.paymentHistory || [],
        orderStatus: linkedOrder?.status || null,
        fulfillmentType: linkedOrder?.fulfillmentType || null,
        deliveryDate: linkedOrder?.deliveryDate || null,
        deliveryTime: linkedOrder?.deliveryTime || null,
        notes: linkedOrder?.notes || null,
        username: b.username,
        createdAt: b.createdAt,
      });
    }

    for (const o of orderRows) {
      if (coveredOrderIds.has(o.id) || o.status === 'Cancelled') {
        continue;
      }
      transactions.push({
        id: `ord-tx-${o.id}`,
        billNumber: o.billNumber || o.orderNumber,
        orderNumber: o.orderNumber,
        type: 'order',
        orderId: o.id,
        customerId: o.customerId || null,
        customerName: o.customerName || 'Walk-in Customer',
        customerPhone: o.customerPhone || '',
        customerAddress: o.customerAddress || '',
        items: o.items,
        subtotal: o.subtotal,
        discountPercent: o.discountPercent,
        discountAmount: o.discountAmount,
        taxRate: o.taxRate,
        taxAmount: o.taxAmount,
        grandTotal: o.grandTotal,
        paymentMode: o.paymentMode,
        amountReceived: o.advanceAmount,
        advanceAmount: o.advanceAmount,
        balanceAmount: o.balanceAmount,
        paymentStatus: o.balanceAmount <= 0 ? 'Paid' : o.advanceAmount > 0 ? 'Partial' : 'Pending',
        paymentHistory: o.paymentHistory || [],
        orderStatus: o.status,
        fulfillmentType: o.fulfillmentType || 'Pickup',
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
        notes: o.notes,
        username: o.username,
        createdAt: o.createdAt,
      });
    }

    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(transactions);
  });

  app.post('/api/bills', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.currentUser!;
    const {
      type,
      items,
      discountPercent = 0,
      paymentMode,
      advanceAmount = 0,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      fulfillmentType,
      deliveryDate,
      deliveryTime,
      notes,
    } = req.body || {};

    if (type !== 'walkin' && type !== 'order') {
      res.status(400).json({ error: 'Invalid billing type.' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart is empty. Add at least one product before saving.' });
      return;
    }

    const cleanItems: CartItem[] = items.map((item: any) => {
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      return {
        productId: String(item.productId),
        productName: String(item.productName),
        category: item.category,
        unit: item.unit,
        quantity: qty,
        unitPrice: roundMoney(unitPrice),
        subtotal: roundMoney(qty * unitPrice),
      };
    });

    if (cleanItems.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      res.status(400).json({ error: 'All cart items must have a valid positive quantity or weight.' });
      return;
    }

    const cleanCustName = String(customerName || '').trim();
    const cleanCustPhone = String(customerPhone || '').trim();
    const cleanCustAddress = String(customerAddress || '').trim();

    if (type === 'order') {
      if (!cleanCustName) {
        res.status(400).json({ error: 'Customer name is required for cake orders.' });
        return;
      }
      if (!cleanCustPhone || cleanCustPhone.replace(/\D/g, '').length < 10) {
        res.status(400).json({ error: 'A valid 10-digit customer phone number is required for orders.' });
        return;
      }
      if (!deliveryDate) {
        res.status(400).json({ error: 'Expected delivery date is required for cake orders.' });
        return;
      }
      if (fulfillmentType === 'Delivery' && !cleanCustAddress) {
        res.status(400).json({ error: 'Delivery address is required when Delivery is selected.' });
        return;
      }
    } else if (cleanCustPhone && cleanCustPhone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: 'Please enter a valid 10-digit phone number or leave it blank.' });
      return;
    }

    const settings = getAllSettingsObject();
    const billingCfg = settings.billing || {};
    const subtotal = roundMoney(cleanItems.reduce((sum, i) => sum + i.subtotal, 0));
    const discPct = Math.max(0, Math.min(Number(discountPercent) || 0, billingCfg.maxDiscountPercent ?? 100));
    const discountAmount = roundMoney((subtotal * discPct) / 100);
    const taxable = Math.max(0, roundMoney(subtotal - discountAmount));
    const taxRate = billingCfg.gstEnabled ? Number(billingCfg.gstRate || 0) : 0;
    const taxAmount = roundMoney((taxable * taxRate) / 100);
    const grandTotal = roundMoney(taxable + taxAmount);

    let amountPaid = grandTotal;
    let balanceAmount = 0;
    let paymentStatus: 'Paid' | 'Partial' | 'Pending' = 'Paid';

    if (type === 'order') {
      if (paymentMode === 'Advance') {
        const adv = roundMoney(Number(advanceAmount) || 0);
        if (adv < 0 || adv > grandTotal) {
          res.status(400).json({ error: 'Advance amount must be between ₹0 and the Grand Total.' });
          return;
        }
        amountPaid = adv;
        balanceAmount = roundMoney(grandTotal - adv);
        paymentStatus = adv === 0 ? 'Pending' : adv >= grandTotal ? 'Paid' : 'Partial';
      } else {
        amountPaid = grandTotal;
        balanceAmount = 0;
        paymentStatus = 'Paid';
      }
    }

    const runTx = db.transaction(() => {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      let resolvedCustomerId: string | null = customerId || null;
      if (cleanCustPhone) {
        const existingCust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanCustPhone) as any;
        if (existingCust) {
          resolvedCustomerId = existingCust.id;
          db.prepare(`
            UPDATE customers
            SET name = ?, address = COALESCE(NULLIF(?, ''), address), totalOrders = totalOrders + 1, totalSpent = totalSpent + ?
            WHERE id = ?
          `).run(cleanCustName || existingCust.name, cleanCustAddress, amountPaid, existingCust.id);
        } else if (cleanCustName) {
          resolvedCustomerId = `cust-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(`
            INSERT INTO customers (id, name, phone, address, totalOrders, totalSpent, createdAt)
            VALUES (?, ?, ?, ?, 1, ?, ?)
          `).run(resolvedCustomerId, cleanCustName, cleanCustPhone, cleanCustAddress, amountPaid, nowIso);
        }
      }

      const billPrefix = billingCfg.billPrefix || 'EB';
      const orderPrefix = billingCfg.orderPrefix || 'ORD';
      const billId = `bill-${crypto.randomUUID().slice(0, 8)}`;
      const billNumber = generateNextCode(billPrefix, 'bills', 'billNumber');

      let orderId: string | null = null;
      let orderNumber: string | null = null;

      if (type === 'order') {
        orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
        orderNumber = generateNextCode(orderPrefix, 'orders', 'orderNumber');

        const paymentHistory: OrderPaymentEntry[] = [];
        if (amountPaid > 0) {
          paymentHistory.push({
            id: `pay-${crypto.randomUUID().slice(0, 6)}`,
            amount: amountPaid,
            mode: paymentMode === 'Advance' ? 'Cash' : paymentMode,
            date: nowIso,
            username: currentUser.username,
            note: paymentMode === 'Advance' ? 'Advance received on booking' : 'Full payment on booking',
          });
        }

        const resolvedFulfillment = fulfillmentType === 'Delivery' ? 'Delivery' : 'Pickup';

        db.prepare(`
          INSERT INTO orders (
            id, orderNumber, billId, billNumber, customerId, customerName, customerPhone, customerAddress,
            items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
            advanceAmount, balanceAmount, paymentMode, paymentHistory, status, fulfillmentType, orderDate, deliveryDate, deliveryTime,
            notes, userId, username, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          orderId,
          orderNumber,
          billId,
          billNumber,
          resolvedCustomerId,
          cleanCustName,
          cleanCustPhone,
          cleanCustAddress,
          JSON.stringify(cleanItems),
          subtotal,
          discPct,
          discountAmount,
          taxRate,
          taxAmount,
          grandTotal,
          amountPaid,
          balanceAmount,
          paymentMode,
          JSON.stringify(paymentHistory),
          'Pending',
          resolvedFulfillment,
          todayYmd,
          String(deliveryDate),
          String(deliveryTime || '18:00'),
          String(notes || '').trim(),
          currentUser.id,
          currentUser.username,
          nowIso,
          nowIso
        );
      }

      db.prepare(`
        INSERT INTO bills (
          id, billNumber, type, orderId, orderNumber, customerId, customerName, customerPhone, customerAddress,
          items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
          paymentMode, amountPaid, balanceAmount, paymentStatus, userId, username, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        billId,
        billNumber,
        type,
        orderId,
        orderNumber,
        resolvedCustomerId,
        cleanCustName || 'Walk-in Customer',
        cleanCustPhone,
        cleanCustAddress,
        JSON.stringify(cleanItems),
        subtotal,
        discPct,
        discountAmount,
        taxRate,
        taxAmount,
        grandTotal,
        paymentMode,
        amountPaid,
        balanceAmount,
        paymentStatus,
        currentUser.id,
        currentUser.username,
        nowIso
      );

      const savedBill = mapBillRow(db.prepare('SELECT * FROM bills WHERE id = ?').get(billId));
      const savedOrder = orderId ? mapOrderRow(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)) : null;
      return { bill: savedBill, order: savedOrder };
    });

    const result = runTx();
    res.status(201).json(result);
  });

  // Orders
  app.get('/api/orders', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
    res.json(rows.map(mapOrderRow));
  });

  app.put('/api/orders/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const { customerName, customerPhone, customerAddress, fulfillmentType, deliveryDate, deliveryTime, status, notes } = req.body || {};
    const validStatuses: OrderStatus[] = [
      'Pending',
      'Confirmed',
      'Preparing',
      'Ready for Pickup',
      'Delivered',
      'Cancelled',
    ];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const nextFulfillment =
      fulfillmentType === 'Delivery' || fulfillmentType === 'Pickup'
        ? fulfillmentType
        : existing.fulfillmentType || 'Pickup';

    const cleanName = String(customerName ?? existing.customerName).trim();
    const cleanPhone = String(customerPhone ?? existing.customerPhone).trim();
    const cleanAddress = String(customerAddress ?? existing.customerAddress).trim();
    const nowIso = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET customerName = ?, customerPhone = ?, customerAddress = ?, fulfillmentType = ?, deliveryDate = ?, deliveryTime = ?, status = ?, notes = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        cleanName,
        cleanPhone,
        cleanAddress,
        nextFulfillment,
        String(deliveryDate ?? existing.deliveryDate),
        String(deliveryTime ?? existing.deliveryTime),
        status ?? existing.status,
        String(notes ?? existing.notes).trim(),
        nowIso,
        id
      );

      if (existing.billId) {
        db.prepare(`
          UPDATE bills
          SET customerName = ?, customerPhone = ?, customerAddress = ?
          WHERE id = ?
        `).run(cleanName, cleanPhone, cleanAddress, existing.billId);
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(mapOrderRow(updated));
  });

  app.post('/api/orders/:id/payment', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const currentUser = req.currentUser!;
    const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!existingRow) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existing = mapOrderRow(existingRow);
    if (existing.status === 'Cancelled') {
      res.status(400).json({ error: 'Cannot record payment on a cancelled order.' });
      return;
    }

    const amount = roundMoney(Number(req.body?.amount));
    const mode = (req.body?.mode || 'Cash') as 'Cash' | 'UPI' | 'Card';
    const note = String(req.body?.note || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Payment amount must be greater than zero.' });
      return;
    }
    if (amount > existing.balanceAmount + 0.01) {
      res.status(400).json({ error: 'Payment amount cannot exceed the remaining balance.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const newAdvance = roundMoney(existing.advanceAmount + amount);
    const newBalance = Math.max(0, roundMoney(existing.grandTotal - newAdvance));
    const nextHistory: OrderPaymentEntry[] = [
      ...existing.paymentHistory,
      {
        id: `pay-${crypto.randomUUID().slice(0, 6)}`,
        amount,
        mode,
        date: nowIso,
        username: currentUser.username,
        note: note || 'Balance installment',
      },
    ];

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET advanceAmount = ?, balanceAmount = ?, paymentHistory = ?, updatedAt = ?
        WHERE id = ?
      `).run(newAdvance, newBalance, JSON.stringify(nextHistory), nowIso, id);

      if (existing.billId) {
        db.prepare(`
          UPDATE bills
          SET amountPaid = ?, balanceAmount = ?, paymentStatus = ?
          WHERE id = ?
        `).run(newAdvance, newBalance, newBalance === 0 ? 'Paid' : 'Partial', existing.billId);
      }

      if (existing.customerId) {
        db.prepare('UPDATE customers SET totalSpent = totalSpent + ? WHERE id = ?').run(amount, existing.customerId);
      }
    });

    tx();
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(mapOrderRow(updated));
  });

  app.post('/api/orders/:id/cancel', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?').run('Cancelled', nowIso, id);
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(mapOrderRow(updated));
  });

  // Expenses
  app.get('/api/expenses', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM expenses ORDER BY expenseDate DESC, createdAt DESC').all();
    res.json(rows.map(mapExpenseRow));
  });

  app.post('/api/expenses', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.currentUser!;
    const { category, description, amount, expenseDate, paymentMode } = req.body || {};
    const numAmount = roundMoney(Number(amount));
    if (!description || !String(description).trim()) {
      res.status(400).json({ error: 'Expense description is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Expense amount must be greater than zero.' });
      return;
    }
    const id = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO expenses (id, category, description, amount, expenseDate, paymentMode, userId, username, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(category || 'Others'),
      String(description).trim(),
      numAmount,
      String(expenseDate || nowIso.slice(0, 10)),
      String(paymentMode || 'Cash'),
      currentUser.id,
      currentUser.username,
      nowIso
    );
    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.status(201).json(mapExpenseRow(created));
  });

  app.put('/api/expenses/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    const { category, description, amount, expenseDate, paymentMode } = req.body || {};
    const numAmount = roundMoney(Number(amount));
    if (!description || !String(description).trim()) {
      res.status(400).json({ error: 'Expense description is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Expense amount must be greater than zero.' });
      return;
    }
    db.prepare(`
      UPDATE expenses
      SET category = ?, description = ?, amount = ?, expenseDate = ?, paymentMode = ?
      WHERE id = ?
    `).run(
      String(category || existing.category),
      String(description).trim(),
      numAmount,
      String(expenseDate || existing.expenseDate),
      String(paymentMode || existing.paymentMode),
      id
    );
    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(mapExpenseRow(updated));
  });

  app.delete('/api/expenses/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Settings
  app.get('/api/settings', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    res.json(getAllSettingsObject());
  });

  app.put('/api/settings', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const payload = req.body || {};
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = db.transaction(() => {
      for (const section of ['company', 'application', 'billing', 'printer']) {
        if (payload[section]) {
          upsert.run(section, JSON.stringify(payload[section]));
        }
      }
    });
    tx();
    res.json(getAllSettingsObject());
  });

  // Users Management
  app.get('/api/users', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all();
    res.json(rows.map(mapUserRow));
  });

  app.post('/api/users', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { username, password, fullName, role, permissions, active } = req.body || {};
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password || String(password).length < 4) {
      res.status(400).json({ error: 'Username and password (minimum 4 characters) are required.' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (existing) {
      res.status(409).json({ error: 'Username already exists.' });
      return;
    }

    const defaultPerms: UserPermissions = {
      home: true,
      billing: true,
      orders: true,
      sales: true,
      products: role !== 'cashier',
      expenses: role !== 'cashier',
      settings: role === 'admin',
    };

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, username, passwordHash, fullName, role, permissions, active, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanUsername,
      hashPassword(String(password)),
      String(fullName || cleanUsername).trim(),
      String(role || 'cashier'),
      JSON.stringify(permissions || defaultPerms),
      active === false ? 0 : 1,
      nowIso
    );

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.status(201).json(mapUserRow(created));
  });

  app.put('/api/users/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { username, password, fullName, role, permissions, active } = req.body || {};
    const cleanUsername = String(username ?? existing.username).trim();
    if (!cleanUsername) {
      res.status(400).json({ error: 'Username cannot be empty.' });
      return;
    }

    const duplicate = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(cleanUsername, id);
    if (duplicate) {
      res.status(409).json({ error: 'Another user already uses that username.' });
      return;
    }

    const nextHash = password && String(password).trim().length >= 4
      ? hashPassword(String(password))
      : existing.passwordHash;

    db.prepare(`
      UPDATE users
      SET username = ?, passwordHash = ?, fullName = ?, role = ?, permissions = ?, active = ?
      WHERE id = ?
    `).run(
      cleanUsername,
      nextHash,
      String(fullName ?? existing.fullName).trim(),
      String(role ?? existing.role),
      JSON.stringify(permissions ?? JSON.parse(existing.permissions)),
      active === undefined ? existing.active : active ? 1 : 0,
      id
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json(mapUserRow(updated));
  });

  app.delete('/api/users/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (req.currentUser?.id === id) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Backup Summary, Export & Restore
  app.get('/api/backup/summary', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const countOf = (table: string) => {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
      return Number(row?.cnt || 0);
    };
    res.json({
      products: countOf('products'),
      categories: countOf('categories'),
      customers: countOf('customers'),
      bills: countOf('bills'),
      orders: countOf('orders'),
      expenses: countOf('expenses'),
      users: countOf('users'),
    });
  });

  app.get('/api/backup/export', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getAllSettingsObject(),
      categories: db.prepare('SELECT * FROM categories ORDER BY isCustom ASC, sortOrder ASC, name ASC').all().map(mapCategoryRow),
      products: db.prepare('SELECT * FROM products').all().map(mapProductRow),
      customers: db.prepare('SELECT * FROM customers').all(),
      bills: db.prepare('SELECT * FROM bills').all().map(mapBillRow),
      orders: db.prepare('SELECT * FROM orders').all().map(mapOrderRow),
      expenses: db.prepare('SELECT * FROM expenses').all().map(mapExpenseRow),
    };
    res.json(backup);
  });

  app.post('/api/backup/restore', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
      res.status(400).json({ error: 'Invalid backup file format.' });
      return;
    }

    const tx = db.transaction(() => {
      if (data.settings) {
        const upsert = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        for (const section of ['company', 'application', 'billing', 'printer']) {
          if (data.settings[section]) {
            upsert.run(section, JSON.stringify(data.settings[section]));
          }
        }
      }

      if (Array.isArray(data.categories)) {
        db.prepare('DELETE FROM categories WHERE isCustom = 1').run();
        const insertCat = db.prepare(`
          INSERT OR IGNORE INTO categories (id, name, isCustom, sortOrder, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const c of data.categories) {
          if (c?.name) {
            insertCat.run(
              c.id || `cat-${crypto.randomUUID().slice(0, 8)}`,
              String(c.name).trim(),
              c.isCustom ? 1 : 0,
              Number(c.sortOrder || 100),
              c.createdAt || new Date().toISOString()
            );
          }
        }
      }

      db.prepare('DELETE FROM products').run();
      const insertProduct = db.prepare(`
        INSERT INTO products (id, name, category, price, unit, image, isFavorite, isActive, description, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.products || []) {
        insertProduct.run(
          p.id, p.name, p.category, Number(p.price), p.unit, p.image || '',
          p.isFavorite ? 1 : 0, p.isActive ? 1 : 0, p.description || '',
          p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString()
        );
      }

      if (Array.isArray(data.customers)) {
        db.prepare('DELETE FROM customers').run();
        const insertCust = db.prepare(`
          INSERT INTO customers (id, name, phone, address, totalOrders, totalSpent, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.customers) {
          insertCust.run(c.id, c.name, c.phone, c.address || '', c.totalOrders || 0, c.totalSpent || 0, c.createdAt || new Date().toISOString());
        }
      }

      if (Array.isArray(data.bills)) {
        db.prepare('DELETE FROM bills').run();
        const insertBill = db.prepare(`
          INSERT INTO bills (
            id, billNumber, type, orderId, orderNumber, customerId, customerName, customerPhone, customerAddress,
            items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
            paymentMode, amountPaid, balanceAmount, paymentStatus, userId, username, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const b of data.bills) {
          insertBill.run(
            b.id, b.billNumber, b.type, b.orderId || null, b.orderNumber || null, b.customerId || null,
            b.customerName, b.customerPhone || '', b.customerAddress || '',
            JSON.stringify(b.items || []), b.subtotal, b.discountPercent || 0, b.discountAmount || 0,
            b.taxRate || 0, b.taxAmount || 0, b.grandTotal, b.paymentMode, b.amountPaid,
            b.balanceAmount || 0, b.paymentStatus, b.userId, b.username, b.createdAt
          );
        }
      }

      if (Array.isArray(data.orders)) {
        db.prepare('DELETE FROM orders').run();
        const insertOrder = db.prepare(`
          INSERT INTO orders (
            id, orderNumber, billId, billNumber, customerId, customerName, customerPhone, customerAddress,
            items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
            advanceAmount, balanceAmount, paymentMode, paymentHistory, status, fulfillmentType, orderDate, deliveryDate, deliveryTime,
            notes, userId, username, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of data.orders) {
          insertOrder.run(
            o.id, o.orderNumber, o.billId || null, o.billNumber || null, o.customerId || null,
            o.customerName, o.customerPhone, o.customerAddress || '',
            JSON.stringify(o.items || []), o.subtotal, o.discountPercent || 0, o.discountAmount || 0,
            o.taxRate || 0, o.taxAmount || 0, o.grandTotal, o.advanceAmount || 0,
            o.balanceAmount || 0, o.paymentMode, JSON.stringify(o.paymentHistory || []),
            o.status, o.fulfillmentType === 'Delivery' ? 'Delivery' : 'Pickup',
            o.orderDate, o.deliveryDate, o.deliveryTime, o.notes || '',
            o.userId, o.username, o.createdAt, o.updatedAt || o.createdAt
          );
        }
      }

      if (Array.isArray(data.expenses)) {
        db.prepare('DELETE FROM expenses').run();
        const insertExp = db.prepare(`
          INSERT INTO expenses (id, category, description, amount, expenseDate, paymentMode, userId, username, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of data.expenses) {
          insertExp.run(e.id, e.category, e.description, e.amount, e.expenseDate, e.paymentMode, e.userId, e.username, e.createdAt);
        }
      }
    });

    tx();
    res.json({ success: true });
  });

  return app;
}
