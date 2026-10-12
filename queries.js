const { HttpError } = require('./errors');
const { calculateBill } = require('./calc');

function getSettings(db) {
  const settings = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    settings[row.key] = row.value;
  }
  return settings;
}

function findOrder(db, orderId) {
  const order = db.prepare(
    `SELECT orders.*, tables.name AS table_name
     FROM orders
     LEFT JOIN tables ON tables.id = orders.table_id
     WHERE orders.id = ?`
  ).get(orderId);
  if (!order) throw new HttpError('Order not found.', 404);
  return order;
}

// Returns the order only if it is still open (not billed or cancelled).
function findOpenOrder(db, orderId) {
  const order = findOrder(db, orderId);
  if (order.status !== 'open') {
    throw new HttpError(`This order is already ${order.status}.`, 409);
  }
  return order;
}

function getOrderItems(db, orderId) {
  const rows = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  return rows.map((row) => ({
    id: row.id,
    menu_item_id: row.menu_item_id,
    name: row.name,
    unit_price_paise: row.unit_price_paise,
    quantity: row.quantity,
    note: row.note,
    line_total: row.unit_price_paise * row.quantity,
  }));
}

function sumOf(items) {
  let subtotal = 0;
  for (const item of items) subtotal += item.line_total;
  return subtotal;
}

// Works out the bill amounts for an order using the current GST and service settings.
function calculateOrderTotals(db, items, discountType, discountValue) {
  const settings = getSettings(db);
  return calculateBill(
    sumOf(items),
    Number(settings.tax_percent),
    Number(settings.service_percent),
    discountType,
    discountValue
  );
}

// The order as it is sent to the browser: items plus live totals.
function orderDetails(db, order, discountType = null, discountValue = 0) {
  const items = getOrderItems(db, order.id);
  let itemCount = 0;
  for (const item of items) itemCount += item.quantity;

  return {
    id: order.id,
    table_id: order.table_id,
    table_name: order.table_name,
    order_type: order.order_type,
    customer_name: order.customer_name,
    status: order.status,
    created_at: order.created_at,
    items,
    item_count: itemCount,
    totals: calculateOrderTotals(db, items, discountType, discountValue),
  };
}

const BILL_QUERY = `
  SELECT bills.*, orders.order_type, orders.customer_name, orders.table_id, tables.name AS table_name
  FROM bills
  JOIN orders ON orders.id = bills.order_id
  LEFT JOIN tables ON tables.id = orders.table_id`;

function billNumber(id) {
  return 'INV-' + String(id).padStart(5, '0');
}

// short version, used in the bill list
function billSummary(row) {
  return {
    id: row.id,
    bill_no: billNumber(row.id),
    order_id: row.order_id,
    order_type: row.order_type,
    table_name: row.table_name,
    customer_name: row.customer_name,
    payment_method: row.payment_method,
    total: row.total,
    created_at: row.created_at,
  };
}

// full version, used for the receipt
function billDetails(db, billId) {
  const row = db.prepare(BILL_QUERY + ' WHERE bills.id = ?').get(billId);
  if (!row) throw new HttpError('Bill not found.', 404);
  return {
    ...billSummary(row),
    subtotal: row.subtotal,
    service_percent: row.service_percent,
    service_amount: row.service_amount,
    tax_percent: row.tax_percent,
    tax_amount: row.tax_amount,
    gross_total: row.gross_total,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    discount_amount: row.discount_amount,
    round_off: row.round_off,
    amount_tendered: row.amount_tendered,
    change_due: row.amount_tendered - row.total,
    items: getOrderItems(db, row.order_id),
    restaurant: getSettings(db),
  };
}

module.exports = {
  getSettings, findOrder, findOpenOrder, getOrderItems, calculateOrderTotals,
  orderDetails, billSummary, billDetails, BILL_QUERY,
};
