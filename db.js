const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const defaultSettings = {
  restaurant_name: 'My Restaurant',
  address: '12 Main Street, Your City',
  gstin: '',
  tax_percent: '5',
  service_percent: '0',
};


const sampleMenu = {
  Starters: [['Paneer Tikka', 24000, 1], ['Veg Spring Roll', 18000, 1], ['Chicken 65', 26000, 0], ['Tomato Soup', 12000, 1]],
  'Main Course': [['Paneer Butter Masala', 26000, 1], ['Dal Makhani', 22000, 1], ['Veg Biryani', 23000, 1], ['Butter Chicken', 32000, 0], ['Chicken Biryani', 30000, 0]],
  'Breads & Rice': [['Butter Naan', 5000, 1], ['Tandoori Roti', 3000, 1], ['Garlic Naan', 6500, 1], ['Jeera Rice', 14000, 1]],
  Beverages: [['Masala Chai', 4000, 1], ['Fresh Lime Soda', 6000, 1], ['Sweet Lassi', 8000, 1], ['Cold Coffee', 11000, 1]],
  Desserts: [['Gulab Jamun (2 pc)', 8000, 1], ['Brownie with Ice Cream', 15000, 1]],
};

const sampleTables = [['T1', 2], ['T2', 2], ['T3', 4], ['T4', 4], ['T5', 4], ['T6', 6], ['T7', 6], ['T8', 8]];

function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  addSampleData(db);
  return db;
}

function addSampleData(db) {
  const saveSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    saveSetting.run(key, value);
  }

  if (db.prepare('SELECT id FROM categories LIMIT 1').get()) return;

  const addCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  const addItem = db.prepare('INSERT INTO menu_items (category_id, name, price_paise, is_veg) VALUES (?, ?, ?, ?)');
  let position = 0;
  for (const [categoryName, items] of Object.entries(sampleMenu)) {
    position++;
    const categoryId = Number(addCategory.run(categoryName, position).lastInsertRowid);
    for (const [name, price, isVeg] of items) {
      addItem.run(categoryId, name, price, isVeg);
    }
  }

  const addTable = db.prepare('INSERT INTO tables (name, capacity) VALUES (?, ?)');
  for (const [name, capacity] of sampleTables) {
    addTable.run(name, capacity);
  }
}


function inTransaction(db, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function now() {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}

function today() {
  return now().slice(0, 10);
}

module.exports = { openDatabase, inTransaction, now, today };
