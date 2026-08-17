import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

describe('Vencimientos', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'vencimientos';
    win.render();
  });

  it('valida concepto y fecha obligatorios', async () => {
    win.document.getElementById('f-venc-concepto').value = '';
    win.document.getElementById('f-venc-fecha').value = '';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencFormMsg).toMatch(/completá/i);
    expect(win.STATE.vencimientos).toHaveLength(0);
  });

  it('agrega un vencimiento nuevo, con estado "pendiente" por defecto', async () => {
    win.document.getElementById('f-venc-concepto').value = 'Tarjeta Visa';
    win.document.getElementById('f-venc-fecha').value = '2026-08-20';
    win.document.getElementById('f-venc-monto').value = '150000';
    win.document.getElementById('f-venc-centro').value = 'c-ef';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencimientos).toHaveLength(1);
    expect(win.STATE.vencimientos[0]).toMatchObject({ concepto: 'Tarjeta Visa', monto: 150000, estado: 'pendiente' });
  });

  it('"marcar pagado" / "marcar pendiente" alternan el estado y persisten via update', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('toggle-venc-estado', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'vencimientos', val: 'v1' });
    await win.handleAction('toggle-venc-estado', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pendiente');
  });

  it('"cargar como movimiento" crea un egreso a partir del vencimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('venc-a-movimiento', 'v1');
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Luz', egreso: 5000, centroId: 'c-ef' });
  });

  it('borra un vencimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    win.handleAction('del-venc', 'v1');
    await win.handleAction('confirm-yes');
    expect(win.STATE.vencimientos).toHaveLength(0);
  });

  it('un movimiento con fecha futura aparece en la lista de pendientes de Vencimientos', () => {
    const restore = mockNow(win, '2026-07-31T12:00:00');
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-09-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Cuota 2/3 Heladera', ingreso: 0, egreso: 30000, tarjeta: true },
      { id: 'm2', fecha: '2026-06-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Ya pasó', ingreso: 0, egreso: 100 }
    ];
    win.render();
    const html = win.document.getElementById('app').innerHTML;
    expect(html).toContain('Cuota 2/3 Heladera');
    expect(html).not.toContain('Ya pasó');
    restore();
  });
});
