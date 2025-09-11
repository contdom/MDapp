const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('../db');

const BACKUP_DIR = path.join(__dirname, '../data/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

router.post('/backup', (req, res) => {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `MODELLO_DATI_${ts}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    res.json({ backup: `data/backups/${path.basename(backupPath)}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
