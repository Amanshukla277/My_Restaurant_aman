const check = require('../check');
const { getSettings } = require('../queries');

function readSettings({ db }) {
  return getSettings(db);
}

function saveSettings({ db, body }) {
  const data = check.bodyObject(body);
  const newValues = {
    restaurant_name: check.text(data.restaurant_name, 'Restaurant name', { max: 80 }),
    address: check.text(data.address, 'Address', { required: false, max: 160 }),
    gstin: check.text(data.gstin, 'GSTIN', { required: false, max: 20 }),
    tax_percent: String(check.decimal(data.tax_percent, 'GST %', { max: 50 })),
    service_percent: String(check.decimal(data.service_percent, 'Service charge %', { max: 30 })),
  };

  const save = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(newValues)) {
    save.run(key, value);
  }
  return getSettings(db);
}

module.exports = [
  { method: 'GET', path: '/api/settings', handler: readSettings },
  { method: 'PUT', path: '/api/settings', handler: saveSettings },
];
