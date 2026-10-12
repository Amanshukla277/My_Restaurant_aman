

async function loadTables() {
  const tableData = await api('/tables');
  const orderData = await api('/orders');
  state.tables = tableData.tables;
  state.takeaways = orderData.orders.filter((order) => order.order_type === 'takeaway');
  drawTables();
}

async function loadMenu() {
  const data = await api('/menu');
  state.menu = data.categories;
}

function resetDiscount() {
  state.discountType = '';
  state.discountValue = '';
}



function drawTables() {
 
  let selectedTableId = null;
  if (state.order) selectedTableId = state.order.table_id;
  else if (state.draft) selectedTableId = state.draft.table_id;

  let html = '';
  for (const table of state.tables) {
    const classes = 'table' + (table.occupied ? ' busy' : '') + (table.id === selectedTableId ? ' sel' : '');
    const info = table.occupied ? money(table.running_total) : `Free · ${table.capacity} seats`;
    html += `
      <button class="${classes}" data-action="selectTable" data-id="${table.id}">
        <b>${escapeHtml(table.name)}</b>
        <small>${info}</small>
      </button>`;
  }
  $('#tables').innerHTML = html || '<div class="muted">No tables. Add them in Settings.</div>';

  html = '';
  for (const order of state.takeaways) {
    const selected = state.order && state.order.id === order.id;
    html += `
      <button class="table busy${selected ? ' sel' : ''}" data-action="selectTakeaway" data-id="${order.id}">
        <b>#${order.id} ${escapeHtml(order.customer_name || 'Takeaway')}</b>
        <small>${money(order.totals.subtotal)}</small>
      </button>`;
  }
  $('#takeaways').innerHTML = html;
}

actions.selectTable = (button) => {
  const table = state.tables.find((t) => t.id === Number(button.dataset.id));
  resetDiscount();


  if (table.order_id) return openOrder(table.order_id);


  state.order = null;
  state.draft = { order_type: 'dine_in', table_id: table.id, customer_name: '', label: 'Table ' + table.name };
  drawTables();
  drawOrder();
};

actions.newTakeaway = () => {
  resetDiscount();
  state.order = null;
  state.draft = { order_type: 'takeaway', table_id: null, customer_name: '', label: 'New takeaway' };
  drawTables();
  drawOrder();
};

actions.selectTakeaway = (button) => openOrder(Number(button.dataset.id));

async function openOrder(orderId) {
  if (!state.order || state.order.id !== orderId) resetDiscount();
  state.draft = null;
  await reloadOrder(orderId);
}


async function reloadOrder(orderId = state.order.id) {
  let url = '/orders/' + orderId;
  if (state.discountType && state.discountValue !== '') {
    let value = state.discountValue;
    if (state.discountType === 'flat') value = rupeesToPaise(value); 
    url += `?discount_type=${state.discountType}&discount_value=${value}`;
  }

  try {
    state.order = await api(url);
  } catch (error) {
    if (!state.discountType) throw error;
   
    showMessage(error.message, true);
    resetDiscount();
    state.order = await api('/orders/' + orderId);
  }

  if (state.order.status !== 'open') {
    showMessage(`This order is already ${state.order.status}.`, true);
    state.order = null;
  }
  await loadTables();
  drawOrder();
}



function visibleDishes() {
  const search = state.search.trim().toLowerCase();
  const dishes = [];
  for (const category of state.menu) {
    if (state.category !== 'all' && String(category.id) !== String(state.category)) continue;
    for (const item of category.items) {
      if (search === '' || item.name.toLowerCase().includes(search)) dishes.push(item);
    }
  }
  return dishes;
}

function drawMenu() {
  let chips = '';
  const categories = [{ id: 'all', name: 'All' }, ...state.menu];
  for (const category of categories) {
    const active = String(category.id) === String(state.category) ? ' active' : '';
    chips += `<button class="chip${active}" data-action="selectCategory" data-id="${category.id}">${escapeHtml(category.name)}</button>`;
  }
  $('#categories').innerHTML = chips;

  let dishes = '';
  for (const item of visibleDishes()) {
    dishes += `
      <button class="dish${item.is_available ? '' : ' off'}" data-action="addDish" data-id="${item.id}" ${item.is_available ? '' : 'disabled'}>
        <span class="nm"><span class="dot${item.is_veg ? '' : ' nonveg'}"></span>${escapeHtml(item.name)}</span>
        <span class="muted">${item.is_available ? money(item.price_paise) : 'Unavailable'}</span>
      </button>`;
  }
  $('#dishes').innerHTML = dishes || '<div class="empty">No items found.</div>';
}

actions.selectCategory = (button) => {
  state.category = button.dataset.id;
  drawMenu();
};

actions.addDish = (button) => addDish(Number(button.dataset.id));

async function addDish(menuItemId) {
  if (!state.order && !state.draft) {
    showMessage('Select a table or start a takeaway first.', true);
    return;
  }

  
  if (!state.order) {
    const draft = state.draft;
    state.order = await api('/orders', 'POST', {
      order_type: draft.order_type,
      table_id: draft.table_id,
      customer_name: draft.customer_name,
    });
    state.draft = null;
  }

  await api(`/orders/${state.order.id}/items`, 'POST', { menu_item_id: menuItemId, quantity: 1 });
  await reloadOrder();
}


function emptyTotals() {
  return {
    subtotal: 0, service_percent: 0, service_amount: 0,
    tax_percent: state.settings.tax_percent || 0, tax_amount: 0,
    gross_total: 0, discount_type: null, discount_value: 0, discount_amount: 0,
    round_off: 0, total: 0,
  };
}

function plusMinus(paise) {
  return (paise > 0 ? '+' : '−') + money(Math.abs(paise));
}


function totalsHtml(t, subtotalLabel, totalLabel) {
  let html = `<div><span>${subtotalLabel}</span><span>${money(t.subtotal)}</span></div>`;

  if (t.service_amount) {
    html += `<div><span>Service charge (${t.service_percent}%)</span><span>${money(t.service_amount)}</span></div>`;
  }
  html += `<div><span>GST (${t.tax_percent}%)</span><span>${money(t.tax_amount)}</span></div>`;

  if (t.discount_amount) {
    const percentText = t.discount_type === 'percent' ? ` (${t.discount_value}%)` : '';
    html += `<div class="sub"><span>Bill total</span><span>${money(t.gross_total)}</span></div>`;
    html += `<div class="disc"><span>Discount${percentText}</span><span>− ${money(t.discount_amount)}</span></div>`;
  }
  if (t.round_off) {
    html += `<div><span>Round off</span><span>${plusMinus(t.round_off)}</span></div>`;
  }
  html += `<div class="grand"><span>${totalLabel}</span><span>${money(t.total)}</span></div>`;
  return html;
}

function orderLineHtml(item) {
  const noteText = item.note ? '📝 ' + escapeHtml(item.note) : '+ add note';
  return `
    <div class="line">
      <div>
        ${escapeHtml(item.name)}
        <div class="note" data-action="editNote" data-line="${item.id}" data-note="${escapeHtml(item.note)}">${noteText}</div>
      </div>
      <div class="qty">
        <button data-action="changeQuantity" data-line="${item.id}" data-qty="${item.quantity}" data-change="-1">−</button>
        <b>${item.quantity}</b>
        <button data-action="changeQuantity" data-line="${item.id}" data-qty="${item.quantity}" data-change="1">+</button>
      </div>
      <div class="right">${money(item.line_total)}</div>
      <button class="x" title="Remove" data-action="removeLine" data-line="${item.id}">×</button>
    </div>`;
}

function drawOrder() {
  const pane = $('#order-pane');
  const order = state.order;
  const draft = state.draft;

  if (!order && !draft) {
    pane.innerHTML = '<div class="empty">Select a table or start a takeaway order to begin.</div>';
    return;
  }

  const items = order ? order.items : [];
  const totals = order ? order.totals : emptyTotals();

  let title = draft ? draft.label : 'Table ' + order.table_name;
  if (order && order.order_type === 'takeaway') {
    title = 'Takeaway' + (order.customer_name ? ' · ' + order.customer_name : '');
  }
  const orderLabel = order ? 'Order #' + order.id : 'New';

  let customerBox = '';
  if (!order && draft.order_type === 'takeaway') {
    customerBox = `<input id="customer" placeholder="Customer name (optional)" value="${escapeHtml(draft.customer_name)}" style="margin-bottom:8px">`;
  }

  let lines = '';
  for (const item of items) lines += orderLineHtml(item);
  if (lines === '') lines = '<div class="empty">Tap menu items to add them.</div>';

  let discountBox = '';
  if (items.length > 0) {
    discountBox = `
      <div class="discount">
        <select id="discount-type">
          <option value="">No discount</option>
          <option value="percent" ${state.discountType === 'percent' ? 'selected' : ''}>Discount %</option>
          <option value="flat" ${state.discountType === 'flat' ? 'selected' : ''}>Discount ₹</option>
        </select>
        <input id="discount-value" type="number" min="0" step="any" placeholder="Value"
               value="${escapeHtml(state.discountValue)}" ${state.discountType ? '' : 'disabled'}>
      </div>`;
  }

  let buttons = '';
  if (order) buttons += '<button class="btn danger" data-action="cancelOrder">Cancel</button>';
  if (order && order.order_type === 'dine_in') buttons += '<button class="btn" data-action="moveDialog">Move</button>';
  buttons += `<button class="btn primary" data-action="billDialog" ${items.length ? '' : 'disabled'}>Generate Bill</button>`;

  pane.innerHTML = `
    <div class="order-head"><b>${escapeHtml(title)}</b><span class="muted">${orderLabel}</span></div>
    ${customerBox}
    <div class="lines">${lines}</div>
    ${discountBox}
    <div class="totals">${totalsHtml(totals, 'Subtotal', 'Total')}</div>
    <div class="actions">${buttons}</div>`;
}



actions.changeQuantity = async (button) => {
  const newQuantity = Number(button.dataset.qty) + Number(button.dataset.change);
  await api(`/orders/${state.order.id}/items/${button.dataset.line}`, 'PATCH', { quantity: newQuantity });
  await reloadOrder();
};

actions.removeLine = async (button) => {
  await api(`/orders/${state.order.id}/items/${button.dataset.line}`, 'DELETE');
  await reloadOrder();
};

actions.editNote = async (element) => {
  const note = prompt('Note for the kitchen (for example: less spicy)', element.dataset.note);
  if (note === null) return; 
  await api(`/orders/${state.order.id}/items/${element.dataset.line}`, 'PATCH', { note: note.trim() });
  await reloadOrder();
};

actions.cancelOrder = async () => {
  if (!confirm('Cancel this order? The items will be discarded.')) return;
  const reason = prompt('Reason (optional)', '') || '';

  await api(`/orders/${state.order.id}/cancel`, 'POST', { reason });
  showMessage('Order cancelled');
  state.order = null;
  state.draft = null;
  resetDiscount();
  await loadTables();
  drawOrder();
};

actions.moveDialog = () => {
  const freeTables = state.tables.filter((table) => !table.occupied);
  if (freeTables.length === 0) {
    showMessage('No free tables available.', true);
    return;
  }

  let options = '';
  for (const table of freeTables) {
    options += `<option value="${table.id}">${escapeHtml(table.name)} (${table.capacity} seats)</option>`;
  }
  openModal(`
    <h2>Move to another table</h2>
    <form data-form="move">
      <label>New table <select name="table_id">${options}</select></label>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="closeModal">Cancel</button>
        <button class="btn primary">Move</button>
      </div>
    </form>`);
};

forms.move = async (form) => {
  state.order = await api(`/orders/${state.order.id}/move`, 'POST', { table_id: Number(form.elements.table_id.value) });
  closeModal();
  showMessage('Order moved');
  await reloadOrder();
};


actions.billDialog = () => {
  const order = state.order;
  const place = order.order_type === 'dine_in' ? 'Table ' + order.table_name : 'Takeaway #' + order.id;

  openModal(`
    <h2>Bill for ${escapeHtml(place)}</h2>
    <div class="totals">${totalsHtml(order.totals, `Items (${order.item_count})`, 'Payable')}</div>
    <form data-form="bill" style="margin-top:14px">
      <div class="pay-methods">
        <label><input type="radio" name="method" value="cash" checked><span>Cash</span></label>
        <label><input type="radio" name="method" value="upi"><span>UPI</span></label>
        <label><input type="radio" name="method" value="card"><span>Card</span></label>
      </div>
      <div id="cash-box">
        <label>Cash received (₹)
          <input name="received" id="received" type="number" min="0" step="any" value="${order.totals.total / 100}">
        </label>
        <div class="change" id="change"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="closeModal">Back</button>
        <button class="btn primary">Confirm payment</button>
      </div>
    </form>`);
  showChange();
};

function showChange() {
  const box = $('#change');
  if (!box) return;

  const difference = rupeesToPaise($('#received').value) - state.order.totals.total;
  if (Number.isNaN(difference)) {
    box.textContent = '';
  } else if (difference >= 0) {
    box.textContent = 'Change to return: ' + money(difference);
    box.style.color = 'var(--ok)';
  } else {
    box.textContent = 'Short by ' + money(-difference);
    box.style.color = 'var(--bad)';
  }
}

forms.bill = async (form) => {
  const method = form.elements.method.value;

  const body = { payment_method: method };
  if (state.discountType) {
    body.discount_type = state.discountType;
    body.discount_value = state.discountType === 'flat' ? rupeesToPaise(state.discountValue) : Number(state.discountValue);
  }
  if (method === 'cash') {
    const received = rupeesToPaise(form.elements.received.value);
    if (Number.isNaN(received)) throw new Error('Enter the cash received.');
    body.amount_tendered_paise = received;
  }

  const bill = await api(`/orders/${state.order.id}/bill`, 'POST', body);

  state.order = null;
  state.draft = null;
  resetDiscount();
  await loadTables();
  drawOrder();
  showReceipt(bill);
};



function receiptHtml(bill) {
  const shop = bill.restaurant;
  const place = bill.order_type === 'dine_in' ? 'Table ' + bill.table_name : 'Takeaway';

  let rows = '';
  for (const item of bill.items) {
    const note = item.note ? `<br><small>(${escapeHtml(item.note)})</small>` : '';
    rows += `
      <tr>
        <td>${escapeHtml(item.name)}${note}</td>
        <td align="center">${item.quantity}</td>
        <td align="right">${(item.unit_price_paise / 100).toFixed(2)}</td>
        <td align="right">${(item.line_total / 100).toFixed(2)}</td>
      </tr>`;
  }

  let amounts = `<div class="row"><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>`;
  if (bill.service_amount) {
    amounts += `<div class="row"><span>Service charge (${bill.service_percent}%)</span><span>${money(bill.service_amount)}</span></div>`;
  }
  amounts += `<div class="row"><span>GST (${bill.tax_percent}%)</span><span>${money(bill.tax_amount)}</span></div>`;
  if (bill.discount_amount) {
    const percentText = bill.discount_type === 'percent' ? ` (${bill.discount_value}%)` : '';
    amounts += `<div class="row"><span>Bill total</span><span>${money(bill.gross_total)}</span></div>`;
    amounts += `<div class="row"><span>Discount${percentText}</span><span>− ${money(bill.discount_amount)}</span></div>`;
  }
  if (bill.round_off) {
    amounts += `<div class="row"><span>Round off</span><span>${plusMinus(bill.round_off)}</span></div>`;
  }

  let change = '';
  if (bill.payment_method === 'cash' && bill.change_due > 0) {
    change = `<div class="row"><span>Change</span><span>${money(bill.change_due)}</span></div>`;
  }

  return `
    <div class="receipt">
      <h2>${escapeHtml(shop.restaurant_name)}</h2>
      <div class="c">${escapeHtml(shop.address)}</div>
      ${shop.gstin ? `<div class="c">GSTIN: ${escapeHtml(shop.gstin)}</div>` : ''}
      <hr>
      <div class="row"><span>Bill: ${bill.bill_no}</span><span>${escapeHtml(place)}</span></div>
      <div>${escapeHtml(bill.created_at)}</div>
      ${bill.customer_name ? `<div>Customer: ${escapeHtml(bill.customer_name)}</div>` : ''}
      <hr>
      <table>
        <tr><th align="left">Item</th><th>Qty</th><th align="right">Rate</th><th align="right">Amt</th></tr>
        ${rows}
      </table>
      <hr>
      ${amounts}
      <hr>
      <div class="row big"><span>TOTAL</span><span>${money(bill.total)}</span></div>
      <hr>
      <div class="row"><span>Paid by ${bill.payment_method.toUpperCase()}</span><span>${money(bill.amount_tendered)}</span></div>
      ${change}
      <hr>
      <div class="c">Thank you! Visit again.</div>
    </div>`;
}

function showReceipt(bill) {
  openModal(`
    ${receiptHtml(bill)}
    <div class="modal-actions no-print">
      <button class="btn" data-action="closeModal">Close</button>
      <button class="btn primary" data-action="printReceipt">Print</button>
    </div>`);
}

actions.closeModal = closeModal;
actions.printReceipt = () => window.print();


async function showBillingScreen() {
  await loadMenu();
  await loadTables();
  drawMenu();
  drawOrder();
}
