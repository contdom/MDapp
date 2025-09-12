const express = require('express');
const router = express.Router();
const { db, getTableInfo, sanitizeIdentifier } = require('../db');

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

router.get('/ref/:table/:column', (req, res) => {
  const table = sanitizeIdentifier(req.params.table);
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  const LOOKUP_LABELS = {
    rfi_codice: 'rfi_codice',
    rfi_fase: 'rfi_fase',
    rfi_pset: 'rfi_pset',
    rfi_parametri: 'nome_parametro',
    unita_misura: 'simbolo'
  };

  const { column } = req.params;
  const fk = getTableInfo(table).foreignKeys.find(f => f.from === column);
  if (!fk) return res.json({ options: [] });

  const labelCol = LOOKUP_LABELS[fk.table] || 'id';
  const options = db.prepare(
    `SELECT id, ${labelCol} AS label FROM "${fk.table}" ORDER BY label`
  ).all();

  res.json({ refTable: fk.table, idColumn: fk.to, labelColumn: labelCol, options });
});

module.exports = router;
