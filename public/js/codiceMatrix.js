// Editor a matrice Codice × Fase per i pset associati a un codice
// (rfi_codice_pset): drag&drop di un pset dalla sidebar dentro una cella
// per aggiungerlo, ❌ sul tag per rimuoverlo. Ogni azione richiama subito
// l'API e ridisegna l'intera matrice (nessuno stato "non salvato").
import { toast } from "./notify.js";

export function initCodiceMatrix() {
  const btn = document.getElementById('btn-codice-matrix');
  if (btn) btn.onclick = renderCodiceMatrix;
}

export async function renderCodiceMatrix() {
  const res = await fetch('/api/codice-pset-matrix');
  const { fasi, codici, psets } = await res.json();

  const container = document.createElement('div');
  container.className = 'matrix-container';

  // sidebar con Pset
  const sidebar = document.createElement('div');
  sidebar.className = 'pset-sidebar';
  sidebar.innerHTML = '<h3>Pset disponibili</h3>';
  psets.forEach(p => {
    const div = document.createElement('div');
    div.className = 'pset-item';
    div.textContent = p.rfi_pset;
    div.draggable = true;
    div.dataset.id = p.id;
    div.ondragstart = e => e.dataTransfer.setData('pset_id', p.id);
    sidebar.appendChild(div);
  });

  // tabella
  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>RFI_Codice</th>' +
    fasi.map(f => `<th>${f.rfi_fase}</th>`).join('') +
    '</tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const cod of codici) {
    const tr = document.createElement('tr');
    const tdCode = document.createElement('td');
    tdCode.textContent = cod.codice.rfi_codice;
    tr.appendChild(tdCode);

    for (const cell of cod.fasi) {
      const td = document.createElement('td');
      td.className = 'dropzone';
      td.ondragover = e => e.preventDefault();
      td.ondrop = async e => {
        e.preventDefault();
        const psetId = Number(e.dataTransfer.getData('pset_id'));
        const res = await fetch('/api/codice-pset-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codice_id: cod.codice.id,
            fase_id: cell.fase.id,
            pset_id: psetId
          })
        });
        if (!res.ok) {
          const err = await res.json();
          toast(`Errore aggiunta pset: ${err.error}`, 'error');
          return;
        }
        renderCodiceMatrix(); // ricarica
      };

      // mostra pset già associati
      cell.psets.forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'pset-tag';
        tag.textContent = p.label;

        const btnX = document.createElement('button');
        btnX.textContent = '❌';
        btnX.title = `Rimuovi ${p.label}`;
        btnX.setAttribute('aria-label', `Rimuovi ${p.label}`);
        btnX.onclick = async () => {
          const res = await fetch('/api/codice-pset-remove', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codice_id: cod.codice.id,
              fase_id: cell.fase.id,
              pset_id: p.id
            })
          });
          if (!res.ok) {
            const err = await res.json();
            toast(`Errore rimozione pset: ${err.error}`, 'error');
            return;
          }
          renderCodiceMatrix();
        };

        tag.appendChild(btnX);
        td.appendChild(tag);
      });

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  container.appendChild(sidebar);
  container.appendChild(table);

  document.getElementById('rows').innerHTML = '';
  document.getElementById('rows').appendChild(container);
}
