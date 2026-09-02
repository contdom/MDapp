const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rowsRouter = require('../routes/rows');
const { db } = require('../db');

// Tabella usata solo da questi test, creata e droppata ad ogni test:
// non tocca mai le tabelle reali rfi_*.
const TEST_TABLE = '__test_rows_whitelist__';

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', rowsRouter);
  const server = app.listen(0);
  return { server, base: `http://localhost:${server.address().port}` };
}

test('PUT /rows/:table/:id ignora colonne non presenti nello schema (whitelist)', async (t) => {
  db.exec(`CREATE TABLE ${TEST_TABLE} (id INTEGER PRIMARY KEY, nome TEXT)`);
  db.prepare(`INSERT INTO ${TEST_TABLE} (id, nome) VALUES (1, 'originale')`).run();

  const { server, base } = startServer();
  t.after(() => {
    server.close();
    db.exec(`DROP TABLE ${TEST_TABLE}`);
  });

  const res = await fetch(`${base}/api/rows/${TEST_TABLE}/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'aggiornato', colonna_inesistente: 'x' }),
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.updated.nome, 'aggiornato');
  assert.strictEqual('colonna_inesistente' in body.updated, false);
});

test('PUT /rows/:table/:id risponde 400 se nessun campo del body è valido', async (t) => {
  db.exec(`CREATE TABLE ${TEST_TABLE} (id INTEGER PRIMARY KEY, nome TEXT)`);

  const { server, base } = startServer();
  t.after(() => {
    server.close();
    db.exec(`DROP TABLE ${TEST_TABLE}`);
  });

  const res = await fetch(`${base}/api/rows/${TEST_TABLE}/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colonna_inesistente: 'x' }),
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('POST /rows/:table inserisce una riga filtrando le colonne sullo schema reale', async (t) => {
  db.exec(`CREATE TABLE ${TEST_TABLE} (id INTEGER PRIMARY KEY, nome TEXT)`);

  const { server, base } = startServer();
  t.after(() => {
    server.close();
    db.exec(`DROP TABLE ${TEST_TABLE}`);
  });

  const res = await fetch(`${base}/api/rows/${TEST_TABLE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'nuovo', colonna_inesistente: 'ignorata' }),
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.inserted.nome, 'nuovo');
});
