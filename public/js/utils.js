// utils.js - funzioni di supporto comuni lato client

export function inputTypeFor(sqlType) {
  const t = String(sqlType || '').toUpperCase();
  if (
    t.includes('INT') ||
    t.includes('REAL') ||
    t.includes('FLOA') ||
    t.includes('DOUB') ||
    t.includes('NUM')
  ) return 'number';
  if (t.includes('DATE') || t.includes('TIME')) return 'text';
  return 'text';
}

/**
 * Raccoglie e valida i dati dal form
 * @param {HTMLFormElement} form 
 * @param {object} schema - schema tabella (columns, foreignKeys)
 * @returns {object|null} payload per API, oppure null se errori
 */
export function collectAndValidateForm(form, schema) {
  const fd = new FormData(form);
  const payload = {};

  for (const [k, v0] of fd.entries()) {
    const col = schema.columns.find(c => c.name === k);
    if (!col) continue;

    const v = typeof v0 === 'string' ? v0.trim() : v0;

    // obbligatori
    if (col.notnull && (v === '' || v === null || v === undefined)) {
      alert(`Il campo "${col.name}" è obbligatorio.`);
      return null;
    }

    const t = inputTypeFor(col.type);
    if (t === 'number') {
      if (v === '') {
        payload[k] = null;
      } else if (isNaN(Number(v))) {
        alert(`"${col.name}" deve essere numerico.`);
        return null;
      } else {
        payload[k] = Number(v);
      }
    } else {
      payload[k] = v === '' ? null : v;
    }
  }

  return payload;
}

/**
 * Aggiorna info di paginazione (prev/next)
 */
export function updatePager(offset, limit, total) {
  const $pageInfo = document.getElementById('page-info');
  const $prev = document.getElementById('prev-page');
  const $next = document.getElementById('next-page');

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(total, offset + limit);

  $pageInfo.textContent = `${start}–${end} di ${total}`;
  $prev.disabled = offset <= 0;
  $next.disabled = offset + limit >= total;
}
