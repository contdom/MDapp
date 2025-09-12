const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rowsRouter = require('../routes/rows');
const { db } = require('../db');

test('DELETE /rows/:table/:id returns error for non-existent table', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', rowsRouter);
  const server = app.listen(0);
  t.after(() => {
    server.close();
    db.close();
  });
  const base = `http://localhost:${server.address().port}`;

  const res = await fetch(`${base}/api/rows/nonexistent_table/1`, { method: 'DELETE' });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});
