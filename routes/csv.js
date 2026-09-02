// Import di un CSV dentro una tabella esistente: una riga CSV = una INSERT,
// tutte dentro un'unica transazione (se una riga fallisce, non resta nulla
// a metà). Le colonne accettate sono whitelisted contro lo schema reale,
// come nella POST di routes/rows.js.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { db, getTableInfo, sanitizeIdentifier } = require('../db');
const { sendError } = require('../db/errors');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, sufficiente per import CSV di lookup table
  fileFilter: (req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    cb(isCsv ? null : new Error('Sono ammessi solo file .csv'), isCsv);
  }
});

router.post('/import/:table', upload.single('file'), (req, res) => {
  try {
    const table = sanitizeIdentifier(req.params.table);
    if (!table) return res.status(400).json({ error: 'Invalid table name' });
    if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

    const buf = fs.readFileSync(req.file.path).toString('utf8');
    const records = parse(buf, { columns: true, skip_empty_lines: true });

    const cols = getTableInfo(table).columns.filter(c => c.pk === 0).map(c => c.name);
    const insert = db.prepare(
      `INSERT INTO "${table}" (${cols.join(',')})
       VALUES (${cols.map(c => `@${c}`).join(',')})`
    );
    const tx = db.transaction(rows => rows.forEach(r => insert.run(r)));
    tx(records);

    fs.unlink(req.file.path, () => {});
    res.json({ inserted: records.length });
  } catch (e) { sendError(res, 400, e); }
});

module.exports = router;
