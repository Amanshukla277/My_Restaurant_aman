const { HttpError } = require('../errors');
const { today } = require('../db');

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function dailyReport({ db, query }) {
  const day = query.get('date') || today();
  if (!isRealDate(day)) throw new HttpError('Date must be in YYYY-MM-DD format.');

  const totals = db.prepare(
    `SELECT COUNT(*) AS bills,
            COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(discount_amount), 0) AS discount,
            COALESCE(SUM(service_amount), 0) AS service,
            COALESCE(SUM(tax_amount), 0) AS tax,
            COALESCE(SUM(total), 0) AS total
     FROM bills
     WHERE substr(created_at, 1, 10) = ?`
  ).get(day);

  const byPayment = db.prepare(
    `SELECT payment_method AS method, COUNT(*) AS bills, SUM(total) AS total
     FROM bills
     WHERE substr(created_at, 1, 10) = ?
     GROUP BY payment_method
     ORDER BY total DESC`
  ).all(day);

  const byType = db.prepare(
    `SELECT orders.order_type AS type, COUNT(*) AS bills, SUM(bills.total) AS total
     FROM bills
     JOIN orders ON orders.id = bills.order_id
     WHERE substr(bills.created_at, 1, 10) = ?
     GROUP BY orders.order_type`
  ).all(day);

  const topItems = db.prepare(
    `SELECT order_items.name, SUM(order_items.quantity) AS quantity,
            SUM(order_items.quantity * order_items.unit_price_paise) AS revenue
     FROM bills
     JOIN order_items ON order_items.order_id = bills.order_id
     WHERE substr(bills.created_at, 1, 10) = ?
     GROUP BY order_items.name
     ORDER BY quantity DESC, revenue DESC
     LIMIT 10`
  ).all(day);

  const cancelled = db.prepare(
    "SELECT COUNT(*) AS count FROM orders WHERE status = 'cancelled' AND substr(closed_at, 1, 10) = ?"
  ).get(day).count;

  let averageBill = 0;
  if (totals.bills > 0) averageBill = Math.round(totals.total / totals.bills);

  // spread copies the rows into plain objects
  return {
    date: day,
    totals: { ...totals, average_bill: averageBill },
    cancelled_orders: cancelled,
    by_payment: byPayment.map((row) => ({ ...row })),
    by_type: byType.map((row) => ({ ...row })),
    top_items: topItems.map((row) => ({ ...row })),
  };
}

module.exports = [
  { method: 'GET', path: '/api/reports/daily', handler: dailyReport },
];
