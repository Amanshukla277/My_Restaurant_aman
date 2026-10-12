CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  name         TEXT NOT NULL,
  price_paise  INTEGER NOT NULL CHECK (price_paise >= 0),
  is_veg       INTEGER NOT NULL DEFAULT 1,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tables (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  capacity  INTEGER NOT NULL DEFAULT 4,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id      INTEGER REFERENCES tables(id),
  order_type    TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway')),
  customer_name TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'billed', 'cancelled')),
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  closed_at     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_order_per_table
  ON orders(table_id) WHERE status = 'open' AND table_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     INTEGER NOT NULL REFERENCES menu_items(id),
  name             TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  note             TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  subtotal        INTEGER NOT NULL,
  service_percent REAL NOT NULL DEFAULT 0,
  service_amount  INTEGER NOT NULL DEFAULT 0,
  tax_percent     REAL NOT NULL DEFAULT 0,
  tax_amount      INTEGER NOT NULL DEFAULT 0,
  gross_total     INTEGER NOT NULL,
  discount_type   TEXT CHECK (discount_type IN ('percent', 'flat')),
  discount_value  REAL NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  round_off       INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi')),
  amount_tendered INTEGER NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
