let pendingUpdates = [];

export function initMatrix() {
  document.getElementById('btn-matrix').onclick = renderPsetParametriMatrix;
}

async function renderPsetParametriMatrix() {
  const res = await fetch('/api/pset-parametri-matrix');
  const data = await res.json();
  const { fasi, psets } = data;

  const container = document.createElement('div');

  for (const group of psets) {
    const h = document.createElement('h3');
    h.textContent = group.pset.rfi_pset;
    container.appendChild(h);

    const table = document.createElement('table');
    table.className = 'table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Parametro</th>' + fasi.map(f => `<th>${f.rfi_fase}</th>`).join('') + '</tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of group.rows) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = row.parametro.nome_parametro;
      tr.appendChild(tdName);

      for (const f of row.fasi) {
        const td = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = f.checked;
        cb.onchange = async () => {
          const payload = [{
            pset_id: group.pset.id,
            parametro_id: row.parametro.id,
            fase_id: f.fase.id,
            checked: cb.checked
          }];
          const res = await fetch('/api/pset-parametri-matrix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: payload })
          });
          if (!res.ok) {
            alert('Errore aggiornamento');
            cb.checked = !cb.checked; // rollback
          }
        };
        td.appendChild(cb);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  document.getElementById('rows').innerHTML = '';
  document.getElementById('rows').appendChild(container);
}

