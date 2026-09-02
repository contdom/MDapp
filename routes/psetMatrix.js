// Vista/editor a matrice per i legami Pset↔Parametro↔Fase (tabella
// rfi_pset_parametri), usata da public/js/matrix.js. A differenza delle
// route generiche in rows.js, queste sono scritte apposta per questo
// dominio: query dirette sulle tabelle rfi_* invece che introspezione
// generica dello schema.
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { sendError } = require('../db/errors');

// GET matrice pset-parametri: per ogni pset, i parametri effettivamente
// legati e per ciascuno quali fasi sono già spuntate.
router.get('/pset-parametri-matrix', (req, res) => {
  try {
    const psets = db.prepare(`SELECT * FROM rfi_pset ORDER BY rfi_pset`).all();
    const fasi = db.prepare(`SELECT * FROM rfi_fase ORDER BY ordine`).all();

    const legami = db.prepare(`
      SELECT * FROM rfi_pset_parametri
    `).all();

    const rows = db.prepare(`
      SELECT DISTINCT p.*, l.rfi_pset_id
      FROM rfi_parametri p
      JOIN rfi_pset_parametri l ON l.nome_parametro_id = p.id
    `).all();

    const result = psets.map(pset => {
      const paramsOfPset = rows.filter(r => r.rfi_pset_id === pset.id);
      const mapped = paramsOfPset.map(p => ({
        parametro: p,
        fasi: fasi.map(f => ({
          fase: f,
          checked: legami.some(l =>
            l.rfi_pset_id === pset.id &&
            l.nome_parametro_id === p.id &&
            l.rfi_fase_id === f.id
          )
        }))
      }));
      return { pset, rows: mapped };
    });

    res.json({ fasi, psets: result });
  } catch (e) { sendError(res, 500, e); }
});

// POST aggiornamento matrice: ogni update è un toggle (checked=true inserisce
// il legame, checked=false lo rimuove), applicati tutti in una transazione.
router.post('/pset-parametri-matrix', (req, res) => {
  try {
    const { updates } = req.body;
    const insert = db.prepare(
      `INSERT INTO rfi_pset_parametri (rfi_pset_id, nome_parametro_id, rfi_fase_id) VALUES (?,?,?)`
    );
    const del = db.prepare(
      `DELETE FROM rfi_pset_parametri WHERE rfi_pset_id=? AND nome_parametro_id=? AND rfi_fase_id=?`
    );

    const tx = db.transaction(upd => {
      for (const u of upd) {
        if (u.checked) insert.run(u.pset_id, u.parametro_id, u.fase_id);
        else del.run(u.pset_id, u.parametro_id, u.fase_id);
      }
    });
    tx(updates);

    res.json({ ok: true, count: updates.length });
  } catch (e) { sendError(res, 400, e); }
});

module.exports = router;
