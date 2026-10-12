const { HttpError } = require('../errors');
const { inTransaction } = require('../db');
const check = require('../check');

function getTables({ db }) {
  // a table is "occupied" when it has an open order
  const rows = db.prepare(
    `SELECT tables.id, tables.name, tables.capacity, orders.id AS order_id,
            COALESCE((SELECT SUM(unit_price_paise * quantity)
                      FROM order_items WHERE order_id = orders.id), 0) AS running_total
     FROM tables
     LEFT JOIN orders ON orders.table_id = tables.id AND orders.status = 'open'
     WHERE tables.is_active = 1
     ORDER BY length(tables.name), tables.name`
  ).all();

  return {
    tables: rows.map((row) => ({
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      order_id: row.order_id,
      occupied: row.order_id !== null,
      running_total: row.order_id ? row.running_total : 0,
    })),
  };
}

function addTable({ db, body }) {
  const data = check.bodyObject(body);
  const name = check.text(data.name, 'Table name', { max: 30 });
  const capacity = check.whole(data.capacity, 'Seats', { required: false, min: 1, max: 50, fallback: 4 });

  const id = inTransaction(db, () => {
    const old = db.prepare('SELECT id, is_active FROM tables WHERE lower(name) = lower(?)').get(name);
    if (old && old.is_active) throw new HttpError('A table with this name already exists.', 409);

    // a removed table with the same name is switched back on
    if (old) {
      db.prepare('UPDATE tables SET is_active = 1, capacity = ? WHERE id = ?').run(capacity, old.id);
      return old.id;
    }
    const result = db.prepare('INSERT INTO tables (name, capacity) VALUES (?, ?)').run(name, capacity);
    return Number(result.lastInsertRowid);
  });

  return { id, name, capacity };
}

function removeTable({ db, params }) {
  const table = db.prepare('SELECT id FROM tables WHERE id = ? AND is_active = 1').get(params.id);
  if (!table) throw new HttpError('Table not found.', 404);

  const openOrder = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'open'").get(params.id);
  if (openOrder) throw new HttpError('This table has a running order.', 409);

  db.prepare('UPDATE tables SET is_active = 0 WHERE id = ?').run(params.id);
  return { ok: true };
}

module.exports = [
  { method: 'GET', path: '/api/tables', handler: getTables },
  { method: 'POST', path: '/api/tables', status: 201, handler: addTable },
  { method: 'DELETE', path: '/api/tables/:id', handler: removeTable },
];
