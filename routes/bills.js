const { HttpError } = require('../errors');
const { inTransaction, now } = require('../db');
const check = require('../check');
const { findOpenOrder, getOrderItems, calculateOrderTotals, billSummary, billDetails, BILL_QUERY } = require('../queries');


function createBill({ db, params, body }) {
  const data = check.bodyObject(body);
  const discountType = check.oneOf(data.discount_type, 'discount_type', ['percent', 'flat'], { required: false });
  const discountValue = Number(data.discount_value || 0);
  const paymentMethod = check.oneOf(data.payment_method, 'payment_method', ['cash', 'card', 'upi']);
  const cashReceived = check.whole(data.amount_tendered_paise, 'Cash received', { required: false });

  const billId = inTransaction(db, () => {
    findOpenOrder(db, params.id);

    const items = getOrderItems(db, params.id);
    if (items.length === 0) throw new HttpError('Add at least one item before generating the bill.');

    
    const totals = calculateOrderTotals(db, items, discountType, discountValue);

    let amountTendered = totals.total;
    if (paymentMethod === 'cash' && cashReceived !== null) {
      amountTendered = cashReceived;
    }
    if (amountTendered < totals.total) {
      throw new HttpError('Cash received is less than the bill total.');
    }

    const result = db.prepare(
      `INSERT INTO bills (order_id, subtotal, service_percent, service_amount, tax_percent, tax_amount,
                          gross_total, discount_type, discount_value, discount_amount, round_off, total,
                          payment_method, amount_tendered, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      params.id, totals.subtotal, totals.service_percent, totals.service_amount,
      totals.tax_percent, totals.tax_amount, totals.gross_total,
      totals.discount_type, totals.discount_value, totals.discount_amount,
      totals.round_off, totals.total, paymentMethod, amountTendered, now()
    );

    db.prepare("UPDATE orders SET status = 'billed', closed_at = ? WHERE id = ?").run(now(), params.id);
    return Number(result.lastInsertRowid);
  });

  return billDetails(db, billId);
}


function listBills({ db, query }) {
  const date = (query.get('date') || '').trim();
  const search = (query.get('q') || '').trim();

  let sql = BILL_QUERY + ' WHERE 1 = 1';
  const values = [];

  if (date) {
    sql += ' AND substr(bills.created_at, 1, 10) = ?';
    values.push(date);
  }
  if (search) {
    sql += " AND (orders.customer_name LIKE ? OR tables.name LIKE ? OR ('INV-' || printf('%05d', bills.id)) LIKE ?)";
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY bills.id DESC LIMIT 300';

  return { bills: db.prepare(sql).all(...values).map(billSummary) };
}

function getBill({ db, params }) {
  return billDetails(db, params.id);
}

module.exports = [
  { method: 'POST', path: '/api/orders/:id/bill', status: 201, handler: createBill },
  { method: 'GET', path: '/api/bills', handler: listBills },
  { method: 'GET', path: '/api/bills/:id', handler: getBill },
];
