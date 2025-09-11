const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { db, getTableInfo } = require('../db');

const upload = multer({ dest: 'uploads/' });

router.post('/import/:table', upload.single('file'), (req, res) => {
  try {
    const { table } = req.params;
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
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
