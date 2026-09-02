// Entry point del frontend: inizializza i tre moduli indipendenti della UI
// (lista tabelle/CRUD generico, matrice pset-parametri, matrice codice-pset).
import { initCrud } from './crud.js';
import { initMatrix } from './matrix.js';
import { initCodiceMatrix } from './codiceMatrix.js';

document.addEventListener('DOMContentLoaded', () => {
  initCrud();
  initMatrix();
  initCodiceMatrix();
});
