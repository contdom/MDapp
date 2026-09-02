/**
 * Logga l'errore reale in console (utile per debug locale) e risponde
 * al client con lo stesso messaggio in JSON. Tool mono-utente su
 * localhost: qui il valore è centralizzare il logging ed eliminare la
 * duplicazione dei blocchi try/catch nelle route, non nascondere i
 * dettagli — se l'app dovesse mai essere esposta oltre localhost, questo
 * è il punto in cui sostituire err.message con un messaggio generico.
 */
function sendError(res, status, err) {
  console.error(err);
  res.status(status).json({ error: err.message });
}

module.exports = { sendError };
