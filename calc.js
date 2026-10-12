const { HttpError } = require('./errors');

function percentOf(amount, percent) {
  return Math.round((amount * percent) / 100);
}

function calculateBill(subtotal, taxPercent, servicePercent, discountType, discountValue) {
  const serviceAmount = percentOf(subtotal, servicePercent);
  const taxAmount = percentOf(subtotal + serviceAmount, taxPercent);
  const grossTotal = subtotal + serviceAmount + taxAmount;

  let discountAmount = 0;
  if (discountType === 'percent') {
    if (Number.isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      throw new HttpError('Discount percentage must be between 0 and 100.');
    }
    discountAmount = percentOf(grossTotal, discountValue);
  } else if (discountType === 'flat') {
    if (Number.isNaN(discountValue) || discountValue < 0) {
      throw new HttpError('Discount cannot be negative.');
    }
    discountAmount = Math.round(discountValue);
    if (discountAmount > grossTotal) {
      throw new HttpError('Discount cannot be more than the bill total.');
    }
  } else if (discountType) {
    throw new HttpError("Discount type must be 'percent' or 'flat'.");
  }

  const beforeRounding = grossTotal - discountAmount;
  const total = Math.round(beforeRounding / 100) * 100;

  return {
    subtotal,
    service_percent: servicePercent,
    service_amount: serviceAmount,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
    gross_total: grossTotal,
    discount_type: discountType || null,
    discount_value: discountType ? discountValue : 0,
    discount_amount: discountAmount,
    round_off: total - beforeRounding,
    total,
  };
}

module.exports = { calculateBill };
