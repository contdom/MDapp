# bim-app — BIM Data Manager (SQLite)

Tool interno per amministrare un database SQLite di parametri e Property Set
BIM secondo lo standard **RFI** (Rete Ferroviaria Italiana): codici, pset,
parametri, fasi progettuali e loro legami.

**Uso previsto:** solo localhost, mono-utente. Non c'è autenticazione: non
esporre questo server oltre a `localhost`.

## Avvio

```
npm install
npm run dev    # con auto-reload (nodemon)
npm start      # senza auto-reload
```

Il server legge il database da `data/MODELLO_DATI.db` e si avvia su
`http://localhost:3000` (porta configurabile con la variabile d'ambiente
`PORT`). Se il file DB non esiste, il server si rifiuta di partire.

```
npm test        # test automatici (node --test)
```

## Struttura del progetto

```
server.js              Entry point Express: monta le route e serve public/
db/
  index.js              Connessione SQLite condivisa + sanitizeIdentifier/getTableInfo
  labels.js              Risoluzione della colonna "etichetta" per le foreign key
  errors.js               Helper di risposta errore condiviso dalle route
routes/
  tables.js               GET /tables, /schema/:table, /ref/:table/:column
  rows.js                  CRUD generico su una tabella: GET/POST/PUT/DELETE /rows/:table
  csv.js                    POST /import/:table — import CSV dentro una tabella
  backup.js                 POST /backup — snapshot del DB su data/backups/
  psetMatrix.js              Matrice Pset × Fase per rfi_pset_parametri
  codicePsetMatrix.js         Matrice Codice × Fase per rfi_codice_pset
public/
  index.html               Markup della SPA
  js/app.js                  Entry point frontend, inizializza i 3 moduli sotto
  js/crud.js                  CRUD generico guidato dallo schema (tabella + form)
  js/matrix.js                 UI matrice Pset-Parametri
  js/codiceMatrix.js            UI matrice Codice-Pset (drag & drop)
  js/utils.js                    Funzioni di supporto condivise
tests/                    Test con il runner nativo di Node (node --test)
data/                     Database SQLite + backup (non versionati in git)
```

## Come funziona il CRUD generico

Le route in `routes/rows.js` e `routes/tables.js` non conoscono lo schema in
anticipo: usano `PRAGMA table_info`/`PRAGMA foreign_key_list` per scoprirlo a
runtime (`db/index.js:getTableInfo`). Il frontend (`public/js/crud.js`) fa lo
stesso lato client: legge `/api/schema/:table`, e per ogni foreign key
recupera le opzioni leggibili da `/api/ref/:table/:column`. Aggiungere una
nuova tabella al database la rende quindi immediatamente gestibile dalla UI,
senza toccare il codice — a patto che rispetti le convenzioni SQLite standard
(chiave primaria, foreign key dichiarate).

Il nome di tabella arriva sempre dal client (parte dell'URL): va **sempre**
validato con `sanitizeIdentifier` (`db/index.js`) prima di essere interpolato
in una query, perché SQLite non accetta i nomi di tabella/colonna come
parametri bind.

## Schema principale del DB

Tabelle di dominio (namespace `rfi_*`, standard RFI):

- `rfi_pset` — Property Set
- `rfi_parametri` — parametri, con colonna etichetta `nome_parametro`
- `rfi_fase` — fasi progettuali, ordinate da `ordine`
- `rfi_codice` — codici
- `unita_misura` — unità di misura, con colonna etichetta `simbolo`
- `rfi_pset_parametri` — legame N:N Pset↔Parametro↔Fase
- `rfi_codice_pset` — legame N:N Codice↔Pset↔Fase

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/tables` | Elenco tabelle del DB |
| GET | `/api/schema/:table` | Colonne + foreign key di una tabella |
| GET | `/api/ref/:table/:column` | Opzioni `{id,label}` per una colonna FK |
| GET | `/api/rows/:table` | Righe (filtro `q`, paginazione `limit`/`offset`) |
| POST | `/api/rows/:table` | Inserisce una riga |
| PUT | `/api/rows/:table/:id` | Aggiorna una riga |
| DELETE | `/api/rows/:table/:id` | Elimina una riga |
| POST | `/api/import/:table` | Import CSV (`multipart/form-data`, campo `file`) |
| POST | `/api/backup` | Crea uno snapshot del DB in `data/backups/` |
| GET | `/api/pset-parametri-matrix` | Matrice Pset-Parametri-Fase |
| POST | `/api/pset-parametri-matrix` | Aggiorna la matrice (batch di toggle) |
| GET | `/api/codice-pset-matrix` | Matrice Codice-Pset-Fase |
| POST | `/api/codice-pset-add` | Aggiunge un pset a una cella codice/fase |
| DELETE | `/api/codice-pset-remove` | Rimuove un pset da una cella codice/fase |
