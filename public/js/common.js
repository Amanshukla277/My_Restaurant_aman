const state = {
  menu: [],            
  tables: [],
  takeaways: [],       
  settings: {},
  order: null,         
  draft: null,         
  discountType: '',   
  discountValue: '',
  category: 'all',    
  search: '',
};


const actions = {};
const forms = {};

function $(selector) {
  return document.querySelector(selector);
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(paise) {
  const rupees = (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '₹' + rupees;
}


function rupeesToPaise(text) {
  const rupees = parseFloat(text);
  if (Number.isNaN(rupees)) return NaN;
  return Math.round(rupees * 100);
}

function todayDate() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}


async function api(url, method = 'GET', body = undefined) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch('/api' + url, options);
  } catch (error) {
    throw new Error('Cannot reach the server. Is it running?');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}


function showMessage(text, isError = false) {
  const box = document.createElement('div');
  box.className = isError ? 'toast error' : 'toast';
  box.textContent = text;
  $('#toasts').appendChild(box);
  setTimeout(() => box.remove(), isError ? 4500 : 2200);
}

function openModal(html) {
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">${html}</div>
    </div>`;

  const firstField = $('#modal-root input:not([type=radio]), #modal-root select');
  if (firstField) firstField.focus();
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}
