
async function showBillsScreen() {
 
  if (!$('#bill-date')) {
    $('#view-bills').innerHTML = `
      <div class="toolbar">
        <h2 class="grow" style="margin:0">Bills</h2>
        <input id="bill-date" type="date" value="${todayDate()}">
        <input id="bill-search" type="search" placeholder="Search bill no / table / customer">
        <button class="btn" data-action="allDates">All dates</button>
      </div>
      <div id="bill-list"></div>`;
  }

  let url = '/bills?date=' + encodeURIComponent($('#bill-date').value);
  const search = $('#bill-search').value.trim();
  if (search) url += '&q=' + encodeURIComponent(search);

  const data = await api(url);
  const bills = data.bills;

  if (bills.length === 0) {
    $('#bill-list').innerHTML = '<div class="empty">No bills found.</div>';
    return;
  }

  let rows = '';
  let sum = 0;
  for (const bill of bills) {
    sum += bill.total;
    const place = bill.order_type === 'dine_in' ? bill.table_name : 'Takeaway';
    rows += `
      <tr class="click" data-action="openBill" data-id="${bill.id}">
        <td>${bill.bill_no}</td>
        <td>${escapeHtml(bill.created_at)}</td>
        <td>${escapeHtml(place)}</td>
        <td>${escapeHtml(bill.customer_name)}</td>
        <td>${bill.payment_method.toUpperCase()}</td>
        <td class="num">${money(bill.total)}</td>
      </tr>`;
  }

  $('#bill-list').innerHTML = `
    <table class="grid">
      <thead>
        <tr><th>Bill</th><th>Time</th><th>Table / Type</th><th>Customer</th><th>Payment</th><th class="num">Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="5">${bills.length} bill(s)</th><th class="num">${money(sum)}</th></tr>
      </tfoot>
    </table>`;
}

actions.openBill = async (row) => {
  const bill = await api('/bills/' + row.dataset.id);
  showReceipt(bill);
};

actions.allDates = async () => {
  $('#bill-date').value = '';
  await showBillsScreen();
};
