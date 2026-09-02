// CRUD generico: legge lo schema di una tabella via /api/schema e costruisce
// dinamicamente tabella e (in modalità modifica) select/input, senza sapere
// nulla in anticipo sulle colonne. Le foreign key vengono risolte in "id →
// label leggibile" qui lato client (state.fkMap, via /api/ref), non dal
// server: così le stesse /api/rows restano generiche per qualunque tabella.
import { inputTypeFor, updatePager } from "./utils.js";
import { toast } from "./notify.js";

let state = {
  tables: [],
  currentTable: null,
  schema: null,
  fkMap: {}, // { colName: { options:[{id,label}] } }
  rows: [], // cache dell'ultima risposta di /api/rows, per ri-renderizzare senza rifetchare
  q: "",
  limit: 50,
  offset: 0,
  total: 0,
};

let editMode = false;
// pendingChanges è condiviso da tutte le tabelle: va sempre svuotato
// esplicitamente al cambio tabella o all'uscita da edit mode, altrimenti una
// modifica non salvata sulla tabella A rischia di essere applicata per
// errore alla tabella B (stesso pk, tabella diversa).
let pendingChanges = []; // { type:'update'|'insert', pk, data:{} }
let insertCounter = 0;

export function initCrud() {
  loadTables();
  bindToolbar();
  bindBackup();
  bindCsvImport();
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
      li.onclick = () => selectTable(t, li);
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

  const btnClear = document.createElement("button");
  btnClear.id = "btn-clear-filter";
  btnClear.className = "btn-ghost";
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
  btnToggle.className = "btn-secondary";
  btnToggle.textContent = "✏️ Modifica tabella";
  btnToggle.onclick = () => {
    if (!state.currentTable) {
      toast("Seleziona prima una tabella", "info");
      return;
    }
    if (
      editMode &&
      pendingChanges.length &&
      !confirm(
        `Hai ${pendingChanges.length} modifica/e non salvata/e. Uscire dalla modalità modifica le scarta. Continuare?`
      )
    ) {
      return;
    }
    editMode = !editMode;
    if (!editMode) {
      pendingChanges = [];
      updateUnsavedBadge();
    }
    refreshEditToggleButton();
    document.getElementById("save-changes").style.display = editMode ? "inline-flex" : "none";
    document.getElementById("add-row").style.display = editMode ? "inline-flex" : "none";
    renderRows(state.rows);
  };
  document.querySelector("#table-header").appendChild(btnToggle);

  // save button
  const btnSave = document.createElement("button");
  btnSave.id = "save-changes";
  btnSave.className = "btn-primary";
  btnSave.textContent = "💾 Salva modifiche";
  btnSave.style.display = "none";
  btnSave.onclick = saveChanges;
  document.querySelector("#table-header").appendChild(btnSave);

  // add-row button (visibile solo in edit mode)
  const btnAddRow = document.createElement("button");
  btnAddRow.id = "add-row";
  btnAddRow.className = "btn-secondary";
  btnAddRow.textContent = "➕ Aggiungi riga";
  btnAddRow.style.display = "none";
  btnAddRow.onclick = addNewRow;
  document.querySelector("#table-header").appendChild(btnAddRow);

  // badge modifiche non salvate
  const badge = document.createElement("span");
  badge.id = "unsaved-badge";
  badge.className = "unsaved-badge";
  badge.style.display = "none";
  document.querySelector("#table-header").appendChild(badge);
}

function bindBackup() {
  document.getElementById("btn-backup").onclick = async () => {
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      toast(`Backup creato: ${data.backup}`, "success");
    } catch (err) {
      toast(`Errore backup: ${err.message}`, "error");
    }
  };
}

function bindCsvImport() {
  document.getElementById("csv-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentTable) return;

    const fileInput = document.getElementById("csv-file");
    const file = fileInput.files[0];
    if (!file) {
      toast("Seleziona prima un file CSV.", "info");
      return;
    }

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch(`/api/import/${state.currentTable}`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      toast(`Importate ${data.inserted} righe.`, "success");
      fileInput.value = "";
      await loadRows(state.currentTable);
    } catch (err) {
      toast(`Errore import CSV: ${err.message}`, "error");
    }
  });
}

async function selectTable(table, liEl) {
  if (table === state.currentTable) return;

  if (
    pendingChanges.length &&
    !confirm(
      `Hai ${pendingChanges.length} modifica/e non salvata/e su "${state.currentTable}". Cambiare tabella le scarta. Continuare?`
    )
  ) {
    return;
  }
  pendingChanges = [];
  updateUnsavedBadge();

  state.currentTable = table;
  state.offset = 0;
  state.q = "";
  const $search = document.getElementById("search");
  if ($search) $search.value = "";

  document.getElementById("current-table").textContent = table;
  document.getElementById("refresh").disabled = false;
  document.getElementById("csv-upload").disabled = false;

  document.querySelectorAll("#tables li").forEach((li) => li.classList.remove("active"));
  if (liEl) liEl.classList.add("active");

  if (editMode) {
    editMode = false;
    refreshEditToggleButton();
    document.getElementById("save-changes").style.display = "none";
    document.getElementById("add-row").style.display = "none";
  }

  setLoading(true);
  await loadSchema(table);
  await loadRows(table);
}

async function loadSchema(table) {
  const res = await fetch(`/api/schema/${table}`);
  state.schema = await res.json();
  state.fkMap = {};

  // le opzioni di ogni FK sono indipendenti tra loro: le carichiamo in
  // parallelo invece che una alla volta per non sommare le latenze.
  const entries = await Promise.all(
    state.schema.foreignKeys.map((fk) =>
      fetch(`/api/ref/${table}/${fk.from}`)
        .then((r) => r.json())
        .then((ref) => [fk.from, ref])
    )
  );
  for (const [col, ref] of entries) state.fkMap[col] = ref;
}

async function loadRows(table) {
  setLoading(true);
  const params = new URLSearchParams({
    limit: state.limit,
    offset: state.offset,
  });
  if (state.q) params.set("q", state.q);

  const res = await fetch(`/api/rows/${table}?${params.toString()}`);
  const data = await res.json();
  state.total = data.total || 0;
  state.rows = data.rows || [];

  renderRows(state.rows);
  updatePager(state.offset, state.limit, state.total);
}

function refreshEditToggleButton() {
  const btn = document.getElementById("toggle-edit");
  if (!btn) return;
  btn.textContent = editMode ? "✅ Fine modifica" : "✏️ Modifica tabella";
  btn.classList.toggle("is-active", editMode);
}

function setLoading(isLoading) {
  if (!isLoading) return;
  document.getElementById("rows").innerHTML = '<div class="loading">Caricamento…</div>';
}

function humanize(name) {
  return name
    .replace(/_id$/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

  // Renderizza in `td` un input o una select (per le FK), condiviso sia
  // dalle righe esistenti in modifica sia dalle righe nuove non ancora
  // salvate — stessa logica, valore iniziale e callback diversi.
  function renderEditableCell(td, col, currentValue, onChange) {
    if (fkCols.has(col) && state.fkMap[col]) {
      const select = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "--";
      select.appendChild(empty);

      state.fkMap[col].options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.id;
        o.textContent = `${opt.label} (${opt.id})`;
        if (opt.label === currentValue || String(opt.id) === String(currentValue)) o.selected = true;
        select.appendChild(o);
      });

      select.onchange = () => onChange(select.value);
      td.appendChild(select);
    } else {
      const input = document.createElement("input");
      const colDef = state.schema.columns.find((c) => c.name === col);
      input.type = inputTypeFor(colDef?.type);
      input.value = currentValue ?? "";
      input.onchange = () => onChange(input.value);
      td.appendChild(input);
    }
  }

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const c of cols) {
    const th = document.createElement("th");
    th.textContent = humanize(c);
    th.title = c; // nome colonna tecnico, per chi conosce lo schema
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
        renderEditableCell(td, c, rawVal, (value) => markChange("update", r[pkCol], c, value));
      } else {
        if (fkCols.has(c) && state.fkMap[c]) {
          const opt = state.fkMap[c].options.find((o) => o.label === rawVal || String(o.id) === String(rawVal));
          if (opt) {
            td.textContent = opt.label;
            td.title = `ID: ${opt.id}`;
          } else {
            td.textContent = rawVal ?? "";
          }
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
      btnDel.title = "Elimina riga";
      btnDel.setAttribute("aria-label", "Elimina riga");
      btnDel.className = "btn-icon btn-danger";
      btnDel.onclick = () => deleteRow(r[pkCol]);
      tdAct.appendChild(btnDel);
      tr.appendChild(tdAct);
    }

    tbody.appendChild(tr);
  }

  // righe nuove non ancora salvate (pendingChanges di tipo 'insert')
  if (editMode) {
    for (const draft of pendingChanges.filter((c) => c.type === "insert")) {
      const tr = document.createElement("tr");
      tr.className = "draft-row";
      for (const c of cols) {
        const td = document.createElement("td");
        if (c === pkCol) {
          td.textContent = "(auto)";
          td.className = "muted";
        } else {
          renderEditableCell(td, c, draft.data[c], (value) => {
            draft.data[c] = value;
          });
        }
        tr.appendChild(td);
      }
      const tdAct = document.createElement("td");
      const btnCancel = document.createElement("button");
      btnCancel.textContent = "✖";
      btnCancel.title = "Annulla nuova riga";
      btnCancel.setAttribute("aria-label", "Annulla nuova riga");
      btnCancel.className = "btn-icon btn-ghost";
      btnCancel.onclick = () => {
        pendingChanges = pendingChanges.filter((c) => c !== draft);
        updateUnsavedBadge();
        renderRows(state.rows);
      };
      tdAct.appendChild(btnCancel);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  $rows.innerHTML = "";
  $rows.appendChild(table);
}

function addNewRow() {
  if (!state.currentTable || !state.schema) return;
  const tempId = `__new_${++insertCounter}`;
  pendingChanges.push({ type: "insert", pk: tempId, data: {} });
  updateUnsavedBadge();
  renderRows(state.rows);
}

function updateUnsavedBadge() {
  const badge = document.getElementById("unsaved-badge");
  if (!badge) return;
  if (pendingChanges.length) {
    badge.textContent = `${pendingChanges.length} modifica/e non salvata/e`;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

function markChange(type, pk, col, value) {
  let change = pendingChanges.find((c) => c.type === type && c.pk === pk);
  if (!change) {
    change = { type, pk, data: {} };
    pendingChanges.push(change);
  }
  change.data[col] = value;
  updateUnsavedBadge();
}

async function deleteRow(pk) {
  if (!confirm(`Eliminare la riga con ID=${pk}?`)) return;
  try {
    const res = await fetch(`/api/rows/${state.currentTable}/${pk}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
    toast("Riga eliminata", "success");
    await loadRows(state.currentTable);
  } catch (err) {
    toast(`Errore delete: ${err.message}`, "error");
  }
}

async function saveChanges() {
  const failures = [];

  for (const ch of pendingChanges) {
    try {
      if (ch.type === "update") {
        const res = await fetch(`/api/rows/${state.currentTable}/${ch.pk}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ch.data),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      } else if (ch.type === "insert") {
        const hasValues = Object.values(ch.data).some((v) => v !== null && v !== "" && v !== undefined);
        if (!hasValues) continue; // riga aggiunta ma lasciata vuota: scartata senza errore
        const res = await fetch(`/api/rows/${state.currentTable}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ch.data),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      }
    } catch (err) {
      failures.push(err.message);
    }
  }

  pendingChanges = [];
  updateUnsavedBadge();
  await loadRows(state.currentTable);

  if (failures.length) {
    toast(`Alcune modifiche non sono state salvate: ${failures.join("; ")}`, "error", 7000);
  } else {
    toast("Modifiche salvate", "success");
  }
}
