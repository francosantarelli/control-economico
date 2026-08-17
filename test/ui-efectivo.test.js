import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Test de regresión del bug reportado por el usuario: "al ingresar el importe se borran
// proveedor y detalle" en el modal de Cargar efectivo. La causa real era que esos campos no
// tenían respaldo en STATE, así que cualquier re-render del modal (al elegir Categoría, o si
// fallaba la validación) los recreaba vacíos. Fix: STATE.efectivoDraft.
describe('Modal de Cargar efectivo', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.handleAction('abrir-efectivo');
  });

  it('conserva Monto/Proveedor/Detalle al elegir una Categoría (repro exacto del bug reportado)', () => {
    win.document.getElementById('ef-monto').value = '1500.50';
    win.document.getElementById('ef-proveedor').value = 'Kiosco Don Jose';
    win.document.getElementById('ef-detalle').value = 'Compra varios';

    const catSel = win.document.getElementById('ef-categoria');
    catSel.value = 'cat-super';
    catSel.dispatchEvent(new win.Event('change', { bubbles: true }));

    expect(win.document.getElementById('ef-monto').value).toBe('1500.50');
    expect(win.document.getElementById('ef-proveedor').value).toBe('Kiosco Don Jose');
    expect(win.document.getElementById('ef-detalle').value).toBe('Compra varios');
  });

  it('conserva los campos si falla la validación (falta fecha o monto)', async () => {
    win.document.getElementById('ef-fecha').value = ''; // fuerza el error de validación
    win.document.getElementById('ef-proveedor').value = 'Kiosco Don Jose';
    win.document.getElementById('ef-detalle').value = 'Compra varios';
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.efectivoMsg).toMatch(/completá/i);
    expect(win.document.getElementById('ef-proveedor').value).toBe('Kiosco Don Jose');
    expect(win.document.getElementById('ef-detalle').value).toBe('Compra varios');
  });

  it('guarda un movimiento de egreso correctamente y cierra el modal', async () => {
    win.document.getElementById('ef-fecha').value = '2026-07-10';
    win.document.getElementById('ef-centro').value = 'c-ef';
    win.document.getElementById('ef-monto').value = '2500';
    win.document.getElementById('ef-proveedor').value = 'Kiosco';
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.efectivoAbierto).toBe(false);
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0].egreso).toBe(2500);
    expect(win.STATE.movimientos[0].proveedor).toBe('Kiosco');
    expect(sbMock.calls[0].op).toBe('insert');
    expect(sbMock.calls[0].table).toBe('movimientos');
  });

  it('un ingreso se guarda en la columna ingreso, no egreso', async () => {
    win.document.getElementById('ef-fecha').value = '2026-07-10';
    win.document.getElementById('ef-tipo').value = 'ingreso';
    win.document.getElementById('ef-monto').value = '1000';
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.movimientos[0].ingreso).toBe(1000);
    expect(win.STATE.movimientos[0].egreso).toBe(0);
  });

  it('"Cancelar" descarta el draft: reabrir el modal no arrastra lo tipeado antes', () => {
    win.document.getElementById('ef-proveedor').value = 'Algo que no debería quedar';
    win.handleAction('cerrar-efectivo');
    win.handleAction('abrir-efectivo');
    expect(win.document.getElementById('ef-proveedor').value).toBe('');
  });
});
