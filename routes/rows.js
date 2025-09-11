const express = require('express');
const router = express.Router();
const { db, getTableInfo } = require('../db');

// GET rows con filtro e paginazione
router.get('/rows/:table', (req, res) => {
  try {
    const { table } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = parseInt(req.query.offset || '0');
    const q = (req.query.q || '').trim();

    const info = getTableInfo(table).columns;
    const textCols = info.filter(c => (c.type || '').toUpperCase().includes('TEXT'))
      .map(c => `"${c.name}" LIKE ?`);

    let where = '';
    let params = [];
    if (q && textCols.length) {
      where = ` WHERE ${textCols.join(' OR ')}`;
      params = Array(textCols.length).fill(`%${q}%`);
    }

    const rows = db.prepare(`SELECT * FROM "${table}"${where} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as c FROM "${table}"${where}`)
      .get(...params).c;

    res.json({ rows, limit, offset, total, q });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST insert
router.post('/rows/:table', (req, res) => {
  try {
    const { table } = req.params;
    const payload = req.body || {};
    const info = getTableInfo(table).columns.filter(c => c.pk === 0).map(c => c.name);
    const keys = info.filter(k => payload[k] !== undefined);

    const sql = `INSERT INTO "${table}" (${keys.join(',')})
                 VALUES (${keys.map(k => `@${k}`).join(',')})`;
    const result = db.prepare(sql).run(payload);
    const inserted = db.prepare(`SELECT * FROM "${table}" WHERE rowid=?`)
      .get(result.lastInsertRowid);

    res.status(201).json({ inserted });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT update
router.put('/rows/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    const payload = req.body || {};
    const pk = getTableInfo(table).columns.find(c => c.pk === 1)?.name || 'id';
    const keys = Object.keys(payload);

    const setClause = keys.map(k => `"${k}"=@${k}`).join(', ');
    db.prepare(`UPDATE "${table}" SET ${setClause} WHERE "${pk}"=@id`)
      .run({ ...payload, id });

    const updated = db.prepare(`SELECT * FROM "${table}" WHERE "${pk}"=?`).get(id);
    res.json({ updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE
router.delete('/rows/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const pk = getTableInfo(table).columns.find(c => c.pk === 1)?.name || 'id';
  const result = db.prepare(`DELETE FROM "${table}" WHERE "${pk}"=?`).run(id);
  res.json({ deleted: result.changes });
});

module.exports = router;
