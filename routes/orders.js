const { HttpError } = require('../errors');
const { now } = require('../db');
const check = require('../check');
const { findOrder, findOpenOrder, getOrderItems, orderDetails } = require('../queries');

const MAX_QUANTITY = 99;
function isTableBusyError(error) {
  return String(error.message).includes('UNIQUE constraint failed');
}

function checkTableExists(db, tableId) {
  const table = db.prepare('SELECT id FROM tables WHERE id = ? AND is_active = 1').get(tableId);
  if (!table) throw new HttpError('Table not found.', 404);
}

function listOpenOrders({ db }) {
  const rows = db.prepare(
    `SELECT orders.*, tables.name AS table_name
     FROM orders
     LEFT JOIN tables ON tables.id = orders.table_id
     WHERE orders.status = 'open'
     ORDER BY orders.id`
  ).all();
  return { orders: rows.map((row) => orderDetails(db, row)) };
}

function createOrder({ db, body }) {
  const data = check.bodyObject(body);
  const orderType = check.oneOf(data.order_type, 'order_type', ['dine_in', 'takeaway']);
  const customerName = check.text(data.customer_name, 'Customer name', { required: false, max: 60 });

  let tableId = null;
  if (orderType === 'dine_in') {
    tableId = check.whole(data.table_id, 'Table', { min: 1 });
    checkTableExists(db, tableId);
  }

  try {
    const result = db.prepare(
      'INSERT INTO orders (table_id, order_type, customer_name, created_at) VALUES (?, ?, ?, ?)'
    ).run(tableId, orderType, customerName, now());
    return orderDetails(db, findOrder(db, Number(result.lastInsertRowid)));
  } catch (error) {
    if (isTableBusyError(error)) throw new HttpError('This table already has a running order.', 409);
    throw error;
  }
}

// The discount comes in the query string so the browser can preview the totals:
// GET /api/orders/5?discount_type=percent&discount_value=10
function getOrder({ db, params, query }) {
  const discountType = query.get('discount_type') || null;
  const discountValue = Number(query.get('discount_value') || 0);
  return orderDetails(db, findOrder(db, params.id), discountType, discountValue);
}

function addItem({ db, params, body }) {
  const data = check.bodyObject(body);
  const menuItemId = check.whole(data.menu_item_id, 'Menu item', { min: 1 });
  const quantity = check.whole(data.quantity, 'Quantity', { required: false, min: 1, max: MAX_QUANTITY, fallback: 1 });
  const note = check.text(data.note, 'Note', { required: false, max: 100 });

  findOpenOrder(db, params.id);

  const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_active = 1').get(menuItemId);
  if (!menuItem) throw new HttpError('Menu item not found.', 404);
  if (!menuItem.is_available) throw new HttpError(`${menuItem.name} is not available right now.`, 409);

  // if the same dish (with the same note) is already in the order, just increase the quantity
  const sameLine = db.prepare(
    'SELECT id, quantity FROM order_items WHERE order_id = ? AND menu_item_id = ? AND note = ?'
  ).get(params.id, menuItemId, note);

  if (sameLine) {
    const newQuantity = sameLine.quantity + quantity;
    if (newQuantity > MAX_QUANTITY) throw new HttpError(`Quantity cannot be more than ${MAX_QUANTITY}.`);
    db.prepare('UPDATE order_items SET quantity = ? WHERE id = ?').run(newQuantity, sameLine.id);
  } else {
    db.prepare(
      `INSERT INTO order_items (order_id, menu_item_id, name, unit_price_paise, quantity, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(params.id, menuItemId, menuItem.name, menuItem.price_paise, quantity, note);
  }

  return { items: getOrderItems(db, params.id) };
}

// change the quantity and/or note of one line. Quantity 0 removes the line.
function changeItem({ db, params, body }) {
  const data = check.bodyObject(body);
  findOpenOrder(db, params.id);

  const line = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(params.lineId, params.id);
  if (!line) throw new HttpError('Order line not found.', 404);

  const quantity = check.whole(data.quantity, 'Quantity', { required: false, min: 0, max: MAX_QUANTITY, fallback: line.quantity });
  const note = data.note === undefined ? line.note : check.text(data.note, 'Note', { required: false, max: 100 });

  if (quantity === 0) {
    db.prepare('DELETE FROM order_items WHERE id = ?').run(line.id);
  } else {
    db.prepare('UPDATE order_items SET quantity = ?, note = ? WHERE id = ?').run(quantity, note, line.id);
  }
  return { items: getOrderItems(db, params.id) };
}

function removeItem({ db, params }) {
  findOpenOrder(db, params.id);

  const result = db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(params.lineId, params.id);
  if (result.changes === 0) throw new HttpError('Order line not found.', 404);
  return { items: getOrderItems(db, params.id) };
}

function moveOrder({ db, params, body }) {
  const tableId = check.whole(check.bodyObject(body).table_id, 'Table', { min: 1 });
  const order = findOpenOrder(db, params.id);
  if (order.order_type !== 'dine_in') throw new HttpError('Only dine-in orders can be moved to a table.');
  checkTableExists(db, tableId);

  try {
    db.prepare('UPDATE orders SET table_id = ? WHERE id = ?').run(tableId, params.id);
  } catch (error) {
    if (isTableBusyError(error)) throw new HttpError('That table already has a running order.', 409);
    throw error;
  }
  return orderDetails(db, findOrder(db, params.id));
}

function cancelOrder({ db, params, body }) {
  const data = body === null ? {} : check.bodyObject(body);
  const reason = check.text(data.reason, 'Reason', { required: false, max: 120 });
  findOpenOrder(db, params.id);

  db.prepare("UPDATE orders SET status = 'cancelled', cancel_reason = ?, closed_at = ? WHERE id = ?")
    .run(reason, now(), params.id);
  return { ok: true };
}

module.exports = [
  { method: 'GET', path: '/api/orders', handler: listOpenOrders },
  { method: 'POST', path: '/api/orders', status: 201, handler: createOrder },
  { method: 'GET', path: '/api/orders/:id', handler: getOrder },
  { method: 'POST', path: '/api/orders/:id/items', status: 201, handler: addItem },
  { method: 'PATCH', path: '/api/orders/:id/items/:lineId', handler: changeItem },
  { method: 'DELETE', path: '/api/orders/:id/items/:lineId', handler: removeItem },
  { method: 'POST', path: '/api/orders/:id/move', handler: moveOrder },
  { method: 'POST', path: '/api/orders/:id/cancel', handler: cancelOrder },
];
