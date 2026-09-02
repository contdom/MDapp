// Vista/editor a matrice per i legami Codice↔Pset↔Fase (tabella
// rfi_codice_pset), usata da public/js/codiceMatrix.js. Stessa logica di
// psetMatrix.js ma su un dominio diverso: qui una cella può contenere più
// pset per lo stesso codice/fase, quindi add/remove sono endpoint singoli
// invece di un update batch.
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { sendError } = require('../db/errors');

// GET matrice codice-pset
router.get('/codice-pset-matrix', (req, res) => {
  try {
    const codici = db.prepare(`SELECT * FROM rfi_codice ORDER BY rfi_codice`).all();
    const fasi = db.prepare(`SELECT * FROM rfi_fase ORDER BY ordine`).all();
    const psets = db.prepare(`SELECT * FROM rfi_pset ORDER BY rfi_pset`).all();
    const legami = db.prepare(`
      SELECT l.*, p.rfi_pset
      FROM rfi_codice_pset l
      JOIN rfi_pset p ON p.id = l.rfi_pset_id
    `).all();

    const result = codici.map(cod => ({
      codice: cod,
      fasi: fasi.map(f => {
        const cellLegami = legami.filter(l => l.rfi_codice_id === cod.id && l.rfi_fase_id === f.id);
        return { fase: f, psets: cellLegami.map(l => ({ id: l.rfi_pset_id, label: l.rfi_pset })) };
      })
    }));

    res.json({ fasi, codici: result, psets });
  } catch (e) { sendError(res, 500, e); }
});

// POST aggiungi pset a una cella (codice+fase)
router.post('/codice-pset-add', (req, res) => {
  try {
    const { codice_id, fase_id, pset_id } = req.body;
    db.prepare(`
      INSERT INTO rfi_codice_pset (rfi_codice_id, rfi_pset_id, rfi_fase_id)
      VALUES (?,?,?)
    `).run(codice_id, pset_id, fase_id);
    res.json({ ok: true });
  } catch (e) { sendError(res, 400, e); }
});

// DELETE rimuovi pset da una cella
router.delete('/codice-pset-remove', (req, res) => {
  try {
    const { codice_id, fase_id, pset_id } = req.body;
    db.prepare(`
      DELETE FROM rfi_codice_pset
      WHERE rfi_codice_id=? AND rfi_pset_id=? AND rfi_fase_id=?
    `).run(codice_id, pset_id, fase_id);
    res.json({ ok: true });
  } catch (e) { sendError(res, 400, e); }
});

module.exports = router;
