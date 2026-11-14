import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    const tmpDbPath = path.join(os.tmpdir(), 'easybill.db');
    const bundledDbPath = path.resolve(process.cwd(), 'easybill.db');
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
      } catch {
        // Ignore copy errors and allow initDatabase() to initialize a fresh DB
      }
    }
    return tmpDbPath;
  }

  return path.resolve(process.cwd(), 'easybill.db');
}

const DB_PATH = resolveDatabasePath();

export const db = new Database(DB_PATH);
try {
  db.pragma('journal_mode = WAL');
} catch {
  // Fallback cleanly if WAL is unsupported on the host filesystem
}
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

const TOKEN_SECRET = process.env.EASYBILL_TOKEN_SECRET || 'easybill-pos-local-secret-key-2026';

export function createAuthToken(userId: string, username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, username, iat: Date.now() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string): { userId: string; username: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.userId) return null;
    return { userId: parsed.userId, username: parsed.username };
  } catch {
    return null;
  }
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      isFavorite INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      totalOrders INTEGER NOT NULL DEFAULT 0,
      totalSpent REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      billNumber TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      orderId TEXT,
      orderNumber TEXT,
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL DEFAULT '',
      customerAddress TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discountPercent REAL NOT NULL DEFAULT 0,
      discountAmount REAL NOT NULL DEFAULT 0,
      taxRate REAL NOT NULL DEFAULT 0,
      taxAmount REAL NOT NULL DEFAULT 0,
      grandTotal REAL NOT NULL,
      paymentMode TEXT NOT NULL,
      amountPaid REAL NOT NULL,
      balanceAmount REAL NOT NULL DEFAULT 0,
      paymentStatus TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      billId TEXT,
      billNumber TEXT,
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      customerAddress TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discountPercent REAL NOT NULL DEFAULT 0,
      discountAmount REAL NOT NULL DEFAULT 0,
      taxRate REAL NOT NULL DEFAULT 0,
      taxAmount REAL NOT NULL DEFAULT 0,
      grandTotal REAL NOT NULL,
      advanceAmount REAL NOT NULL DEFAULT 0,
      balanceAmount REAL NOT NULL DEFAULT 0,
      paymentMode TEXT NOT NULL,
      paymentHistory TEXT NOT NULL,
      status TEXT NOT NULL,
      fulfillmentType TEXT NOT NULL DEFAULT 'Pickup',
      orderDate TEXT NOT NULL,
      deliveryDate TEXT NOT NULL,
      deliveryTime TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expenseDate TEXT NOT NULL,
      paymentMode TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  try {
    db.exec(`ALTER TABLE orders ADD COLUMN fulfillmentType TEXT NOT NULL DEFAULT 'Pickup'`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`UPDATE products SET image = REPLACE(image, '/src/assets/images/', '/images/') WHERE image LIKE '/src/assets/images/%'`);
  } catch {
    // Ignore if update is unnecessary
  }

  seedInitialData();
}

function getDefaultSettings() {
  return {
    company: {
      name: 'Velvet Crumb Patisserie',
      logo: '',
      address: '42 Baker Street, Indiranagar, Bengaluru 560038',
      phone: '+91 98765 43210',
      email: 'hello@velvetcrumb.in',
      gstin: '29AABCV1234F1Z5',
    },
    application: {
      appName: 'Easy Bill',
      appLogo: '',
      theme: 'light',
      dateFormat: 'DD-MM-YYYY',
      currencySymbol: '₹',
    },
    billing: {
      billPrefix: 'EB',
      orderPrefix: 'ORD',
      gstEnabled: true,
      gstRate: 5,
      defaultPaymentMode: 'Cash',
      allowDiscount: true,
      maxDiscountPercent: 25,
      receiptFooter: 'Thank you for celebrating with us! Visit again.',
    },
    printer: {
      selectedPrinter: 'Epson TM-T82 Thermal',
      paperSize: '80mm',
      isConnected: true,
      autoPrint: true,
      copies: 1,
    },
  };
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seedInitialData(): void {
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  const nowIso = new Date().toISOString();

  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, passwordHash, fullName, role, permissions, active, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'usr-admin',
      'admin',
      hashPassword('admin123'),
      'Aarav Mehta (Admin)',
      'admin',
      JSON.stringify({
        home: true,
        billing: true,
        orders: true,
        sales: true,
        products: true,
        expenses: true,
        settings: true,
      }),
      1,
      nowIso
    );

    insertUser.run(
      'usr-cashier',
      'cashier',
      hashPassword('cashier123'),
      'Priya Nair (Counter)',
      'cashier',
      JSON.stringify({
        home: true,
        billing: true,
        orders: true,
        sales: true,
        products: true,
        expenses: true,
        settings: true,
      }),
      1,
      nowIso
    );
  } else {
    const existingCashier = db.prepare('SELECT permissions FROM users WHERE id = ?').get('usr-cashier') as { permissions: string } | undefined;
    if (existingCashier) {
      try {
        const parsed = JSON.parse(existingCashier.permissions);
        if (!parsed.expenses || !parsed.settings) {
          parsed.expenses = true;
          parsed.settings = true;
          db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(parsed), 'usr-cashier');
        }
      } catch {
        // ignore parse issues
      }
    }
  }

  const settingsCount = (db.prepare('SELECT COUNT(*) as cnt FROM settings').get() as { cnt: number }).cnt;
  if (settingsCount === 0) {
    const defaults = getDefaultSettings();
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) {
      insertSetting.run(k, JSON.stringify(v));
    }
  }

  const prodCount = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt;
  if (prodCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, category, price, unit, image, isFavorite, isActive, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedProducts = [
      ['prd-01', 'Belgian Dark Chocolate Truffle', 'Cakes', 950, 'KG', '/images/product_truffle_cake_1794586326747.jpg', 1, 1, 'Rich dark Belgian ganache layered sponge cake'],
      ['prd-02', 'Classic Red Velvet Celebration', 'Cakes', 1100, 'KG', '/images/product_red_velvet_1794586327823.jpg', 1, 1, 'Crimson cocoa sponge with whipped cream cheese frosting'],
      ['prd-03', 'Fresh Strawberry Chantilly', 'Cakes', 980, 'KG', '/images/product_fruit_pastry_1794586327935.jpg', 1, 1, 'Vanilla sponge layered with fresh strawberries and cream'],
      ['prd-04', 'Dutch Truffle Pastry Slice', 'Pastries', 140, 'Piece', '/images/product_truffle_cake_1794586326747.jpg', 1, 1, 'Single-serve decadent dark chocolate ganache slice'],
      ['prd-05', 'Strawberry Mille-Feuille Pastry', 'Pastries', 165, 'Piece', '/images/product_fruit_pastry_1794586327935.jpg', 0, 1, 'Crisp puff pastry with vanilla bean cream & berries'],
      ['prd-06', 'Red Velvet Cream Slice', 'Pastries', 150, 'Piece', '/images/product_red_velvet_1794586327823.jpg', 0, 1, 'Velvety single portion pastry with cream cheese swirl'],
      ['prd-07', 'Madagascar Vanilla Cupcake', 'Cupcakes', 85, 'Piece', '/images/product_gourmet_cupcakes_1794586328314.jpg', 1, 1, 'Fluffy vanilla bean cupcake with buttercream swirl'],
      ['prd-08', 'Dark Ganache Fudge Cupcake', 'Cupcakes', 95, 'Piece', '/images/product_gourmet_cupcakes_1794586328314.jpg', 0, 1, 'Double chocolate cupcake topped with gold leaf'],
      ['prd-09', 'Artisan Chocolate Truffles', 'Chocolates', 120, 'Gram', '/images/product_chocolate_truffles_1794586329086.jpg', 1, 1, 'Hand-rolled hazelnut & dark chocolate pralines (per 100g base unit)'],
      ['prd-10', 'Pistachio French Macarons', 'Desserts', 110, 'Piece', '/images/product_chocolate_truffles_1794586329086.jpg', 0, 1, 'Delicate almond meringue shells with pistachio ganache'],
      ['prd-11', 'Almond Butter Shortbread', 'Cookies', 280, 'Gram', '/images/product_bakery_cookies_1794586329016.jpg', 0, 1, 'Crisp toasted almond cookies baked in pure butter'],
      ['prd-12', 'Sea Salt Choco Chunk Cookies', 'Cookies', 240, 'Gram', '/images/product_bakery_cookies_1794586329016.jpg', 1, 1, 'Chewy brown-butter cookies loaded with 70% dark chunks'],
      ['prd-13', 'Baked Cheese Puff Patty', 'Snacks', 65, 'Piece', '/images/product_bakery_cookies_1794586329016.jpg', 0, 1, 'Flaky savoury puff pastry with spiced cheddar filling'],
      ['prd-14', 'Iced Belgian Mocha', 'Beverages', 160, 'Piece', '/images/product_chocolate_truffles_1794586329086.jpg', 0, 1, 'Chilled espresso blended with Belgian dark cocoa'],
      ['prd-15', 'Gold Birthday Topper & Candle', 'Others', 90, 'Piece', '/images/product_gourmet_cupcakes_1794586328314.jpg', 0, 1, 'Acrylic celebration cake topper with sparkler candle'],
    ];

    for (const p of seedProducts) {
      insertProduct.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], nowIso, nowIso);
    }
  }

  const custCount = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }).cnt;
  if (custCount === 0) {
    const insertCust = db.prepare(`
      INSERT INTO customers (id, name, phone, address, totalOrders, totalSpent, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertCust.run('cust-01', 'Ananya Sharma', '9845011223', '12th Main, Indiranagar, Bengaluru', 2, 3450, nowIso);
    insertCust.run('cust-02', 'Rohan Kulkarni', '9900123456', 'Koramangala 4th Block, Bengaluru', 1, 1890, nowIso);
    insertCust.run('cust-03', 'Meera Krishnan', '9880234567', 'HSR Layout Sector 2, Bengaluru', 1, 1155, nowIso);
    insertCust.run('cust-04', 'Vikram Desai', '9740198765', 'Ulsoor Lake Road, Bengaluru', 1, 693, nowIso);
  }

  const billCount = (db.prepare('SELECT COUNT(*) as cnt FROM bills').get() as { cnt: number }).cnt;
  if (billCount === 0) {
    const today = new Date();
    const todayYmd = formatYMD(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    const insertBill = db.prepare(`
      INSERT INTO bills (
        id, billNumber, type, orderId, orderNumber, customerId, customerName, customerPhone, customerAddress,
        items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
        paymentMode, amountPaid, balanceAmount, paymentStatus, userId, username, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, orderNumber, billId, billNumber, customerId, customerName, customerPhone, customerAddress,
        items, subtotal, discountPercent, discountAmount, taxRate, taxAmount, grandTotal,
        advanceAmount, balanceAmount, paymentMode, paymentHistory, status, orderDate, deliveryDate, deliveryTime,
        notes, userId, username, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const d1 = new Date(today); d1.setHours(9, 45, 0, 0);
    const d2 = new Date(today); d2.setHours(11, 15, 0, 0);
    const d3 = new Date(today); d3.setHours(13, 20, 0, 0);
    const d4 = new Date(today); d4.setHours(15, 10, 0, 0);
    const d5 = new Date(yesterday); d5.setHours(17, 30, 0, 0);
    const d6 = new Date(yesterday); d6.setHours(19, 5, 0, 0);

    // Order 1 (Pending balance)
    const ord1Items = [
      { productId: 'prd-01', productName: 'Belgian Dark Chocolate Truffle', category: 'Cakes', unit: 'KG', quantity: 2, unitPrice: 950, subtotal: 1900 },
      { productId: 'prd-15', productName: 'Gold Birthday Topper & Candle', category: 'Others', unit: 'Piece', quantity: 1, unitPrice: 90, subtotal: 90 },
    ];
    insertBill.run(
      'bill-01', 'EB-1001', 'order', 'ord-01', 'ORD-501', 'cust-01',
      'Ananya Sharma', '9845011223', '12th Main, Indiranagar, Bengaluru',
      JSON.stringify(ord1Items), 1990, 0, 0, 5, 99.5, 2089.5,
      'Advance', 1000, 1089.5, 'Partial', 'usr-admin', 'admin', d1.toISOString()
    );
    insertOrder.run(
      'ord-01', 'ORD-501', 'bill-01', 'EB-1001', 'cust-01',
      'Ananya Sharma', '9845011223', '12th Main, Indiranagar, Bengaluru',
      JSON.stringify(ord1Items), 1990, 0, 0, 5, 99.5, 2089.5,
      1000, 1089.5, 'Advance',
      JSON.stringify([{ id: 'pay-01', amount: 1000, mode: 'UPI', date: d1.toISOString(), username: 'admin', note: 'Initial booking advance' }]),
      'Preparing', todayYmd, formatYMD(tomorrow), '18:30', 'Message: Happy 25th Anniversary Mom & Dad',
      'usr-admin', 'admin', d1.toISOString(), d1.toISOString()
    );

    // Order 2 (Ready for pickup today)
    const ord2Items = [
      { productId: 'prd-02', productName: 'Classic Red Velvet Celebration', category: 'Cakes', unit: 'KG', quantity: 1.5, unitPrice: 1100, subtotal: 1650 },
    ];
    insertBill.run(
      'bill-02', 'EB-1002', 'order', 'ord-02', 'ORD-502', 'cust-02',
      'Rohan Kulkarni', '9900123456', 'Koramangala 4th Block, Bengaluru',
      JSON.stringify(ord2Items), 1650, 0, 0, 5, 82.5, 1732.5,
      'Advance', 800, 932.5, 'Partial', 'usr-cashier', 'cashier', d2.toISOString()
    );
    insertOrder.run(
      'ord-02', 'ORD-502', 'bill-02', 'EB-1002', 'cust-02',
      'Rohan Kulkarni', '9900123456', 'Koramangala 4th Block, Bengaluru',
      JSON.stringify(ord2Items), 1650, 0, 0, 5, 82.5, 1732.5,
      800, 932.5, 'Advance',
      JSON.stringify([{ id: 'pay-02', amount: 800, mode: 'Cash', date: d2.toISOString(), username: 'cashier', note: 'Counter advance' }]),
      'Ready for Pickup', todayYmd, todayYmd, '19:00', 'Eggless Red Velvet · Message: Happy Birthday Kabir',
      'usr-cashier', 'cashier', d2.toISOString(), d2.toISOString()
    );

    // Order 3 (Confirmed for day after tomorrow)
    const ord3Items = [
      { productId: 'prd-03', productName: 'Fresh Strawberry Chantilly', category: 'Cakes', unit: 'KG', quantity: 1, unitPrice: 980, subtotal: 980 },
      { productId: 'prd-07', productName: 'Madagascar Vanilla Cupcake', category: 'Cupcakes', unit: 'Piece', quantity: 6, unitPrice: 85, subtotal: 510 },
    ];
    insertBill.run(
      'bill-03', 'EB-1003', 'order', 'ord-03', 'ORD-503', 'cust-03',
      'Meera Krishnan', '9880234567', 'HSR Layout Sector 2, Bengaluru',
      JSON.stringify(ord3Items), 1490, 0, 0, 5, 74.5, 1564.5,
      'Advance', 500, 1064.5, 'Partial', 'usr-admin', 'admin', d3.toISOString()
    );
    insertOrder.run(
      'ord-03', 'ORD-503', 'bill-03', 'EB-1003', 'cust-03',
      'Meera Krishnan', '9880234567', 'HSR Layout Sector 2, Bengaluru',
      JSON.stringify(ord3Items), 1490, 0, 0, 5, 74.5, 1564.5,
      500, 1064.5, 'Advance',
      JSON.stringify([{ id: 'pay-03', amount: 500, mode: 'Card', date: d3.toISOString(), username: 'admin', note: 'Booking token' }]),
      'Confirmed', todayYmd, formatYMD(dayAfter), '16:00', 'Pack cupcakes in separate gift box',
      'usr-admin', 'admin', d3.toISOString(), d3.toISOString()
    );

    // Walk-in Bills
    const w1 = [
      { productId: 'prd-04', productName: 'Dutch Truffle Pastry Slice', category: 'Pastries', unit: 'Piece', quantity: 2, unitPrice: 140, subtotal: 280 },
      { productId: 'prd-14', productName: 'Iced Belgian Mocha', category: 'Beverages', unit: 'Piece', quantity: 2, unitPrice: 160, subtotal: 320 },
    ];
    insertBill.run(
      'bill-04', 'EB-1004', 'walkin', null, null, 'cust-04',
      'Vikram Desai', '9740198765', 'Ulsoor Lake Road, Bengaluru',
      JSON.stringify(w1), 600, 0, 0, 5, 30, 630,
      'UPI', 630, 0, 'Paid', 'usr-cashier', 'cashier', d4.toISOString()
    );

    const w2 = [
      { productId: 'prd-01', productName: 'Belgian Dark Chocolate Truffle', category: 'Cakes', unit: 'KG', quantity: 0.5, unitPrice: 950, subtotal: 475 },
      { productId: 'prd-10', productName: 'Pistachio French Macarons', category: 'Desserts', unit: 'Piece', quantity: 4, unitPrice: 110, subtotal: 440 },
    ];
    insertBill.run(
      'bill-05', 'EB-1005', 'walkin', null, null, null,
      'Walk-in Customer', '', '',
      JSON.stringify(w2), 915, 0, 0, 5, 45.75, 960.75,
      'Cash', 960.75, 0, 'Paid', 'usr-cashier', 'cashier', d5.toISOString()
    );

    const w3 = [
      { productId: 'prd-12', productName: 'Sea Salt Choco Chunk Cookies', category: 'Cookies', unit: 'Gram', quantity: 2, unitPrice: 240, subtotal: 480 },
      { productId: 'prd-05', productName: 'Strawberry Mille-Feuille Pastry', category: 'Pastries', unit: 'Piece', quantity: 2, unitPrice: 165, subtotal: 330 },
    ];
    insertBill.run(
      'bill-06', 'EB-1006', 'walkin', null, null, 'cust-01',
      'Ananya Sharma', '9845011223', '12th Main, Indiranagar, Bengaluru',
      JSON.stringify(w3), 810, 0, 0, 5, 40.5, 850.5,
      'Card', 850.5, 0, 'Paid', 'usr-admin', 'admin', d6.toISOString()
    );
  }

  const expCount = (db.prepare('SELECT COUNT(*) as cnt FROM expenses').get() as { cnt: number }).cnt;
  if (expCount === 0) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 2);
    const midDay = new Date(today.getFullYear(), today.getMonth(), Math.min(today.getDate(), 10));
    const todayYmd = formatYMD(today);

    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, category, description, amount, expenseDate, paymentMode, userId, username, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertExpense.run('exp-01', 'Raw Materials', 'Belgian Couverture Chocolate & Dairy Cream (20kg)', 8450, formatYMD(firstDay), 'Bank Transfer', 'usr-admin', 'admin', nowIso);
    insertExpense.run('exp-02', 'Packaging', 'Custom Cake Boxes, Gold Boards & Ribbons', 3200, formatYMD(midDay), 'UPI', 'usr-admin', 'admin', nowIso);
    insertExpense.run('exp-03', 'Electricity', 'Commercial Deck Oven & Chiller Power Bill', 4650, todayYmd, 'UPI', 'usr-admin', 'admin', nowIso);
  }
}
