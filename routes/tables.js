// Route "meta": elenco tabelle, schema di una tabella, opzioni per i menu a
// tendina delle foreign key. Il frontend (public/js/crud.js) le usa per
// costruire dinamicamente form e tabelle senza sapere nulla in anticipo
// sullo schema del DB.
const express = require('express');
const router = express.Router();
const { db, getTableInfo, sanitizeIdentifier } = require('../db');
const { guessLabelColumn } = require('../db/labels');

router.get('/tables', (req, res) => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map(r => r.name);
  res.json({ tables });
});

router.get('/schema/:table', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  res.json(getTableInfo(table));
});

// Opzioni {id,label} per popolare la select di una foreign key nel form di
// modifica riga: `column` deve essere una colonna FK della tabella.
router.get('/ref/:table/:column', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });

  const { column } = req.params;
  const fk = getTableInfo(table).foreignKeys.find(f => f.from === column);
  if (!fk) return res.json({ options: [] });

  const labelCol = guessLabelColumn(fk.table);
  const options = db.prepare(
    `SELECT id, ${labelCol} AS label FROM "${fk.table}" ORDER BY label`
  ).all();

  res.json({ refTable: fk.table, idColumn: fk.to, labelColumn: labelCol, options });
});

module.exports = router;
