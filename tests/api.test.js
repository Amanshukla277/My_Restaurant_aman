const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
async function startApp() {
  const server = createServer(':memory:');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, body) {
    const response = await fetch(baseUrl + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }

  function stop() {
    server.close();
    server.closeAllConnections();
  }
  return { call, stop };
}

function appTest(name, testBody) {
  test(name, async () => {
    const app = await startApp();
    try {
      await testBody(app.call);
    } finally {
      app.stop();
    }
  });
}

async function newOrder(call, tableId = 1) {
  const response = await call('POST', '/api/orders', { order_type: 'dine_in', table_id: tableId });
  assert.equal(response.status, 201);
  return response.data.id;
}

function addItem(call, orderId, menuItemId, quantity = 1, note = '') {
  return call('POST', `/api/orders/${orderId}/items`, { menu_item_id: menuItemId, quantity, note });
}

appTest('order -> items -> bill', async (call) => {
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1, 2);
  await addItem(call, orderId, 1, 1); 

  const order = (await call('GET', `/api/orders/${orderId}`)).data;
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.totals.subtotal, 72000);

  const bill = await call('POST', `/api/orders/${orderId}/bill`, { payment_method: 'cash', amount_tendered_paise: 100000 });
  assert.equal(bill.status, 201);
  assert.equal(bill.data.total, 75600); 
  assert.equal(bill.data.change_due, 24400);
  assert.equal(bill.data.bill_no, 'INV-00001');
});

appTest('discount is applied on the bill total', async (call) => {
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1, 2); 

  const bill = await call('POST', `/api/orders/${orderId}/bill`, {
    payment_method: 'upi', discount_type: 'percent', discount_value: 10,
  });
  assert.equal(bill.data.discount_amount, 5040);
  assert.equal(bill.data.total, 45400);
});

appTest('a table can have only one open order', async (call) => {
  await newOrder(call, 1);
  const second = await call('POST', '/api/orders', { order_type: 'dine_in', table_id: 1 });
  assert.equal(second.status, 409);
});

appTest('billed order cannot be changed', async (call) => {
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1);
  await call('POST', `/api/orders/${orderId}/bill`, { payment_method: 'card' });

  assert.equal((await addItem(call, orderId, 1)).status, 409);
  assert.equal((await call('POST', `/api/orders/${orderId}/cancel`, {})).status, 409);
});

appTest('bill needs items, and cash must cover the total', async (call) => {
  const orderId = await newOrder(call);
  const empty = await call('POST', `/api/orders/${orderId}/bill`, { payment_method: 'cash' });
  assert.equal(empty.status, 400);

  await addItem(call, orderId, 1);
  const tooLittle = await call('POST', `/api/orders/${orderId}/bill`, { payment_method: 'cash', amount_tendered_paise: 100 });
  assert.equal(tooLittle.status, 400);
});

appTest('unavailable item cannot be ordered', async (call) => {
  const orderId = await newOrder(call);
  await call('POST', '/api/menu-items/1/availability', { is_available: false });
  assert.equal((await addItem(call, orderId, 1)).status, 409);
});

appTest('quantity can be changed, 0 removes the line', async (call) => {
  const orderId = await newOrder(call);
  const lineId = (await addItem(call, orderId, 1)).data.items[0].id;

  const changed = await call('PATCH', `/api/orders/${orderId}/items/${lineId}`, { quantity: 5 });
  assert.equal(changed.data.items[0].quantity, 5);

  const removed = await call('PATCH', `/api/orders/${orderId}/items/${lineId}`, { quantity: 0 });
  assert.equal(removed.data.items.length, 0);
});

appTest('order can be moved to a free table', async (call) => {
  const orderId = await newOrder(call, 1);
  await newOrder(call, 2);

  assert.equal((await call('POST', `/api/orders/${orderId}/move`, { table_id: 2 })).status, 409);
  const moved = await call('POST', `/api/orders/${orderId}/move`, { table_id: 3 });
  assert.equal(moved.data.table_name, 'T3');
});

appTest('old orders keep their price when the menu price changes', async (call) => {
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1);

  await call('PUT', '/api/menu-items/1', { name: 'Paneer Tikka', category_id: 1, price_paise: 99900, is_veg: true });
  const order = (await call('GET', `/api/orders/${orderId}`)).data;
  assert.equal(order.items[0].unit_price_paise, 24000);
});

appTest('menu: duplicate names are not allowed, categories with items cannot be deleted', async (call) => {
  const duplicate = await call('POST', '/api/menu-items', { name: 'paneer tikka', category_id: 1, price_paise: 100 });
  assert.equal(duplicate.status, 409);
  assert.equal((await call('DELETE', '/api/categories/1')).status, 409);
});

appTest('daily report and bill history', async (call) => {
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1, 2);
  await call('POST', `/api/orders/${orderId}/bill`, { payment_method: 'upi' });

  const cancelId = await newOrder(call, 2);
  await call('POST', `/api/orders/${cancelId}/cancel`, { reason: 'customer left' });

  const report = (await call('GET', '/api/reports/daily')).data;
  assert.equal(report.totals.bills, 1);
  assert.equal(report.totals.total, 50400);
  assert.equal(report.cancelled_orders, 1);
  assert.equal(report.top_items[0].quantity, 2);

  const bills = (await call('GET', '/api/bills?q=INV-00001')).data.bills;
  assert.equal(bills.length, 1);
});

appTest('settings: GST change is used for new bills', async (call) => {
  await call('PUT', '/api/settings', { restaurant_name: 'Test', address: '', gstin: '', tax_percent: 18, service_percent: 0 });
  const orderId = await newOrder(call);
  await addItem(call, orderId, 1);
  const order = (await call('GET', `/api/orders/${orderId}`)).data;
  assert.equal(order.totals.tax_amount, 4320);
});

appTest('bad requests give clear errors', async (call) => {
  assert.equal((await call('POST', '/api/orders', { order_type: 'delivery' })).status, 400);
  assert.equal((await call('POST', '/api/orders', { order_type: 'dine_in', table_id: 999 })).status, 404);
  assert.equal((await call('GET', '/api/nothing-here')).status, 404);
  assert.equal((await call('PUT', '/api/settings', { restaurant_name: '', tax_percent: 5, service_percent: 0 })).status, 400);
});
