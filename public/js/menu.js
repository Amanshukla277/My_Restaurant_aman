async function showMenuScreen() {
  await loadMenu();

  let html = `
    <div class="toolbar">
      <h2 class="grow" style="margin:0">Menu</h2>
      <input id="new-category" placeholder="New category name">
      <button class="btn" data-action="addCategory">Add category</button>
      <button class="btn primary" data-action="itemForm">+ Add item</button>
    </div>`;

  for (const category of state.menu) {
    let rows = '';
    for (const item of category.items) {
      rows += `
        <tr>
          <td><span class="dot${item.is_veg ? '' : ' nonveg'}"></span>${escapeHtml(item.name)}</td>
          <td class="num">${money(item.price_paise)}</td>
          <td>
            <label class="inline" style="margin:0">
              <input type="checkbox" data-action="setAvailable" data-id="${item.id}" ${item.is_available ? 'checked' : ''}> Available
            </label>
          </td>
          <td class="num">
            <button class="btn small" data-action="itemForm" data-id="${item.id}">Edit</button>
            <button class="btn small danger" data-action="deleteItem" data-id="${item.id}">Delete</button>
          </td>
        </tr>`;
    }
    if (rows === '') rows = '<tr><td class="muted">No items</td></tr>';

    html += `
      <div class="cat-head">
        <span>${escapeHtml(category.name)} <span class="badge">${category.items.length}</span></span>
        <button class="btn small danger" data-action="deleteCategory" data-id="${category.id}">Delete category</button>
      </div>
      <table class="grid"><tbody>${rows}</tbody></table>`;
  }
  if (state.menu.length === 0) html += '<div class="empty">Add a category to get started.</div>';

  $('#view-menu').innerHTML = html;
}

actions.addCategory = async () => {
  await api('/categories', 'POST', { name: $('#new-category').value });
  showMessage('Category added');
  await showMenuScreen();
};

actions.deleteCategory = async (button) => {
  if (!confirm('Delete this category?')) return;
  await api('/categories/' + button.dataset.id, 'DELETE');
  await showMenuScreen();
};

actions.deleteItem = async (button) => {
  if (!confirm('Delete this item? Old bills are not changed.')) return;
  await api('/menu-items/' + button.dataset.id, 'DELETE');
  await showMenuScreen();
};

actions.setAvailable = async (checkbox) => {
  try {
    await api(`/menu-items/${checkbox.dataset.id}/availability`, 'POST', { is_available: checkbox.checked });
  } catch (error) {
    checkbox.checked = !checkbox.checked; 
    throw error;
  }
};

actions.itemForm = (button) => {
  if (state.menu.length === 0) {
    showMessage('Create a category first.', true);
    return;
  }

  const id = Number(button.dataset.id);
  let item = null;
  for (const category of state.menu) {
    for (const dish of category.items) {
      if (dish.id === id) item = dish;
    }
  }

  let categoryOptions = '';
  for (const category of state.menu) {
    const selected = item && item.category_id === category.id ? 'selected' : '';
    categoryOptions += `<option value="${category.id}" ${selected}>${escapeHtml(category.name)}</option>`;
  }
  const isVeg = !item || item.is_veg;

  openModal(`
    <h2>${item ? 'Edit' : 'Add'} menu item</h2>
    <form data-form="item" data-id="${item ? item.id : ''}">
      <label>Name <input name="name" required maxlength="80" value="${item ? escapeHtml(item.name) : ''}"></label>
      <label>Category <select name="category_id">${categoryOptions}</select></label>
      <label>Price (₹) <input name="price" type="number" min="0" step="0.01" required value="${item ? item.price_paise / 100 : ''}"></label>
      <label class="inline"><input type="checkbox" name="is_veg" ${isVeg ? 'checked' : ''}> Vegetarian</label>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="closeModal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`);
};

forms.item = async (form) => {
  const price = rupeesToPaise(form.elements.price.value);
  if (Number.isNaN(price) || price < 0) throw new Error('Enter a valid price.');

  const body = {
    name: form.elements.name.value,
    category_id: Number(form.elements.category_id.value),
    price_paise: price,
    is_veg: form.elements.is_veg.checked,
  };

  const id = form.dataset.id;
  if (id) await api('/menu-items/' + id, 'PUT', body);
  else await api('/menu-items', 'POST', body);

  closeModal();
  showMessage('Saved');
  await showMenuScreen();
};
