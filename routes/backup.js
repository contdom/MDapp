// Snapshot del DB su disco, con timestamp nel nome. Nessuna
// rotazione/pulizia automatica: i backup vecchi restano in data/backups/
// finché non li rimuove manualmente chi usa l'app.
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { sendError } = require('../db/errors');

const BACKUP_DIR = path.join(__dirname, '../data/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

router.post('/backup', async (req, res) => {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `MODELLO_DATI_${ts}.db`);
    // db.backup() usa l'online backup API di SQLite: a differenza di una
    // fs.copyFileSync del solo file .db, include anche le modifiche non
    // ancora "checkpointate" dal journal WAL (db/index.js:12), quindi il
    // backup riflette davvero lo stato corrente.
    await db.backup(backupPath);
    res.json({ backup: `data/backups/${path.basename(backupPath)}` });
  } catch (e) { sendError(res, 500, e); }
});

module.exports = router;
