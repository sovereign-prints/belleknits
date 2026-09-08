/* ---------------------------------------------------------------
   NEON POSTGRES

   The only file that opens a database connection. DATABASE_URL lives
   in the Render Web Service's environment and nowhere else — never
   in the frontend, never committed.

   On first connection initSchema() creates the tables and seeds the
   opening catalogue if the database is empty, so a fresh Neon branch
   needs no manual migration step.
   --------------------------------------------------------------- */

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function query(text, params) {
  return pool.query(text, params);
}

// ---------------------------------------------------------------- seed data

const DEFAULT_PRODUCTS = [
  // --- wool & yarn -------------------------------------------------------
  { slug: 'merino-dk-undyed', name: 'Merino DK — Undyed', category: 'wool', price: 145,
    unit: '100g ball', weight: 'DK / 8 ply', fibre: '100% merino wool', metreage: '225 m', colour: 'Natural cream',
    blurb: 'Soft, springy South African merino left undyed. A workhorse for jerseys and baby knits.', stock: 'in-stock' },
  { slug: 'merino-dk-heather', name: 'Merino DK — Heather', category: 'wool', price: 165,
    unit: '100g ball', weight: 'DK / 8 ply', fibre: '100% merino wool', metreage: '225 m', colour: 'Heather grey',
    blurb: 'The same merino base, kettle-dyed in small batches for a gently mottled grey.', stock: 'in-stock' },
  { slug: 'mohair-silk-lace', name: 'Mohair Silk Lace', category: 'wool', price: 280,
    unit: '25g ball', weight: 'Lace / 2 ply', fibre: '72% kid mohair, 28% silk', metreage: '420 m', colour: 'Dusty rose',
    blurb: 'A halo of kid mohair on a silk core. Knit alone for weightless shawls, or held double.', stock: 'low' },
  { slug: 'chunky-roving', name: 'Chunky Roving', category: 'wool', price: 210,
    unit: '200g skein', weight: 'Super chunky', fibre: '100% wool', metreage: '80 m', colour: 'Oatmeal',
    blurb: 'Big, lofty and quick. A blanket in a weekend on 12 mm needles.', stock: 'in-stock' },
  { slug: 'cotton-4ply', name: 'Organic Cotton 4 Ply', category: 'wool', price: 120,
    unit: '50g ball', weight: '4 ply / fingering', fibre: '100% organic cotton', metreage: '170 m', colour: 'Sage',
    blurb: 'Cool and crisp with good stitch definition. Summer tops, dishcloths, market bags.', stock: 'in-stock' },
  { slug: 'sock-yarn-speckle', name: 'Sock Yarn — Speckle', category: 'wool', price: 250,
    unit: '100g skein', weight: '4 ply / fingering', fibre: '75% merino, 25% nylon', metreage: '400 m', colour: 'Speckled berry',
    blurb: 'Hard-wearing nylon blend, hand-speckled. Enough for one adult pair.', stock: 'in-stock' },

  // --- knitting equipment ------------------------------------------------
  { slug: 'bamboo-needle-set', name: 'Bamboo Straight Needle Set', category: 'equipment', price: 480,
    unit: 'set of 8 pairs',
    blurb: 'Sizes 3 mm to 8 mm in a cotton roll. Warm in the hand and quiet to work with.', stock: 'in-stock' },
  { slug: 'interchangeable-circulars', name: 'Interchangeable Circular Set', category: 'equipment', price: 1250,
    unit: 'set',
    blurb: 'Nine tip pairs and four cable lengths in a zip case. The last needle set you need to buy.', stock: 'low' },
  { slug: 'dpn-set-25mm', name: 'Double-Pointed Needles 2.5 mm', category: 'equipment', price: 130,
    unit: 'set of 5',
    blurb: 'Stainless steel, 20 cm. The sock knitter’s standard.', stock: 'in-stock' },
  { slug: 'stitch-markers', name: 'Brass Stitch Markers', category: 'equipment', price: 95,
    unit: 'set of 12',
    blurb: 'Snag-free rings in three sizes, in a small tin.', stock: 'in-stock' },
  { slug: 'row-counter', name: 'Row Counter Ring', category: 'equipment', price: 180,
    unit: 'each',
    blurb: 'Adjustable brass ring that counts to 99 without leaving your hand.', stock: 'in-stock' },
  { slug: 'project-bag', name: 'Waxed Canvas Project Bag', category: 'equipment', price: 390,
    unit: 'each',
    blurb: 'Water-resistant, flat-bottomed, with an inner notions pocket and a yarn guide grommet.', stock: 'in-stock' },

  // --- finished pieces ---------------------------------------------------
  { slug: 'fishermans-jersey', name: 'Fisherman’s Cable Jersey', category: 'finished', price: 2850,
    unit: 'each',
    blurb: 'Hand-knitted in undyed merino, traditional cable and moss panels. Made to order in your size.', stock: 'made-to-order' },
  { slug: 'mohair-shawl', name: 'Mohair Halo Shawl', category: 'finished', price: 1650,
    unit: 'each',
    blurb: 'A weightless triangular shawl in kid mohair and silk. Blocks out to 180 cm.', stock: 'in-stock' },
  { slug: 'baby-blanket', name: 'Heirloom Baby Blanket', category: 'finished', price: 1450,
    unit: 'each',
    blurb: 'Soft merino in a basketweave stitch, 80 × 100 cm. Machine washable on a wool cycle.', stock: 'in-stock' },
  { slug: 'wool-socks', name: 'Hand-Knitted Wool Socks', category: 'finished', price: 520,
    unit: 'pair',
    blurb: 'Merino and nylon, reinforced heel and toe. Choose your size and colourway.', stock: 'made-to-order' },
  { slug: 'beanie-ribbed', name: 'Ribbed Merino Beanie', category: 'finished', price: 420,
    unit: 'each',
    blurb: 'Double-layered brim, snug without being tight. One size.', stock: 'in-stock' },
  { slug: 'cushion-cover', name: 'Cable Cushion Cover', category: 'finished', price: 680,
    unit: 'each',
    blurb: 'Chunky cabled front, buttoned back, fits a 45 cm inner.', stock: 'in-stock' }
];

const DEFAULT_GALLERY = [
  { title: 'Aran jersey in undyed merino', note: 'Commissioned piece, 2025' },
  { title: 'Christening shawl', note: 'Lace weight mohair silk' },
  { title: 'Colourwork yoke cardigan', note: 'Six-colour Fair Isle yoke' },
  { title: 'Chunky throw', note: 'Super chunky roving, 140 × 180 cm' },
  { title: 'Matching hat and mitten set', note: 'Made to order' },
  { title: 'Textured cushion collection', note: 'Cable, bobble and moss' },
  { title: 'Wedding shawl', note: 'Hand-spun silk blend' },
  { title: 'Baby layette', note: 'Cardigan, bonnet and booties' },
  { title: 'Fair Isle vest', note: 'Traditional Shetland palette' }
];

const DEFAULT_SETTINGS = {
  business_name: 'Belle Knits',
  tagline: 'Wool, knitting equipment and hand-knitted pieces',
  email: 'hello@belleknits.co.za',
  whatsapp: '27000000000',
  region: 'Western Cape, South Africa',
  free_shipping_over: '1500',
  quote_reply_days: '2'
};

// ---------------------------------------------------------------- schema

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id            SERIAL PRIMARY KEY,
      slug          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL CHECK (category IN ('wool', 'equipment', 'finished')),
      price         NUMERIC NOT NULL,
      unit          TEXT DEFAULT '',
      weight        TEXT DEFAULT '',
      fibre         TEXT DEFAULT '',
      metreage      TEXT DEFAULT '',
      colour        TEXT DEFAULT '',
      blurb         TEXT DEFAULT '',
      stock         TEXT NOT NULL DEFAULT 'in-stock'
                    CHECK (stock IN ('in-stock', 'low', 'out-of-stock', 'made-to-order')),
      image         TEXT,
      active        BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gallery (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      note          TEXT DEFAULT '',
      image         TEXT,
      active        BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id               SERIAL PRIMARY KEY,
      reference_number TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT DEFAULT '',
      town             TEXT DEFAULT '',
      item             TEXT DEFAULT '',
      size             TEXT DEFAULT '',
      colour           TEXT DEFAULT '',
      yarn             TEXT DEFAULT '',
      deadline         TEXT DEFAULT '',
      budget           TEXT DEFAULT '',
      project          TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'quoted', 'accepted', 'in-progress', 'complete', 'declined')),
      quoted_amount    NUMERIC,
      admin_notes      TEXT DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id               SERIAL PRIMARY KEY,
      reference_number TEXT UNIQUE NOT NULL,
      quote_id         INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
      name             TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT DEFAULT '',
      shipping_address TEXT DEFAULT '',
      items            JSONB NOT NULL DEFAULT '[]'::jsonb,
      total            NUMERIC NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'paid', 'knitting', 'shipped', 'delivered', 'cancelled')),
      admin_notes      TEXT DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Uploaded images live in Postgres, not on disk — Render's filesystem is
  // ephemeral, so anything written to disk disappears on the next deploy.
  await query(`
    CREATE TABLE IF NOT EXISTS files (
      id         TEXT PRIMARY KEY,
      filename   TEXT NOT NULL,
      mimetype   TEXT NOT NULL,
      data       BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS products_category_idx ON products (category) WHERE active');
  await query('CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status)');
  await query('CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)');

  await seed();
}

async function seed() {
  const { rows: [{ count: productCount }] } = await query('SELECT COUNT(*)::int AS count FROM products');
  if (productCount === 0) {
    for (const [i, p] of DEFAULT_PRODUCTS.entries()) {
      await query(
        `INSERT INTO products (slug, name, category, price, unit, weight, fibre, metreage, colour, blurb, stock, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [p.slug, p.name, p.category, p.price, p.unit || '', p.weight || '', p.fibre || '',
         p.metreage || '', p.colour || '', p.blurb, p.stock, i]
      );
    }
    console.log(`Seeded ${DEFAULT_PRODUCTS.length} products`);
  }

  const { rows: [{ count: galleryCount }] } = await query('SELECT COUNT(*)::int AS count FROM gallery');
  if (galleryCount === 0) {
    for (const [i, g] of DEFAULT_GALLERY.entries()) {
      await query('INSERT INTO gallery (title, note, display_order) VALUES ($1,$2,$3)', [g.title, g.note, i]);
    }
    console.log(`Seeded ${DEFAULT_GALLERY.length} gallery entries`);
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }
}

module.exports = { query, pool, initSchema };
