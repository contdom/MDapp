import { inputTypeFor, updatePager } from "./utils.js";

let state = {
  tables: [],
  currentTable: null,
  schema: null,
  fkMap: {}, // { colName: { options:[{id,label}] } }
  q: "",
  limit: 50,
  offset: 0,
  total: 0,
};

let editMode = false;
let pendingChanges = []; // { type:'update'|'insert', pk, data:{} }

export function initCrud() {
  loadTables();
  bindToolbar();
}

async function loadTables() {
  try {
    const res = await fetch("/api/tables");
    if (!res.ok) throw new Error(`Errore ${res.status}`);
    const data = await res.json();
    state.tables = data.tables || [];

    const $tables = document.getElementById("tables");
    $tables.innerHTML = "";
    if (!state.tables.length) {
      $tables.innerHTML = '<li class="error">Nessuna tabella trovata</li>';
      return;
    }

    state.tables.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      li.onclick = () => selectTable(t);
      $tables.appendChild(li);
    });
  } catch (err) {
    console.error("Errore caricamento tabelle:", err);
    const $tables = document.getElementById("tables");
    $tables.innerHTML = '<li class="error">Errore caricamento tabelle</li>';
  }
}

function bindToolbar() {
  const $search = document.getElementById("search");

  document.getElementById("btn-apply-filter").onclick = () => {
    state.q = $search.value.trim();
    state.offset = 0;
    if (state.currentTable) loadRows(state.currentTable);
  };

  // ❌ nuovo bottone elimina filtro
  const btnClear = document.createElement("button");
  btnClear.id = "btn-clear-filter";
  btnClear.textContent = "❌ Rimuovi filtro";
  btnClear.onclick = () => {
    $search.value = "";
    state.q = "";
    state.offset = 0;
    if (state.currentTable) loadRows(state.currentTable);
  };
  document.querySelector(".toolbar").appendChild(btnClear);

  document.getElementById("page-size").onchange = (e) => {
    state.limit = parseInt(e.target.value, 10);
    state.offset = 0;
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById("prev-page").onclick = () => {
    state.offset = Math.max(0, state.offset - state.limit);
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById("next-page").onclick = () => {
    state.offset = Math.min(state.total - 1, state.offset + state.limit);
    if (state.currentTable) loadRows(state.currentTable);
  };

  document.getElementById("refresh").onclick = () => {
    if (state.currentTable) loadRows(state.currentTable);
  };

  // toggle edit mode
  const btnToggle = document.createElement("button");
  btnToggle.id = "toggle-edit";
  btnToggle.textContent = "✏️ Modifica tabella";
  btnToggle.onclick = () => {
    editMode = !editMode;
    document.getElementById("save-changes").style.display = editMode
      ? "inline-block"
      : "none";
    loadRows(state.currentTable);
  };
  document.querySelector("#table-header").appendChild(btnToggle);

  // save button
  const btnSave = document.createElement("button");
  btnSave.id = "save-changes";
  btnSave.textContent = "💾 Salva modifiche";
  btnSave.style.display = "none";
  btnSave.onclick = saveChanges;
  document.querySelector("#table-header").appendChild(btnSave);
}

async function selectTable(table) {
  state.currentTable = table;
  state.offset = 0;
  document.getElementById("current-table").textContent = table;

  await loadSchema(table);
  await loadRows(table);
}

async function loadSchema(table) {
  const res = await fetch(`/api/schema/${table}`);
  state.schema = await res.json();
  state.fkMap = {};

  for (const fk of state.schema.foreignKeys) {
    const ref = await fetch(`/api/ref/${table}/${fk.from}`).then((r) =>
      r.json()
    );
    state.fkMap[fk.from] = ref;
  }
}

async function loadRows(table) {
  const params = new URLSearchParams({
    limit: state.limit,
    offset: state.offset,
  });
  if (state.q) params.set("q", state.q);

  const res = await fetch(`/api/rows/${table}?${params.toString()}`);
  const data = await res.json();
  state.total = data.total || 0;

  renderRows(data.rows || []);
  updatePager(state.offset, state.limit, state.total);
}

function renderRows(rows) {
  const $rows = document.getElementById("rows");
  if (!rows.length && !editMode) {
    $rows.innerHTML = "<div>Nessuna riga trovata.</div>";
    return;
  }

  const cols = state.schema.columns.map((c) => c.name);
  const pkCol = state.schema.columns.find((c) => c.pk === 1)?.name || "id";
  const fkCols = new Set((state.schema.foreignKeys || []).map((f) => f.from));

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const c of cols) {
    const th = document.createElement("th");
    th.textContent = fkCols.has(c) ? c.replace(/_id$/, "") : c;
    trh.appendChild(th);
  }
  if (editMode) {
    const th = document.createElement("th");
    th.textContent = "Azioni";
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const r of rows) {
    const tr = document.createElement("tr");
    for (const c of cols) {
      const td = document.createElement("td");
      const rawVal = r[c];

      if (editMode && c !== pkCol) {
        if (fkCols.has(c) && state.fkMap[c]) {
          const select = document.createElement("select");
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = "--";
          select.appendChild(empty);

          state.fkMap[c].options.forEach((opt) => {
            const o = document.createElement("option");
            o.value = opt.id;
            o.textContent = opt.label;
            if (opt.label === rawVal || String(opt.id) === String(rawVal))
              o.selected = true;
            select.appendChild(o);
          });

          select.onchange = () =>
            markChange("update", r[pkCol], c, select.value);
          td.appendChild(select);
        } else {
          const input = document.createElement("input");
          input.type = inputTypeFor(
            state.schema.columns.find((col) => col.name === c).type
          );
          input.value = rawVal ?? "";
          input.onchange = () => markChange("update", r[pkCol], c, input.value);
          td.appendChild(input);
        }
      } else {
        if (fkCols.has(c) && state.fkMap[c]) {
          const opt = state.fkMap[c].options.find(
            (o) => o.label === rawVal || String(o.id) === String(rawVal)
          );
          td.textContent = opt ? opt.label : rawVal ?? "";
        } else {
          td.textContent = rawVal ?? "";
        }
      }

      tr.appendChild(td);
    }

    if (editMode) {
      const tdAct = document.createElement("td");
      const btnDel = document.createElement("button");
      btnDel.textContent = "🗑️";
      btnDel.onclick = () => deleteRow(r[pkCol]);
      tdAct.appendChild(btnDel);
      tr.appendChild(tdAct);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  $rows.innerHTML = "";
  $rows.appendChild(table);
}

function markChange(type, pk, col, value) {
  let change = pendingChanges.find((c) => c.type === type && c.pk === pk);
  if (!change) {
    change = { type, pk, data: {} };
    pendingChanges.push(change);
  }
  change.data[col] = value;
}

async function deleteRow(pk) {
  if (!confirm(`Eliminare la riga con ID=${pk}?`)) return;
  const res = await fetch(`/api/rows/${state.currentTable}/${pk}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    alert(`Errore delete: ${err.error}`);
  } else {
    await loadRows(state.currentTable);
  }
}

async function saveChanges() {
  for (const ch of pendingChanges) {
    if (ch.type === "update") {
      const res = await fetch(`/api/rows/${state.currentTable}/${ch.pk}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ch.data),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Errore update PK=${ch.pk}: ${err.error}`);
      }
    }
    if (ch.type === "insert") {
      const hasValues = Object.values(ch.data).some(
        (v) => v !== null && v !== ""
      );
      if (!hasValues) continue;
      const res = await fetch(`/api/rows/${state.currentTable}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ch.data),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Errore insert: ${err.error}`);
      }
    }
  }

  pendingChanges = [];
  await loadRows(state.currentTable);
  alert("Modifiche salvate!");
}
