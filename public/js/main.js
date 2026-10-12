const screens = {
  billing: showBillingScreen,
  menu: showMenuScreen,
  bills: showBillsScreen,
  reports: showReportsScreen,
  settings: showSettingsScreen,
};


async function run(work) {
  try {
    await work();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function showScreen(name) {
  for (const section of document.querySelectorAll('.view')) {
    section.classList.toggle('hidden', section.id !== 'view-' + name);
  }
  for (const button of document.querySelectorAll('#nav button')) {
    button.classList.toggle('active', button.dataset.view === name);
  }
  await screens[name]();
}

document.addEventListener('click', (event) => {
  if (event.target.id === 'backdrop') return closeModal();

  const navButton = event.target.closest('#nav button');
  if (navButton) return run(() => showScreen(navButton.dataset.view));

  const element = event.target.closest('[data-action]');
  if (element && actions[element.dataset.action]) {
    run(() => actions[element.dataset.action](element));
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  run(() => forms[form.dataset.form](form));
});

document.addEventListener('input', (event) => {
  const id = event.target.id;

  if (id === 'search') {
    state.search = event.target.value;
    drawMenu();
  } else if (id === 'customer') {
    state.draft.customer_name = event.target.value;
  } else if (id === 'received') {
    showChange();
  } else if (id === 'bill-search') {
    run(showBillsScreen);
  } else if (id === 'discount-value') {
    state.discountValue = event.target.value;
    clearTimeout(state.discountTimer);
    state.discountTimer = setTimeout(() => run(() => reloadOrder()), 350);
  }
});

document.addEventListener('change', (event) => {
  const id = event.target.id;

  if (id === 'discount-type') {
    state.discountType = event.target.value;
    state.discountValue = '';
    run(() => reloadOrder());
  } else if (id === 'bill-date') {
    run(showBillsScreen);
  } else if (id === 'report-date') {
    run(showReportsScreen);
  } else if (event.target.name === 'method') {
    $('#cash-box').classList.toggle('hidden', event.target.value !== 'cash');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Enter' && event.target.id === 'search') {
    const firstDish = visibleDishes().find((dish) => dish.is_available);
    if (firstDish) {
      run(() => addDish(firstDish.id));
      event.target.select();
    }
  }
});

run(async () => {
  await loadSettings();
  await showScreen('billing');
});
