// Entry point: server Express che serve la SPA statica (public/) e le API
// REST generiche sotto /api (vedi routes/). Tool locale mono-utente, senza
// autenticazione — non esporre questo server oltre a localhost.
const express = require('express');
const path = require('path');
const { sendError } = require('./db/errors');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', require('./routes/tables'));
app.use('/api', require('./routes/rows'));
app.use('/api', require('./routes/csv'));
app.use('/api', require('./routes/backup'));
app.use('/api', require('./routes/psetMatrix'));
app.use('/api', require('./routes/codicePsetMatrix'));

// Error handler di ultima istanza: cattura gli errori che non passano dal
// try/catch di una route (es. multer che rifiuta un file non-CSV nel suo
// fileFilter, che chiama next(err) prima ancora di entrare nella route),
// così anche quelli tornano al client come JSON invece che come pagina di
// errore HTML di Express.
app.use((err, req, res, next) => {
  sendError(res, 400, err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server su http://localhost:${PORT}`));
