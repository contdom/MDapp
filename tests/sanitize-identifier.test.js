const test = require('node:test');
const assert = require('node:assert');
const { sanitizeIdentifier, db } = require('../db');

test('sanitizeIdentifier accepts plain alphanumeric/underscore names', () => {
  assert.strictEqual(sanitizeIdentifier('rfi_pset'), 'rfi_pset');
  assert.strictEqual(sanitizeIdentifier('Table_123'), 'Table_123');
});

test('sanitizeIdentifier rejects anything that could break out of a quoted identifier', (t) => {
  t.after(() => db.close());
  for (const bad of ['rfi_pset"; DROP TABLE rfi_pset; --', 'a b', 'a.b', '', null, undefined, 42]) {
    assert.strictEqual(sanitizeIdentifier(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});
