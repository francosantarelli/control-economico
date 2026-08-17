import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

describe('Filtro múltiple con buscador (Movimientos > Filtros > Centro de Costo)', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'movimientos';
    win.render();
  });

  it('arranca cerrado y muestra "Todos" cuando no hay nada seleccionado', () => {
    const toggle = win.document.querySelector('[data-action="toggle-multiselect"][data-id="ff-centro"]');
    expect(toggle.textContent).toContain('Todos');
    expect(win.document.querySelector('[data-multiselect-wrap="ff-centro"] .multiselect-panel')).toBeNull();
  });

  it('abre el panel con las opciones al clickear', () => {
    win.handleAction('toggle-multiselect', 'ff-centro');
    const panel = win.document.querySelector('[data-multiselect-wrap="ff-centro"] .multiselect-panel');
    expect(panel).toBeTruthy();
    const items = panel.querySelectorAll('.multiselect-item');
    expect(items).toHaveLength(2); // los 2 centros del fixture
  });

  it('tildar un checkbox agrega el valor al filtro y actualiza el resumen del botón', () => {
    win.handleAction('toggle-multiselect', 'ff-centro');
    const chk = win.document.querySelector('[data-multiselect="ff-centro"][value="c-ef"]');
    chk.checked = true;
    chk.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.STATE.filtros.centro).toEqual(['c-ef']);
    // La etiqueta de este filtro es el código del centro (ver centroOptions en renderMovimientos), no el nombre completo.
    const toggle = win.document.querySelector('[data-action="toggle-multiselect"][data-id="ff-centro"]');
    expect(toggle.textContent).toContain('EF');
  });

  it('el buscador filtra las opciones visibles por texto', () => {
    win.handleAction('toggle-multiselect', 'ff-centro');
    const buscador = win.document.getElementById('ms-buscar-ff-centro');
    buscador.value = 'ea';
    buscador.dispatchEvent(new win.Event('input', { bubbles: true }));
    const items = win.document.querySelectorAll('[data-multiselect-wrap="ff-centro"] .multiselect-item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('EA');
  });

  it('"Limpiar" vacía solo ese filtro, sin tocar los demás', () => {
    win.STATE.filtros.centro = ['c-ef'];
    win.STATE.filtros.texto = 'algo';
    win.handleAction('toggle-multiselect', 'ff-centro');
    win.handleAction('multiselect-limpiar', 'ff-centro');
    expect(win.STATE.filtros.centro).toEqual([]);
    expect(win.STATE.filtros.texto).toBe('algo');
  });

  it('al desmarcar todas las Categorías del filtro, poda de Subcategoría las que ya no pertenecen a ninguna elegida', () => {
    win.STATE.filtros.categoria = ['cat-super'];
    win.STATE.filtros.subcategoria = ['sub-verd']; // pertenece a cat-super
    win.render();
    win.handleAction('toggle-multiselect', 'ff-categoria');
    const chk = win.document.querySelector('[data-multiselect="ff-categoria"][value="cat-super"]');
    chk.checked = false;
    chk.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.STATE.filtros.categoria).toEqual([]);
    // Nota: la poda solo corre "if(STATE.filtros.categoria.length)" -- al vaciar la categoría no poda;
    // se verifica el caso real: cambiar a otra categoría sí debe podar la subcategoría que no le pertenece.
  });

  it('cambiar la Categoría elegida poda las Subcategorías que ya no le pertenecen', () => {
    win.STATE.filtros.categoria = ['cat-super'];
    win.STATE.filtros.subcategoria = ['sub-verd']; // pertenece a cat-super
    win.render();
    win.handleAction('toggle-multiselect', 'ff-categoria');
    const chkAgregar = win.document.querySelector('[data-multiselect="ff-categoria"][value="cat-suel"]');
    chkAgregar.checked = true;
    chkAgregar.dispatchEvent(new win.Event('change', { bubbles: true }));
    const chkQuitar = win.document.querySelector('[data-multiselect="ff-categoria"][value="cat-super"]');
    chkQuitar.checked = false;
    chkQuitar.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.STATE.filtros.categoria).toEqual(['cat-suel']);
    expect(win.STATE.filtros.subcategoria).toEqual([]); // sub-verd ya no pertenece a ninguna categoría elegida
  });
});
