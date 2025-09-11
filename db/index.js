const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/MODELLO_DATI.db');
if (!fs.existsSync(DB_PATH)) {
  console.error(`⚠️ Database non trovato: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function getTableInfo(table) {
  return {
    columns: db.prepare(`PRAGMA table_info('${table}')`).all(),
    foreignKeys: db.prepare(`PRAGMA foreign_key_list('${table}')`).all()
  };
}

module.exports = { db, getTableInfo, DB_PATH };
