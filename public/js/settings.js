async function loadSettings() {
  state.settings = await api('/settings');
  const name = state.settings.restaurant_name || 'Restaurant Billing';
  $('#brand').textContent = name;
  document.title = name;
}

async function showSettingsScreen() {
  await loadSettings();
  await loadTables();
  const s = state.settings;

  let tableRows = '';
  for (const table of state.tables) {
    tableRows += `
      <tr>
        <td>${escapeHtml(table.name)}</td>
        <td>${table.capacity} seats</td>
        <td class="num"><button class="btn small danger" data-action="removeTable" data-id="${table.id}">Remove</button></td>
      </tr>`;
  }

  $('#view-settings').innerHTML = `
    <h2 style="margin-top:0">Settings</h2>
    <div class="two">
      <form data-form="settings">
        <h3>Restaurant &amp; tax</h3>
        <label>Restaurant name <input name="restaurant_name" required value="${escapeHtml(s.restaurant_name)}"></label>
        <label>Address <input name="address" value="${escapeHtml(s.address)}"></label>
        <label>GSTIN <input name="gstin" value="${escapeHtml(s.gstin)}"></label>
        <label>GST % <input name="tax_percent" type="number" min="0" max="50" step="any" required value="${escapeHtml(s.tax_percent)}"></label>
        <label>Service charge % <input name="service_percent" type="number" min="0" max="30" step="any" required value="${escapeHtml(s.service_percent)}"></label>
        <button class="btn primary">Save settings</button>
      </form>

      <div>
        <h3>Tables</h3>
        <table class="grid"><tbody>${tableRows}</tbody></table>
        <form data-form="table" class="toolbar" style="margin-top:10px">
          <input name="name" placeholder="Name e.g. T9" required style="width:110px">
          <input name="capacity" type="number" min="1" placeholder="Seats" value="4" style="width:80px">
          <button class="btn">Add table</button>
        </form>
      </div>
    </div>`;
}

forms.settings = async (form) => {
  const f = form.elements;
  await api('/settings', 'PUT', {
    restaurant_name: f.restaurant_name.value,
    address: f.address.value,
    gstin: f.gstin.value,
    tax_percent: f.tax_percent.value,
    service_percent: f.service_percent.value,
  });
  await loadSettings();
  showMessage('Settings saved');
};

forms.table = async (form) => {
  await api('/tables', 'POST', {
    name: form.elements.name.value,
    capacity: form.elements.capacity.value || 4,
  });
  await showSettingsScreen();
  showMessage('Table added');
};

actions.removeTable = async (button) => {
  if (!confirm('Remove this table?')) return;
  await api('/tables/' + button.dataset.id, 'DELETE');
  await showSettingsScreen();
};
