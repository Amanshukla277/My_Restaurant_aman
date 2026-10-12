function reportTable(rows, columns, headings) {
  if (rows.length === 0) return '<div class="muted">No data.</div>';

  let head = '';
  headings.forEach((heading, index) => {
    head += `<th class="${index > 0 ? 'num' : ''}">${heading}</th>`;
  });

  let body = '';
  for (const row of rows) {
    body += '<tr>';
    for (const column of columns) {
      const value = row[column];
      if (column === 'total' || column === 'revenue') body += `<td class="num">${money(value)}</td>`;
      else if (typeof value === 'number') body += `<td class="num">${value}</td>`;
      else body += `<td>${escapeHtml(column === 'method' ? value.toUpperCase() : value)}</td>`;
    }
    body += '</tr>';
  }
  return `<table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function reportCard(label, value) {
  return `<div class="card"><div class="muted">${label}</div><div class="v">${value}</div></div>`;
}

async function showReportsScreen() {
  const dateBox = $('#report-date');
  const date = dateBox ? dateBox.value : todayDate();
  const report = await api('/reports/daily?date=' + date);
  const totals = report.totals;

  const orderTypes = report.by_type.map((row) => ({
    ...row,
    type: row.type === 'dine_in' ? 'Dine-in' : 'Takeaway',
  }));

  $('#view-reports').innerHTML = `
    <div class="toolbar">
      <h2 class="grow" style="margin:0">Daily report</h2>
      <input id="report-date" type="date" value="${report.date}">
    </div>
    <div class="cards">
      ${reportCard('Sales', money(totals.total))}
      ${reportCard('Bills', totals.bills)}
      ${reportCard('Average bill', money(totals.average_bill))}
      ${reportCard('Discounts given', money(totals.discount))}
      ${reportCard('GST collected', money(totals.tax))}
      ${reportCard('Cancelled orders', report.cancelled_orders)}
    </div>
    <div class="two">
      <div>
        <h3>By payment method</h3>
        ${reportTable(report.by_payment, ['method', 'bills', 'total'], ['Method', 'Bills', 'Amount'])}
        <h3 style="margin-top:16px">By order type</h3>
        ${reportTable(orderTypes, ['type', 'bills', 'total'], ['Type', 'Bills', 'Amount'])}
      </div>
      <div>
        <h3>Top selling items</h3>
        ${reportTable(report.top_items, ['name', 'quantity', 'revenue'], ['Item', 'Qty', 'Revenue'])}
      </div>
    </div>`;
}
