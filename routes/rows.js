// Route generiche per leggere/scrivere righe di QUALSIASI tabella del DB.
// Il nome tabella arriva dal client (parte dell'URL), quindi va sempre
// validato con sanitizeIdentifier prima di essere interpolato in una query:
// SQLite non supporta i nomi di tabella/colonna come parametri bind (solo i
// valori), per questo l'interpolazione diretta nella stringa SQL è
// necessaria qui — ma solo dopo la validazione.
const express = require('express');
const router = express.Router();
const { db, getTableInfo, sanitizeIdentifier } = require('../db');
const { sendError } = require('../db/errors');

// GET rows con filtro (LIKE su colonne TEXT) e paginazione
router.get('/rows/:table', (req, res) => {
  try {
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
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
  } catch (e) { sendError(res, 500, e); }
});

// POST insert — le colonne accettate sono whitelisted contro lo schema reale
// (getTableInfo), il body del client non viene mai usato direttamente per i
// nomi di colonna.
router.post('/rows/:table', (req, res) => {
  try {
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const payload = req.body || {};
    const info = getTableInfo(table).columns.filter(c => c.pk === 0).map(c => c.name);
    const keys = info.filter(k => payload[k] !== undefined);

    const sql = `INSERT INTO "${table}" (${keys.join(',')})
                 VALUES (${keys.map(k => `@${k}`).join(',')})`;
    const result = db.prepare(sql).run(payload);
    const inserted = db.prepare(`SELECT * FROM "${table}" WHERE rowid=?`)
      .get(result.lastInsertRowid);

    res.status(201).json({ inserted });
  } catch (e) { sendError(res, 400, e); }
});

// PUT update — stessa whitelist della POST: solo colonne che esistono
// davvero nello schema, mai le chiavi grezze del body del client.
router.put('/rows/:table/:id', (req, res) => {
  try {
    const { id } = req.params;
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const payload = req.body || {};
    const columns = getTableInfo(table).columns;
    const pk = columns.find(c => c.pk === 1)?.name || 'id';
    const validNames = new Set(columns.map(c => c.name));
    const keys = Object.keys(payload).filter(k => validNames.has(k));
    if (!keys.length) return res.status(400).json({ error: 'Nessun campo valido da aggiornare' });

    const setClause = keys.map(k => `"${k}"=@${k}`).join(', ');
    db.prepare(`UPDATE "${table}" SET ${setClause} WHERE "${pk}"=@id`)
      .run({ ...payload, id });

    const updated = db.prepare(`SELECT * FROM "${table}" WHERE "${pk}"=?`).get(id);
    res.json({ updated });
  } catch (e) { sendError(res, 400, e); }
});

// DELETE
router.delete('/rows/:table/:id', (req, res) => {
  try {
    const { id } = req.params;
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    const pk = getTableInfo(table).columns.find(c => c.pk === 1)?.name || 'id';
    const result = db.prepare(`DELETE FROM "${table}" WHERE "${pk}"=?`).run(id);
    res.json({ deleted: result.changes });
  } catch (e) { sendError(res, 400, e); }
});

module.exports = router;
