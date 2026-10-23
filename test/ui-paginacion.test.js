import { describe, it, expect } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

function cargarMovs(win, n) {
  win.STATE.movimientos = [];
  for (let i = 0; i < n; i++) {
    win.STATE.movimientos.push({
      id: 'm' + i, fecha: '2020-01-01', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: '',
      proveedor: 'Prov ' + i, detalle: '', ingreso: 0, egreso: 10
    });
  }
}

describe('Paginación de Movimientos: registros por página', () => {
  it('el selector cambia cuántas filas se ven, vuelve a la página 1 y recuerda la elección', () => {
    const win = loadApp();
    seedBase(win);
    cargarMovs(win, 120);
    win.STATE.activeTab = 'movimientos';
    win.STATE.movPaginaActual = 2;
    win.render();

    const sel = win.document.getElementById('mov-por-pagina');
    expect(sel).toBeTruthy();
    expect(sel.value).toBe('50');

    sel.value = '100';
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));

    expect(win.STATE.movPorPagina).toBe(100);
    expect(win.STATE.movPaginaActual).toBe(1);
    expect(win.document.getElementById('mov-por-pagina').value).toBe('100');
    expect(win.document.querySelectorAll('#tabla-movimientos tbody tr').length).toBe(100);
    expect(win.localStorage.getItem('controlMovPorPagina')).toBe('100');
  });
});
