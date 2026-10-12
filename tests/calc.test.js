const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBill } = require('../calc');

test('GST only, no discount', () => {
  const bill = calculateBill(48000, 5, 0, null, 0);
  assert.equal(bill.tax_amount, 2400);
  assert.equal(bill.gross_total, 50400);
  assert.equal(bill.total, 50400);
  assert.equal(bill.round_off, 0);
});

test('percent discount is taken after GST', () => {
  const bill = calculateBill(48000, 5, 0, 'percent', 10);
  assert.equal(bill.subtotal, 48000);
  assert.equal(bill.discount_amount, 5040);
  assert.equal(bill.total, 45400); // 453.60 rounded to 454
  assert.equal(bill.round_off, 40);
});

test('flat discount is in paise', () => {
  const bill = calculateBill(10000, 5, 0, 'flat', 2500);
  assert.equal(bill.gross_total, 10500);
  assert.equal(bill.total, 8000);
});

test('GST is charged on subtotal + service charge', () => {
  const bill = calculateBill(10000, 5, 10, null, 0);
  assert.equal(bill.service_amount, 1000);
  assert.equal(bill.tax_amount, 550);
  assert.equal(bill.gross_total, 11550);
  assert.equal(bill.total, 11600);
});

test('decimal percentages work', () => {
  assert.equal(calculateBill(10000, 2.5, 0, null, 0).tax_amount, 250);
  assert.equal(calculateBill(10000, 5, 0, 'percent', 12.5).discount_amount, 1313);
});

test('total is rounded to the nearest rupee (half rounds up)', () => {
  assert.equal(calculateBill(1050, 0, 0, null, 0).total, 1100);
});

test('100% discount gives a zero bill, empty order gives zero', () => {
  assert.equal(calculateBill(10000, 5, 0, 'percent', 100).total, 0);
  assert.equal(calculateBill(0, 5, 0, null, 0).total, 0);
});

test('wrong discounts are rejected', () => {
  assert.throws(() => calculateBill(10000, 5, 0, 'percent', 101));
  assert.throws(() => calculateBill(10000, 5, 0, 'percent', -1));
  assert.throws(() => calculateBill(10000, 5, 0, 'flat', 20000));
  assert.throws(() => calculateBill(10000, 5, 0, 'bogus', 5));
  assert.throws(() => calculateBill(10000, 5, 0, 'percent', NaN));
});
