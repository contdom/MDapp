const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * Utility: trova una colonna leggibile in una tabella FK
 */
function guessLabelColumn(table) {
  // convenzione: prima "rfi_codice", poi "nome", poi "descrizione", poi "label"
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const priority = ['rfi_codice', 'nome', 'descrizione', 'label'];
  for (const key of priority) {
    const col = cols.find(c => c.name.toLowerCase() === key);
    if (col) return col.name;
  }
  // se non troviamo, prendiamo la prima TEXT
  const textCol = cols.find(c =>
    c.type?.toUpperCase().includes('CHAR') || c.type?.toUpperCase().includes('TEXT')
  );
  return textCol ? textCol.name : cols[0].name;
}

/**
 * GET tutte le tabelle
 */
router.get('/tables', (req, res) => {
  const rows = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).all();
  res.json({ tables: rows.map(r => r.name) });
});

/**
 * GET schema di una tabella (colonne + FK)
 */
router.get('/schema/:table', (req, res) => {
  const { table } = req.params;
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
  res.json({ columns, foreignKeys });
});

/**
 * GET dati di riferimento per una FK
 */
router.get('/ref/:table/:column', (req, res) => {
  const { table, column } = req.params;
  const fk = db.prepare(`PRAGMA foreign_key_list(${table})`).all().find(f => f.from === column);
  if (!fk) return res.json({ options: [] });

  const labelCol = guessLabelColumn(fk.table);
  const options = db.prepare(
    `SELECT ${fk.to} AS id, ${labelCol} AS label FROM ${fk.table} ORDER BY ${labelCol}`
  ).all();
  res.json({ options });
});

/**
 * GET righe con traduzione FK in label
 */
router.get('/rows/:table', (req, res) => {
  const { table } = req.params;
  const { limit = 50, offset = 0, q } = req.query;

  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table})`).all();

  // query base
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  if (q) {
    const likeCols = columns
      .filter(c => c.type?.toUpperCase().includes('TEXT'))
      .map(c => `${c.name} LIKE ?`);
    if (likeCols.length) {
      sql += ` WHERE ` + likeCols.join(' OR ');
      likeCols.forEach(() => params.push(`%${q}%`));
    }
  }
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);

  // traduci FK
  const enriched = rows.map(r => {
    const copy = { ...r };
    for (const fk of foreignKeys) {
      const labelCol = guessLabelColumn(fk.table);
      const lookup = db
        .prepare(`SELECT ${labelCol} FROM ${fk.table} WHERE ${fk.to}=?`)
        .get(r[fk.from]);
      copy[fk.from] = lookup ? lookup[labelCol] : null;
    }
    return copy;
  });

  const total = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  res.json({ rows: enriched, total });
});

/**
 * POST nuova riga
 */
router.post('/rows/:table', (req, res) => {
  try {
    const { table } = req.params;
    const body = req.body;
    const cols = Object.keys(body);
    const vals = Object.values(body);
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
    db.prepare(sql).run(...vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * PUT aggiorna riga
 */
router.put('/rows/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    const body = req.body;
    const cols = Object.keys(body);
    const vals = Object.values(body);
    const pk = db.prepare(`PRAGMA table_info(${table})`).all().find(c => c.pk === 1).name;
    const sql = `UPDATE ${table} SET ${cols.map(c => `${c}=?`).join(',')} WHERE ${pk}=?`;
    db.prepare(sql).run(...vals, id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * DELETE riga
 */
router.delete('/rows/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    const pk = db.prepare(`PRAGMA table_info(${table})`).all().find(c => c.pk === 1).name;
    db.prepare(`DELETE FROM ${table} WHERE ${pk}=?`).run(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
