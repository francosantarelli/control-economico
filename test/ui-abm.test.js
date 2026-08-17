import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

describe('ABM: Centros de costo', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'centros';
    win.render();
  });

  it('agrega un centro nuevo (código en mayúsculas)', async () => {
    win.document.getElementById('f-centro-codigo').value = 'mp';
    win.document.getElementById('f-centro-nombre').value = 'Mercado Pago';
    await win.handleAction('save-centro', '');
    expect(win.STATE.centros).toHaveLength(3);
    const nuevo = win.STATE.centros.find(c => c.nombre === 'Mercado Pago');
    expect(nuevo.codigo).toBe('MP'); // se normaliza a mayúsculas
    expect(sbMock.calls[0].op).toBe('insert');
  });

  it('no agrega nada si falta código o nombre', async () => {
    win.document.getElementById('f-centro-codigo').value = '';
    win.document.getElementById('f-centro-nombre').value = 'Sin código';
    await win.handleAction('save-centro', '');
    expect(win.STATE.centros).toHaveLength(2);
    expect(sbMock.calls).toHaveLength(0);
  });

  it('edita un centro existente', async () => {
    win.handleAction('edit-centro', 'c-ef');
    expect(win.document.getElementById('f-centro-codigo').value).toBe('EF');
    win.document.getElementById('f-centro-nombre').value = 'Efectivo Franco (renombrado)';
    await win.handleAction('save-centro', 'c-ef');
    expect(win.STATE.centros.find(c => c.id === 'c-ef').nombre).toBe('Efectivo Franco (renombrado)');
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'centros', val: 'c-ef' });
  });

  it('borra un centro tras confirmar', async () => {
    win.handleAction('del-centro', 'c-ef');
    expect(win.STATE.confirmState).toBeTruthy();
    await win.handleAction('confirm-yes');
    expect(win.STATE.centros.find(c => c.id === 'c-ef')).toBeUndefined();
    expect(sbMock.calls[0]).toMatchObject({ op: 'delete', table: 'centros', val: 'c-ef' });
  });
});

describe('ABM: Categorías', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'categorias';
    win.render();
  });

  it('agrega una categoría normal (checkbox TEC destildado -> tipo vacío)', async () => {
    win.document.getElementById('f-categoria-nombre').value = 'Entretenimiento';
    await win.handleAction('save-categoria', '');
    const nueva = win.STATE.categorias.find(c => c.nombre === 'Entretenimiento');
    expect(nueva.tipo).toBe('');
  });

  it('agrega una categoría de tipo TEC cuando se tilda el checkbox', async () => {
    win.document.getElementById('f-categoria-nombre').value = 'Otra transferencia';
    win.document.getElementById('f-categoria-es-tec').checked = true;
    await win.handleAction('save-categoria', '');
    const nueva = win.STATE.categorias.find(c => c.nombre === 'Otra transferencia');
    expect(nueva.tipo).toBe('tec');
  });

  it('borrar una categoría también borra sus subcategorías en STATE (ON DELETE CASCADE en la base)', async () => {
    win.handleAction('del-categoria', 'cat-super');
    await win.handleAction('confirm-yes');
    expect(win.STATE.categorias.find(c => c.id === 'cat-super')).toBeUndefined();
    expect(win.STATE.subcategorias.find(s => s.categoriaId === 'cat-super')).toBeUndefined();
  });
});

describe('ABM: Subcategorías', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'subcategorias';
    win.render();
  });

  it('se listan ordenadas por Categoría y después por Subcategoría, alfabéticamente', () => {
    win.STATE.categorias.push({ id: 'cat-auto', nombre: 'Auto', tipo: 'normal' });
    win.STATE.subcategorias = [
      { id: 's1', categoriaId: 'cat-super', nombre: 'Verduleria' },
      { id: 's2', categoriaId: 'cat-auto', nombre: 'Nafta' },
      { id: 's3', categoriaId: 'cat-super', nombre: 'Carniceria' }
    ];
    win.render();
    const filas = Array.from(win.document.querySelectorAll('table tbody tr'))
      .filter(tr => tr.querySelector('[data-action="edit-subcategoria"]'));
    const pares = filas.map(tr => Array.from(tr.querySelectorAll('td')).slice(0, 2).map(td => td.textContent.trim()));
    expect(pares).toEqual([
      ['Auto', 'Nafta'],
      ['Supermercado', 'Carniceria'],
      ['Supermercado', 'Verduleria']
    ]);
  });

  it('agrega una subcategoría nueva bajo la categoría elegida', async () => {
    win.document.getElementById('f-sub-categoria').value = 'cat-suel';
    win.document.getElementById('f-sub-nombre').value = 'Aguinaldo';
    await win.handleAction('save-subcategoria', '');
    const nueva = win.STATE.subcategorias.find(s => s.nombre === 'Aguinaldo');
    expect(nueva.categoriaId).toBe('cat-suel');
  });

  it('editar precarga el select de Categoría con el valor correcto (fix del bug de "selected" en innerHTML)', () => {
    win.handleAction('edit-subcategoria', 'sub-verd');
    expect(win.document.getElementById('f-sub-categoria').value).toBe('cat-super');
    expect(win.document.getElementById('f-sub-nombre').value).toBe('Verduleria');
  });

  it('borrar una subcategoría sin movimientos asociados no pide reasignación', async () => {
    win.handleAction('del-subcategoria', 'sub-carn');
    expect(win.STATE.subDeleteState.afectados).toBe(0);
    await win.handleAction('sub-delete-confirmar');
    expect(win.STATE.subcategorias.find(s => s.id === 'sub-carn')).toBeUndefined();
  });

  it('borrar una subcategoría CON movimientos asociados exige elegir a qué reasignarlos', async () => {
    win.STATE.movimientos = [{ id: 'm1', fecha: '2026-01-01', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd', proveedor: 'X', ingreso: 0, egreso: 10 }];
    win.handleAction('del-subcategoria', 'sub-verd');
    expect(win.STATE.subDeleteState.afectados).toBe(1);
    win.render();
    const reasignarSel = win.document.getElementById('sub-delete-reasignar');
    reasignarSel.value = 'sub-carn';
    await win.handleAction('sub-delete-confirmar');
    expect(win.STATE.movimientos[0].subcategoriaId).toBe('sub-carn');
    expect(win.STATE.subcategorias.find(s => s.id === 'sub-verd')).toBeUndefined();
  });
});
