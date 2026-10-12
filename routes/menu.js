const { HttpError } = require('../errors');
const { inTransaction } = require('../db');
const check = require('../check');

function itemToJson(row) {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    price_paise: row.price_paise,
    is_veg: row.is_veg === 1,
    is_available: row.is_available === 1,
  };
}

function findItem(db, id) {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_active = 1').get(id);
  if (!item) throw new HttpError('Menu item not found.', 404);
  return item;
}

function checkCategoryExists(db, id) {
  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND is_active = 1').get(id);
  if (!category) throw new HttpError('Category not found.', 404);
}

function checkNameIsFree(db, categoryId, name, ignoreItemId = 0) {
  const same = db.prepare(
    `SELECT id FROM menu_items
     WHERE category_id = ? AND is_active = 1 AND lower(name) = lower(?) AND id != ?`
  ).get(categoryId, name, ignoreItemId);
  if (same) throw new HttpError('An item with this name already exists in the category.', 409);
}


function readItemForm(body) {
  const data = check.bodyObject(body);
  return {
    name: check.text(data.name, 'Name', { max: 80 }),
    categoryId: check.whole(data.category_id, 'Category', { min: 1 }),
    price: check.whole(data.price_paise, 'Price', { max: 10000000 }),
    isVeg: check.bool(data.is_veg, 'is_veg', true),
  };
}

function getMenu({ db }) {
  const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name').all();
  const items = db.prepare('SELECT * FROM menu_items WHERE is_active = 1 ORDER BY name').all();

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      items: items.filter((item) => item.category_id === category.id).map(itemToJson),
    })),
  };
}

function addCategory({ db, body }) {
  const name = check.text(check.bodyObject(body).name, 'Category name', { max: 60 });

  const id = inTransaction(db, () => {
    const old = db.prepare('SELECT id, is_active FROM categories WHERE lower(name) = lower(?)').get(name);
    if (old && old.is_active) throw new HttpError('Category already exists.', 409);

    const last = db.prepare('SELECT MAX(sort_order) AS last FROM categories').get().last || 0;
    if (old) {
      db.prepare('UPDATE categories SET is_active = 1, sort_order = ? WHERE id = ?').run(last + 1, old.id);
      return old.id;
    }
    const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, last + 1);
    return Number(result.lastInsertRowid);
  });

  return { id, name };
}

function deleteCategory({ db, params }) {
  checkCategoryExists(db, params.id);
  const items = db.prepare('SELECT id FROM menu_items WHERE category_id = ? AND is_active = 1').get(params.id);
  if (items) throw new HttpError('Remove or move the items in this category first.', 409);
  db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(params.id);
  return { ok: true };
}

function addItem({ db, body }) {
  const form = readItemForm(body);
  checkCategoryExists(db, form.categoryId);
  checkNameIsFree(db, form.categoryId, form.name);

  const result = db.prepare(
    'INSERT INTO menu_items (category_id, name, price_paise, is_veg) VALUES (?, ?, ?, ?)'
  ).run(form.categoryId, form.name, form.price, form.isVeg ? 1 : 0);
  return itemToJson(findItem(db, Number(result.lastInsertRowid)));
}

function editItem({ db, params, body }) {
  const form = readItemForm(body);
  findItem(db, params.id);
  checkCategoryExists(db, form.categoryId);
  checkNameIsFree(db, form.categoryId, form.name, params.id);

  db.prepare('UPDATE menu_items SET name = ?, category_id = ?, price_paise = ?, is_veg = ? WHERE id = ?')
    .run(form.name, form.categoryId, form.price, form.isVeg ? 1 : 0, params.id);
  return itemToJson(findItem(db, params.id));
}

function setAvailability({ db, params, body }) {
  const available = check.bool(check.bodyObject(body).is_available, 'is_available');
  findItem(db, params.id);

  db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?').run(available ? 1 : 0, params.id);
  return itemToJson(findItem(db, params.id));
}

function deleteItem({ db, params }) {
  findItem(db, params.id);
  db.prepare('UPDATE menu_items SET is_active = 0 WHERE id = ?').run(params.id);
  return { ok: true };
}

module.exports = [
  { method: 'GET', path: '/api/menu', handler: getMenu },
  { method: 'POST', path: '/api/categories', status: 201, handler: addCategory },
  { method: 'DELETE', path: '/api/categories/:id', handler: deleteCategory },
  { method: 'POST', path: '/api/menu-items', status: 201, handler: addItem },
  { method: 'PUT', path: '/api/menu-items/:id', handler: editItem },
  { method: 'POST', path: '/api/menu-items/:id/availability', handler: setAvailability },
  { method: 'DELETE', path: '/api/menu-items/:id', handler: deleteItem },
];
