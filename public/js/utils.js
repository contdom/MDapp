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
