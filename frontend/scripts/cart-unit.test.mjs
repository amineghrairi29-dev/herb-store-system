import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCart, cartQuantity, lineSubtotal, addDecimals, stepQuantity } from '../src/lib/cart.ts';
test('decimal quantities match sales precision and accept comma', () => {
  assert.equal(cartQuantity(' 00,5 '), '0.500');
  for (const input of ['0', '-1', '1e3', 'Infinity', '0.0000000000000000001', '1'.repeat(61)]) assert.equal(cartQuantity(input), null);
  assert.equal(stepQuantity('0.500', 1), '1.500'); assert.equal(stepQuantity('1.500', -1), '0.500'); assert.equal(stepQuantity('0.500', -1), null);
});
test('money multiplication and totals are exact beyond floating point precision', () => {
  assert.equal(lineSubtotal('3.000', '0.1'), '0.300');
  assert.equal(lineSubtotal('0.5', '12.500000000000000001'), '6.2500000000000000005');
  assert.equal(addDecimals('0.1', '0.2'), '0.300');
  assert.equal(lineSubtotal('2', '9007199254740993.01'), '18014398509481986.020');
});
test('corrupted storage recovers and ignores invalid, duplicate and sensitive entries', () => {
  assert.deepEqual(readCart('bad'), { items: [], recovered: true });
  assert.deepEqual(readCart(null), { items: [], recovered: false });
  assert.deepEqual(readCart('{"version":2,"items":[]}'), { items: [], recovered: true });
  const recovered = readCart(JSON.stringify({ version: 1, items: [{ productId: 1, quantity: '1', price: '999', name: 'ignored' }, { productId: 1, quantity: '2' }, { productId: 2, quantity: '-1' }, { productId: '3', quantity: '1' }, null] }));
  assert.deepEqual(recovered, { items: [{ productId: 1, quantity: '1.000' }], recovered: true });
  assert.equal(readCart(JSON.stringify({ version: 1, items: Array.from({ length: 101 }, (_, i) => ({ productId: i + 1, quantity: '1' })) })).items.length, 100);
});
