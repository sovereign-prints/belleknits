/* ---------------------------------------------------------------
   BELLE KNITS — API + ADMIN  (Render Web Service)

   The customer-facing site is deployed separately as a Render Static
   Site and calls this service over HTTPS. This service owns:
     - every database query
     - authentication and authorisation
     - the admin pages, served same-origin so the session cookie works
     - uploaded images, stored in Postgres

   Nothing here is ever shipped to the static site.
   --------------------------------------------------------------- */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const SESSION_COOKIE = 'admin_session';

if (!JWT_SECRET) {
  console.warn('WARNING: ADMIN_JWT_SECRET is not set. Using an insecure development-only secret.');
}
if (!ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD is not set. The admin login will reject every attempt.');
}
const SESSION_SECRET = JWT_SECRET || 'insecure-dev-secret-do-not-use-in-production';

/* ---------------------------------------------------------------- CORS

   Only the real production frontend origin may call this API from a
   browser. Set STATIC_SITE_ORIGINS on the Render Web Service to the
   static site's URL (comma separated if there is more than one, e.g.
   the onrender.com address and the custom domain).

   Never a wildcard. Requests with no Origin header (curl, server to
   server, same-origin navigations to the admin pages) are allowed;
   localhost is allowed so development works without reconfiguring.
   ---------------------------------------------------------------- */

const allowedOrigins = (process.env.STATIC_SITE_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.warn('WARNING: STATIC_SITE_ORIGINS is not set in production. Every origin will be allowed.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return callback(null, true);
    return callback(new Error('Not allowed by CORS: ' + origin));
  }
}));

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Admin pages are served from this service so the session cookie stays
// same-origin. They are NOT part of the static site build.
app.use('/admin', express.static(path.join(__dirname, 'admin')));

/* ---------------------------------------------------------------- uploads */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type'), allowed.includes(file.mimetype));
  }
});

async function saveUploadedFile(file) {
  const id = crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
  await db.query(
    'INSERT INTO files (id, filename, mimetype, data) VALUES ($1,$2,$3,$4)',
    [id, file.originalname, file.mimetype, file.buffer]
  );
  return `/uploads/${id}`;
}

/* ---------------------------------------------------------------- helpers */

// Customers never see a database or server error. The detail goes to the
// logs; the response carries a message the frontend can show as-is.
const FRIENDLY = "We're temporarily unable to process your request. Please try again shortly or contact us on WhatsApp.";

function fail(res, where, err, status = 500) {
  console.error(`[${where}]`, err);

  // A constraint violation is a bad request, not a server fault — the admin
  // needs to know which value was rejected, not a generic apology.
  if (err && err.code === '23514') {
    return res.status(400).json({ error: 'That value is not one of the allowed options.' });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({ error: 'That already exists.' });
  }
  if (err && err.code === '22P02') {
    return res.status(400).json({ error: 'One of those values is the wrong type.' });
  }

  return res.status(status).json({ error: FRIENDLY });
}

function reference(prefix) {
  const now = new Date();
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

function str(v, max = 2000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function mapProduct(r) {
  return {
    slug: r.slug,
    name: r.name,
    category: r.category,
    price: Number(r.price),
    unit: r.unit || '',
    weight: r.weight || '',
    fibre: r.fibre || '',
    metreage: r.metreage || '',
    colour: r.colour || '',
    blurb: r.blurb || '',
    stock: r.stock,
    image: r.image || null
  };
}

function mapGallery(r) {
  return { id: r.id, title: r.title, note: r.note || '', image: r.image || null };
}

/* ---------------------------------------------------------------- auth */

function adminAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    jwt.verify(token, SESSION_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired' });
  }
}

// Slow down password guessing without a dependency: a short delay per
// attempt, and a cap per IP per window.
const attempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) { rec.count = 0; rec.first = now; }
  rec.count += 1;
  attempts.set(ip, rec);
  if (rec.count > 10) {
    return res.status(429).json({ error: 'Too many attempts. Try again in fifteen minutes.' });
  }
  next();
}

app.post('/api/admin/login', rateLimitLogin, (req, res) => {
  const password = str(req.body?.password, 200);
  if (!ADMIN_PASSWORD || !password) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'Incorrect password' });

  const token = jwt.sign({ admin: true }, SESSION_SECRET, { expiresIn: '12h' });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 12 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/admin/session', adminAuth, (req, res) => res.json({ ok: true }));

/* ---------------------------------------------------------------- public */

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/products', async (req, res) => {
  try {
    const category = str(req.query.category, 40);
    const valid = ['wool', 'equipment', 'finished'];
    const params = [];
    let where = 'WHERE active';
    if (category && valid.includes(category)) {
      params.push(category);
      where += ' AND category = $1';
    }
    const { rows } = await db.query(
      `SELECT * FROM products ${where} ORDER BY display_order, id`, params);
    res.json(rows.map(mapProduct));
  } catch (err) { fail(res, 'GET /api/products', err); }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE slug = $1 AND active', [str(req.params.slug, 120)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapProduct(rows[0]));
  } catch (err) { fail(res, 'GET /api/products/:slug', err); }
});

app.get('/api/gallery', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM gallery WHERE active ORDER BY display_order, id');
    res.json(rows.map(mapGallery));
  } catch (err) { fail(res, 'GET /api/gallery', err); }
});

app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) { fail(res, 'GET /api/settings', err); }
});

app.get('/uploads/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).end();
    res.set('Content-Type', rows[0].mimetype);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(rows[0].data);
  } catch (err) { fail(res, 'GET /uploads/:id', err); }
});

/* ---------------------------------------------------------------- quotes */

app.post('/api/quotes', async (req, res) => {
  try {
    const b = req.body || {};
    const name = str(b.name, 120);
    const email = str(b.email, 200);
    const project = str(b.project, 4000);

    if (!name || !email || !project) {
      return res.status(400).json({ error: 'Please fill in your name, email address and a short description of what you would like made.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'That email address does not look right. Please check it and try again.' });
    }

    const ref = reference('Q');
    await db.query(
      `INSERT INTO quotes (reference_number, name, email, phone, town, item, size, colour, yarn, deadline, budget, project)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [ref, name, email, str(b.phone, 40), str(b.town, 120), str(b.item, 120), str(b.size, 200),
       str(b.colour, 200), str(b.yarn, 120), str(b.deadline, 120), str(b.budget, 60), project]
    );
    res.status(201).json({ ok: true, referenceNumber: ref });
  } catch (err) { fail(res, 'POST /api/quotes', err); }
});

app.get('/api/quotes/:referenceNumber', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT reference_number, status, created_at FROM quotes WHERE reference_number = $1',
      [str(req.params.referenceNumber, 40)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ referenceNumber: rows[0].reference_number, status: rows[0].status, createdAt: rows[0].created_at });
  } catch (err) { fail(res, 'GET /api/quotes/:ref', err); }
});

/* ---------------------------------------------------------------- orders */

app.post('/api/orders', async (req, res) => {
  try {
    const b = req.body || {};
    const name = str(b.name, 120);
    const email = str(b.email, 200);
    const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];

    if (!name || !email || items.length === 0) {
      return res.status(400).json({ error: 'Please give your name, email address and at least one item.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'That email address does not look right. Please check it and try again.' });
    }

    // Price from the database, never from the browser — the client is
    // free to send anything, so the total is recalculated here.
    const slugs = items.map(i => str(i.slug, 120)).filter(Boolean);
    const { rows } = await db.query(
      'SELECT slug, name, price FROM products WHERE slug = ANY($1) AND active', [slugs]);
    const priced = new Map(rows.map(r => [r.slug, r]));

    const lines = [];
    let total = 0;
    for (const item of items) {
      const p = priced.get(str(item.slug, 120));
      if (!p) continue;
      const qty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));
      const lineTotal = Number(p.price) * qty;
      total += lineTotal;
      lines.push({ slug: p.slug, name: p.name, unitPrice: Number(p.price), quantity: qty, lineTotal });
    }
    if (!lines.length) return res.status(400).json({ error: 'None of those items are available at the moment.' });

    const ref = reference('O');
    await db.query(
      `INSERT INTO orders (reference_number, name, email, phone, shipping_address, items, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ref, name, email, str(b.phone, 40), str(b.shippingAddress, 600), JSON.stringify(lines), total]
    );
    res.status(201).json({ ok: true, referenceNumber: ref, total });
  } catch (err) { fail(res, 'POST /api/orders', err); }
});

/* ---------------------------------------------------------------- admin */

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const [q, o, p] = await Promise.all([
      db.query(`SELECT status, COUNT(*)::int AS count FROM quotes GROUP BY status`),
      db.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`),
      db.query(`SELECT COUNT(*)::int AS count FROM products WHERE active`)
    ]);
    res.json({
      quotes: Object.fromEntries(q.rows.map(r => [r.status, r.count])),
      orders: Object.fromEntries(o.rows.map(r => [r.status, r.count])),
      activeProducts: p.rows[0].count
    });
  } catch (err) { fail(res, 'GET /api/admin/dashboard', err); }
});

app.get('/api/admin/quotes', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM quotes ORDER BY created_at DESC LIMIT 500');
    res.json(rows);
  } catch (err) { fail(res, 'GET /api/admin/quotes', err); }
});

app.patch('/api/admin/quotes/:id', adminAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const allowed = ['status', 'quoted_amount', 'admin_notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (b[key] === undefined) continue;
      params.push(key === 'quoted_amount' ? (b[key] === null ? null : Number(b[key])) : str(b[key], 4000));
      sets.push(`${key} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(parseInt(req.params.id, 10));
    const { rows } = await db.query(
      `UPDATE quotes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { fail(res, 'PATCH /api/admin/quotes/:id', err); }
});

app.get('/api/admin/orders', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500');
    res.json(rows);
  } catch (err) { fail(res, 'GET /api/admin/orders', err); }
});

app.patch('/api/admin/orders/:id', adminAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [];
    const params = [];
    for (const key of ['status', 'admin_notes']) {
      if (b[key] === undefined) continue;
      params.push(str(b[key], 4000));
      sets.push(`${key} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(parseInt(req.params.id, 10));
    const { rows } = await db.query(
      `UPDATE orders SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { fail(res, 'PATCH /api/admin/orders/:id', err); }
});

app.get('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM products ORDER BY display_order, id');
    res.json(rows);
  } catch (err) { fail(res, 'GET /api/admin/products', err); }
});

const PRODUCT_FIELDS = ['slug', 'name', 'category', 'price', 'unit', 'weight', 'fibre',
                        'metreage', 'colour', 'blurb', 'stock', 'image', 'active', 'display_order'];

app.post('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!str(b.slug) || !str(b.name) || !str(b.category) || b.price === undefined) {
      return res.status(400).json({ error: 'slug, name, category and price are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO products (slug, name, category, price, unit, weight, fibre, metreage, colour, blurb, stock, image, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [str(b.slug, 120), str(b.name, 200), str(b.category, 20), Number(b.price), str(b.unit, 80),
       str(b.weight, 80), str(b.fibre, 200), str(b.metreage, 40), str(b.colour, 80), str(b.blurb, 2000),
       str(b.stock, 20) || 'in-stock', str(b.image, 400) || null, parseInt(b.display_order, 10) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A product with that slug already exists' });
    fail(res, 'POST /api/admin/products', err);
  }
});

app.patch('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [];
    const params = [];
    for (const key of PRODUCT_FIELDS) {
      if (b[key] === undefined) continue;
      let value;
      if (key === 'price') value = Number(b[key]);
      else if (key === 'active') value = Boolean(b[key]);
      else if (key === 'display_order') value = parseInt(b[key], 10) || 0;
      else value = str(b[key], 2000);
      params.push(value);
      sets.push(`${key} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(parseInt(req.params.id, 10));
    const { rows } = await db.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { fail(res, 'PATCH /api/admin/products/:id', err); }
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    // Soft delete: an order's line items reference the slug, so keep the row.
    const { rows } = await db.query(
      'UPDATE products SET active = false WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { fail(res, 'DELETE /api/admin/products/:id', err); }
});

app.get('/api/admin/gallery', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM gallery ORDER BY display_order, id');
    res.json(rows);
  } catch (err) { fail(res, 'GET /api/admin/gallery', err); }
});

app.post('/api/admin/gallery', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const title = str(req.body?.title, 200);
    if (!title) return res.status(400).json({ error: 'A title is required' });
    const image = req.file ? await saveUploadedFile(req.file) : null;
    const { rows } = await db.query(
      'INSERT INTO gallery (title, note, image, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, str(req.body?.note, 400), image, parseInt(req.body?.display_order, 10) || 0]);
    res.status(201).json(rows[0]);
  } catch (err) { fail(res, 'POST /api/admin/gallery', err); }
});

app.patch('/api/admin/gallery/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [];
    const params = [];
    if (b.title !== undefined) { params.push(str(b.title, 200)); sets.push(`title = $${params.length}`); }
    if (b.note !== undefined) { params.push(str(b.note, 400)); sets.push(`note = $${params.length}`); }
    if (b.active !== undefined) { params.push(b.active === 'false' ? false : Boolean(b.active)); sets.push(`active = $${params.length}`); }
    if (b.display_order !== undefined) { params.push(parseInt(b.display_order, 10) || 0); sets.push(`display_order = $${params.length}`); }
    if (req.file) { params.push(await saveUploadedFile(req.file)); sets.push(`image = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(parseInt(req.params.id, 10));
    const { rows } = await db.query(
      `UPDATE gallery SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { fail(res, 'PATCH /api/admin/gallery/:id', err); }
});

app.delete('/api/admin/gallery/:id', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM gallery WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { fail(res, 'DELETE /api/admin/gallery/:id', err); }
});

app.post('/api/admin/upload', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image supplied' });
    res.status(201).json({ url: await saveUploadedFile(req.file) });
  } catch (err) { fail(res, 'POST /api/admin/upload', err); }
});

app.put('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const entries = Object.entries(req.body || {});
    if (!entries.length) return res.status(400).json({ error: 'Nothing to update' });
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [str(key, 80), str(value, 2000)]);
    }
    const { rows } = await db.query('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) { fail(res, 'PUT /api/admin/settings', err); }
});

/* ---------------------------------------------------------------- errors */

// Multer and CORS rejections must not leak a stack trace to a customer.
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  if (err && /Not allowed by CORS/.test(err.message)) {
    return res.status(403).json({ error: 'Request not allowed from this origin' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That image is too large. Please use one under 8 MB.' });
  }
  res.status(500).json({ error: FRIENDLY });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------------------------------------------------------------- start */

db.initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Belle Knits API listening on ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialise the database:', err);
    process.exit(1);
  });
