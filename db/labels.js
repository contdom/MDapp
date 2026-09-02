const { getTableInfo } = require('./index');

// Per le tabelle rfi_* la colonna "etichetta" non è ovvia dal nome
// (es. rfi_parametri usa nome_parametro, non "nome"), quindi va elencata
// esplicitamente. Le altre tabelle passano dal fallback euristico sotto.
const LOOKUP_LABELS = {
  rfi_codice: 'rfi_codice',
  rfi_fase: 'rfi_fase',
  rfi_pset: 'rfi_pset',
  rfi_parametri: 'nome_parametro',
  unita_misura: 'simbolo'
};

/**
 * Colonna da mostrare come etichetta leggibile quando si referenzia `table`
 * via foreign key (es. nelle select di public/js/crud.js): prima la mappa
 * esplicita sopra, poi i nomi comuni più probabili, infine la prima colonna
 * di tipo testo trovata nello schema.
 */
function guessLabelColumn(table) {
  const columns = getTableInfo(table).columns;
  const preferred = LOOKUP_LABELS[table];
  if (preferred && columns.find(c => c.name === preferred)) return preferred;

  const priority = ['nome', 'descrizione', 'label', 'codice'];
  for (const key of priority) {
    const c = columns.find(x => x.name.toLowerCase() === key);
    if (c) return c.name;
  }

  const textCol = columns.find(c =>
    (c.type || '').toUpperCase().includes('TEXT') ||
    (c.type || '').toUpperCase().includes('CHAR')
  );
  return textCol ? textCol.name : (columns[0]?.name || 'id');
}

module.exports = { LOOKUP_LABELS, guessLabelColumn };
