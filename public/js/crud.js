import { inputTypeFor, collectAndValidateForm, updatePager } from './utils.js';

let state = {
  tables: [],
  currentTable: null,
  schema: null,
  fkMap: {},   // { colName: { options:[{id,label}] } }
  q: '',
  limit: 50,
  offset: 0,
  total: 0,
  mode: 'insert',
  editingPkValue: null
};

export function initCrud() {
  loadTables();
  bindToolbar();
}

async function loadTables() {
  const res = await fetch('/api/tables');
  const data = await res.json();
  state.tables = data.tables || [];

  const $tables = document.getElementById('tables');
  $tables.innerHTML = '';
  state.tables.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    li.onclick = () => selectTable(t);
    $tables.appendChild(li);
  });
}

function bindToolbar() {
  document.getElementById('btn-apply-filter').onclick = () => {
    state.q = document.getElementById('search').value.trim();
    state.offset = 0;
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById('page-size').onchange = (e) => {
    state.limit = parseInt(e.target.value, 10);
    state.offset = 0;
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById('prev-page').onclick = () => {
    state.offset = Math.max(0, state.offset - state.limit);
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById('next-page').onclick = () => {
    state.offset = Math.min(state.total - 1, state.offset + state.limit);
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById('refresh').onclick = () => {
    if (state.currentTable) loadRows(state.currentTable);
  };
}

async function selectTable(table) {
  state.currentTable = table;
  state.offset = 0;
  document.getElementById('current-table').textContent = table;

  await loadSchema(table);
  await loadRows(table);
  await renderForm(table);
}

async function loadSchema(table) {
  const res = await fetch(`/api/schema/${table}`);
  state.schema = await res.json();
  state.fkMap = {};

  for (const fk of state.schema.foreignKeys) {
    const ref = await fetch(`/api/ref/${table}/${fk.from}`).then(r => r.json());
    state.fkMap[fk.from] = ref;
  }
}

async function loadRows(table) {
  const params = new URLSearchParams({ limit: state.limit, offset: state.offset });
  if (state.q) params.set('q', state.q);

  const res = await fetch(`/api/rows/${table}?${params.toString()}`);
  const data = await res.json();
  state.total = data.total || 0;
  renderRows(data.rows || []);
  updatePager(state.offset, state.limit, state.total);
}

function renderRows(rows) {
  const $rows = document.getElementById('rows');
  if (!rows.length) {
    $rows.innerHTML = '<div>Nessuna riga trovata.</div>';
    return;
  }

  const cols = Object.keys(rows[0]);
  const fkCols = new Set((state.schema.foreignKeys || []).map(f => f.from));

  const table = document.createElement('table');
  table.className = 'table';

  // intestazioni
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    trh.appendChild(th);
  }
  const thAct = document.createElement('th');
  thAct.textContent = 'Azioni';
  trh.appendChild(thAct);
  thead.appendChild(trh);
  table.appendChild(thead);

  // corpo
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const c of cols) {
      const td = document.createElement('td');
      if (fkCols.has(c)) {
        const label = state.fkMap[c]?.options.find(o => String(o.id) === String(r[c]))?.label ?? r[c];
        td.textContent = label;
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = String(r[c]);
        td.appendChild(document.createTextNode(' '));
        td.appendChild(badge);
      } else {
        td.textContent = r[c];
      }
      tr.appendChild(td);
    }

    // azioni
    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';

    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title = 'Modifica';
    btnEdit.onclick = () => editRow(r);

    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑️';
    btnDel.title = 'Elimina';
    btnDel.onclick = () => deleteRow(r);

    tdAct.append(btnEdit, btnDel);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  $rows.innerHTML = '';
  $rows.appendChild(table);
}

async function renderForm(table) {
  state.mode = 'insert';
  state.editingPkValue = null;

  const { columns, foreignKeys } = state.schema;
  const pk = columns.find(c => c.pk === 1)?.name || 'id';
  const writable = columns.filter(c => c.name !== pk);

  const form = document.createElement('form');
  form.id = 'upsert-form';

  for (const col of writable) {
    const field = document.createElement('div');
    field.className = 'form-field';

    const label = document.createElement('label');
    label.textContent = col.name + (col.notnull ? ' *' : '');
    label.setAttribute('for', `f_${col.name}`);

    const fk = foreignKeys.find(f => f.from === col.name);
    if (fk && state.fkMap[col.name]) {
      const select = document.createElement('select');
      select.name = col.name;
      select.id = `f_${col.name}`;
      select.required = !!col.notnull;

      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '-- seleziona --';
      select.appendChild(empty);

      for (const opt of state.fkMap[col.name].options) {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label ?? opt.id;
        select.appendChild(o);
      }
      field.append(label, select);
    } else {
      const input = document.createElement('input');
      input.name = col.name;
      input.id = `f_${col.name}`;
      input.type = inputTypeFor(col.type);
      input.placeholder = col.type || 'TEXT';
      if (input.type === 'number') input.step = 'any';
      input.required = !!col.notnull;
      field.append(label, input);
    }
    form.appendChild(field);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const btnSubmit = document.createElement('button');
  btnSubmit.textContent = 'Inserisci';

  const btnReset = document.createElement('button');
  btnReset.type = 'button';
  btnReset.textContent = 'Reset';
  btnReset.onclick = () => {
    form.reset();
    state.mode = 'insert';
    state.editingPkValue = null;
    btnSubmit.textContent = 'Inserisci';
  };

  actions.append(btnSubmit, btnReset);
  form.appendChild(actions);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const payload = collectAndValidateForm(form, state.schema);
    if (payload === null) return;

    let url = `/api/rows/${state.currentTable}`;
    let method = 'POST';
    if (state.mode === 'update' && state.editingPkValue != null) {
      url = `/api/rows/${state.currentTable}/${state.editingPkValue}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Errore: ' + (data.error || ''));
      return;
    }

    form.reset();
    state.mode = 'insert';
    state.editingPkValue = null;
    btnSubmit.textContent = 'Inserisci';
    await loadRows(state.currentTable);
  };

  const $formArea = document.getElementById('form-area');
  $formArea.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Nuovo inserimento / Modifica';
  $formArea.append(title, form);
}

function editRow(row) {
  const pk = state.schema.columns.find(c => c.pk === 1)?.name || 'id';
  state.mode = 'update';
  state.editingPkValue = row[pk];

  const form = document.getElementById('upsert-form');
  for (const c of state.schema.columns) {
    if (c.pk) continue;
    const el = form.querySelector(`[name="${c.name}"]`);
    if (!el) continue;
    const val = row[c.name];
    if (el.tagName === 'SELECT') el.value = val ?? '';
    else el.value = val ?? '';
  }
  form.querySelector('button[type="submit"]').textContent = 'Aggiorna';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRow(row) {
  const pk = state.schema.columns.find(c => c.pk === 1)?.name || 'id';
  if (!confirm(`Eliminare la riga con ${pk}=${row[pk]}?`)) return;

  const res = await fetch(`/api/rows/${state.currentTable}/${row[pk]}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    alert('Errore: ' + (data.error || ''));
    return;
  }

  await loadRows(state.currentTable);
}
