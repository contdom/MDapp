// Connessione unica e condivisa al DB SQLite, usata da tutte le route.
// better-sqlite3 è sincrono: niente callback/promise per le query, ma
// anche niente accesso concorrente da più processi — va bene per un tool
// mono-utente locale.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/MODELLO_DATI.db');
if (!fs.existsSync(DB_PATH)) {
  console.error(`⚠️ Database non trovato: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // scritture non bloccano le letture concorrenti
db.pragma('foreign_keys = ON'); // SQLite non le applica di default

/**
 * Verifica che un identificatore (es. nome tabella/colonna) contenga
 * solo caratteri sicuri. Restituisce il nome se valido, altrimenti null.
 *
 * @param {string} name
 * @returns {string|null}
 */
function sanitizeIdentifier(name) {
  if (typeof name !== 'string') return null;
  return /^[A-Za-z0-9_]+$/.test(name) ? name : null;
}

/**
 * Schema di una tabella (colonne + foreign key) via introspezione SQLite.
 * Ri-valida internamente il nome tabella, quindi è sicura da chiamare
 * anche se il chiamante ha già fatto il proprio controllo con
 * sanitizeIdentifier.
 */
function getTableInfo(table) {
  const t = sanitizeIdentifier(table);
  if (!t) throw new Error('Invalid table name');
  return {
    columns: db.prepare(`PRAGMA table_info('${t}')`).all(),
    foreignKeys: db.prepare(`PRAGMA foreign_key_list('${t}')`).all()
  };
}

module.exports = { db, getTableInfo, DB_PATH, sanitizeIdentifier };
