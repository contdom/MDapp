const express = require('express');
const router = express.Router();
const { db, sanitizeIdentifier } = require('../db');

const PREFERRED_LABELS = {
  rfi_codice: 'rfi_codice',
  rfi_fase: 'rfi_fase',
  rfi_pset: 'rfi_pset',
  rfi_parametri: 'nome_parametro',
  unita_misura: 'simbolo'
};

function quote(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function guessLabelColumn(table) {
  const cols = db.prepare(`PRAGMA table_info(${quote(table)})`).all();
  const preferred = PREFERRED_LABELS[table];
  if (preferred && cols.find(c => c.name === preferred)) return preferred;

  const priority = ['nome', 'descrizione', 'label', 'codice'];
  for (const key of priority) {
    const c = cols.find(x => x.name.toLowerCase() === key);
    if (c) return c.name;
  }
  const textCol = cols.find(c =>
    (c.type || '').toUpperCase().includes('TEXT') ||
    (c.type || '').toUpperCase().includes('CHAR')
  );
  return textCol ? textCol.name : (cols[0]?.name || 'id');
}

function pkOf(table) {
  const c = db.prepare(`PRAGMA table_info(${quote(table)})`).all().find(x => x.pk === 1);
  return c ? c.name : 'id';
}

// GET lista tabelle
router.get('/tables', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE 'sqlite_sequence'
      ORDER BY name
    `).all();
    res.json({ tables: rows.map(r => r.name) });
  } catch (e) {
    res.status(500).json({ error: e.message, tables: [] });
  }
});

// GET schema tabella
router.get('/schema/:table', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all();
  res.json({ columns, foreignKeys });
});

// GET ref options per FK
router.get('/ref/:table/:column', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  const { column } = req.params;
  const fks = db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all();
  const fk = fks.find(f => f.from === column);
  if (!fk) return res.json({ options: [] });

  const labelCol = guessLabelColumn(fk.table);
  const idCol = fk.to;
  const options = db.prepare(
    `SELECT ${quote(idCol)} AS id, ${quote(labelCol)} AS label FROM ${quote(fk.table)} ORDER BY ${quote(labelCol)}`
  ).all();

  res.json({ refTable: fk.table, idColumn: idCol, labelColumn: labelCol, options });
});

// GET righe con traduzione FK -> label
router.get('/rows/:table', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  const limit = Math.min(parseInt(req.query.limit || '50'), 500);
  const offset = parseInt(req.query.offset || '0');
  const q = (req.query.q || '').trim();

  const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all();

  let sql = `SELECT * FROM ${quote(table)}`;
  const params = [];
  if (q) {
    const likeCols = columns.filter(c => (c.type || '').toUpperCase().includes('TEXT'))
      .map(c => `${quote(c.name)} LIKE ?`);
    if (likeCols.length) {
      sql += ` WHERE ` + likeCols.join(' OR ');
      likeCols.forEach(() => params.push(`%${q}%`));
    }
  }
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const raw = db.prepare(sql).all(...params);

  const rows = raw.map(r => {
    const out = { ...r };
    for (const fk of foreignKeys) {
      const labelCol = guessLabelColumn(fk.table);
      const idVal = r[fk.from];
      if (idVal === null || idVal === undefined) { out[fk.from] = null; continue; }
      const found = db.prepare(
        `SELECT ${quote(labelCol)} AS label FROM ${quote(fk.table)} WHERE ${quote(fk.to)} = ?`
      ).get(idVal);
      out[fk.from] = found ? found.label : r[fk.from];
    }
    return out;
  });

  const total = db.prepare(`SELECT COUNT(*) AS c FROM ${quote(table)}`).get().c;
  res.json({ rows, total, limit, offset, q });
});

// POST nuova riga
router.post('/rows/:table', (req, res) => {
  try {
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const body = req.body || {};
    const cols = Object.keys(body);
    if (!cols.length) return res.status(400).json({ error: 'Nessun dato' });
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${quote(table)} (${cols.map(quote).join(',')}) VALUES (${placeholders})`;
    db.prepare(sql).run(...cols.map(k => body[k]));
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT aggiorna riga
router.put('/rows/:table/:id', (req, res) => {
  try {
    const { id } = req.params;
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const body = req.body || {};
    const cols = Object.keys(body);
    if (!cols.length) return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    const pk = pkOf(table);
    const set = cols.map(c => `${quote(c)}=?`).join(', ');
    db.prepare(`UPDATE ${quote(table)} SET ${set} WHERE ${quote(pk)}=?`).run(...cols.map(k => body[k]), id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE riga
router.delete('/rows/:table/:id', (req, res) => {
  try {
    const { id } = req.params;
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const pk = pkOf(table);
    const r = db.prepare(`DELETE FROM ${quote(table)} WHERE ${quote(pk)}=?`).run(id);
    res.json({ deleted: r.changes });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
