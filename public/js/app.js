import { initCrud } from './crud.js';
import { initMatrix } from './matrix.js';
import { initCodiceMatrix } from './codiceMatrix.js';

document.addEventListener('DOMContentLoaded', () => {
  initCrud();
  initMatrix();
  initCodiceMatrix();
});
