// Toast non bloccanti al posto di alert()/confirm() per i soli messaggi
// informativi: le decisioni bloccanti (conferma delete, conferma scarto
// modifiche) restano su confirm() nativo, appropriato per un'azione singola
// e rara.
let container;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'info', duration = 4000) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  c.appendChild(el);

  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, duration);
}
