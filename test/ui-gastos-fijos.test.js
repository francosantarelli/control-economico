import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

const club = () => ({ id: 'g1', concepto: 'Cuota club', tipo: 'club', monto: 25000, diaVencimiento: 10, centroId: 'c-ef', desde: '2026-01', hasta: '' });
const pago = (extra = {}) => ({ id: 'p1', gastoFijoId: 'g1', periodo: '2026-10', fecha: '2026-10-08', monto: 25000, movimientoId: '', ...extra });

describe('Vencimientos: sector Gastos fijos', () => {
  let win, sbMock, restoreNow;
  beforeEach(() => {
    win = loadApp();
    restoreNow = mockNow(win, '2026-10-05T12:00:00');
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.gastosFijos = [];
    win.STATE.gastosFijosPagos = [];
    win.STATE.gfPeriodo = '2026-10';
    win.STATE.activeTab = 'vencimientos';
    win.render();
  });
  afterEach(() => restoreNow());
  const html = () => win.document.getElementById('app').innerHTML;
  const $ = (id) => win.document.getElementById(id);

  function tildarGastoFijo() {
    const chk = $('f-venc-es-fijo');
    chk.checked = true;
    chk.dispatchEvent(new win.Event('change'));
  }

  it('el sector aparece en Vencimientos aunque no haya gastos fijos cargados', () => {
    expect(html()).toContain('Gastos fijos (0)');
    expect(html()).toContain('Octubre 2026');
  });

  it('tildar "Es un gasto fijo" muestra el Tipo sin perder lo tipeado', () => {
    expect($('f-venc-tipo')).toBeNull();
    $('f-venc-concepto').value = 'Biblioteca Popular';
    tildarGastoFijo();
    expect($('f-venc-tipo')).toBeTruthy();
    expect($('f-venc-concepto').value).toBe('Biblioteca Popular');
    expect(html()).toContain('Primer vencimiento');
  });

  it('el alta con el tilde crea un gasto fijo (no un vencimiento) con el día y el mes de la fecha', async () => {
    $('f-venc-concepto').value = 'Biblioteca Popular';
    tildarGastoFijo();
    $('f-venc-fecha').value = '2026-10-15';
    $('f-venc-monto').value = '3000';
    $('f-venc-centro').value = 'c-ea';
    $('f-venc-tipo').value = 'biblioteca';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencimientos).toHaveLength(0);
    expect(win.STATE.gastosFijos).toHaveLength(1);
    expect(win.STATE.gastosFijos[0]).toMatchObject({ concepto: 'Biblioteca Popular', tipo: 'biblioteca', monto: 3000, diaVencimiento: 15, centroId: 'c-ea', desde: '2026-10', hasta: '' });
    expect(sbMock.calls[0]).toMatchObject({ op: 'insert', table: 'gastos_fijos' });
    expect(win.STATE.vencDraft).toBeNull();
    expect(html()).toContain('Gastos fijos (1)');
  });

  it('sin el tilde, el alta sigue creando un vencimiento común', async () => {
    $('f-venc-concepto').value = 'Patente';
    $('f-venc-fecha').value = '2026-11-12';
    $('f-venc-monto').value = '48300';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencimientos).toHaveLength(1);
    expect(win.STATE.gastosFijos).toHaveLength(0);
  });

  it('si el primer vencimiento es de un mes futuro, el sector salta a ese mes', async () => {
    $('f-venc-concepto').value = 'Gimnasio';
    tildarGastoFijo();
    $('f-venc-fecha').value = '2026-12-01';
    await win.handleAction('save-venc', '');
    expect(win.STATE.gfPeriodo).toBe('2026-12');
  });

  it('pagar con movimiento: registra el mes y crea el egreso; el gasto sigue en la lista', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('pagar-gf', 'g1');
    expect(win.STATE.gfPagarState).toMatchObject({ id: 'g1', fecha: '2026-10-05', monto: 25000 });
    $('f-gf-pago-monto').value = '26000';
    await win.handleAction('pagar-gf-con-mov', 'g1');
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Cuota club', egreso: 26000, centroId: 'c-ef', fecha: '2026-10-05' });
    expect(win.STATE.gastosFijosPagos[0]).toMatchObject({ gastoFijoId: 'g1', periodo: '2026-10', monto: 26000, movimientoId: win.STATE.movimientos[0].id });
    expect(win.STATE.gfPagarState).toBeNull();
    expect(html()).toContain('Cuota club');
    expect(html()).toContain('Pagado el 05/10');
    expect(html()).toContain('data-action="desmarcar-gf"');
  });

  it('pagar sin movimiento: solo registra el mes', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('pagar-gf', 'g1');
    await win.handleAction('pagar-gf-sin-mov', 'g1');
    expect(win.STATE.movimientos).toHaveLength(0);
    expect(win.STATE.gastosFijosPagos[0]).toMatchObject({ periodo: '2026-10', monto: 25000, movimientoId: '' });
  });

  it('valida fecha y monto al pagar', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('pagar-gf', 'g1');
    $('f-gf-pago-monto').value = '';
    await win.handleAction('pagar-gf-sin-mov', 'g1');
    expect(win.STATE.gfPagarMsg).toMatch(/completá/i);
    expect(win.STATE.gastosFijosPagos).toHaveLength(0);
  });

  it('en un mes pasado, la fecha propuesta es el vencimiento de ese mes', async () => {
    win.STATE.gastosFijos = [club()];
    await win.handleAction('gf-mes-anterior');
    expect(win.STATE.gfPeriodo).toBe('2026-09');
    await win.handleAction('pagar-gf', 'g1');
    expect(win.STATE.gfPagarState.fecha).toBe('2026-09-10');
  });

  it('el pago es por mes: octubre pagado, noviembre sigue pendiente', async () => {
    win.STATE.gastosFijos = [club()];
    win.STATE.gastosFijosPagos = [pago()];
    win.render();
    expect(html()).toContain('Pagado el 08/10');
    await win.handleAction('gf-mes-siguiente');
    expect(win.STATE.gfPeriodo).toBe('2026-11');
    expect(html()).not.toContain('Pagado el');
    expect(html()).toContain('data-action="pagar-gf"');
    await win.handleAction('gf-mes-actual');
    expect(win.STATE.gfPeriodo).toBe('2026-10');
  });

  it('estado del mes: vencido, vence mañana y pendiente', () => {
    restoreNow();
    restoreNow = mockNow(win, '2026-10-30T12:00:00');
    win.STATE.gastosFijos = [
      club(),
      { ...club(), id: 'g2', concepto: 'Bomberos', diaVencimiento: 31 },
      { ...club(), id: 'g3', concepto: 'Internet', diaVencimiento: 12 }
    ];
    win.STATE.gfPeriodo = '2026-10';
    win.render();
    expect(html()).toContain('Vencido hace 20 día(s)');
    expect(html()).toContain('Vence mañana');
    win.STATE.gfPeriodo = '2026-11';
    win.render();
    expect(html()).toContain('Pendiente · en 13 día(s)');
  });

  it('pendientes primero y pagados después; totales del mes', () => {
    win.STATE.gastosFijos = [club(), { ...club(), id: 'g2', concepto: 'Internet', tipo: 'servicio', monto: 18000, diaVencimiento: 20 }];
    win.STATE.gastosFijosPagos = [pago({ monto: 26000 })];
    win.render();
    const filas = [...win.document.querySelectorAll('[data-action="edit-gf"]')].map(b => b.getAttribute('data-id'));
    expect(filas).toEqual(['g2', 'g1']);
    expect(html()).toContain('Pagado (1)');
    expect(html()).toContain('Falta pagar (1)');
    expect(html()).toContain(win.fmtMonto(44000)); // total: 26.000 pagado + 18.000 estimado
  });

  it('no aparece antes del mes en que empieza', async () => {
    win.STATE.gastosFijos = [{ ...club(), desde: '2026-10' }];
    await win.handleAction('gf-mes-anterior');
    expect(html()).not.toContain('Cuota club');
    expect(html()).toContain('Gastos fijos (0)');
  });

  it('desmarcar borra solo el pago del mes; el movimiento queda', async () => {
    win.STATE.gastosFijos = [club()];
    win.STATE.movimientos = [{ id: 'm1', fecha: '2026-10-08', centroId: 'c-ef', categoriaId: '', proveedor: 'Cuota club', ingreso: 0, egreso: 25000 }];
    win.STATE.gastosFijosPagos = [pago({ movimientoId: 'm1' })];
    win.render();
    await win.handleAction('desmarcar-gf', 'g1');
    expect(win.STATE.confirmState.message).toMatch(/no se borra/);
    await win.handleAction('confirm-yes');
    expect(win.STATE.gastosFijosPagos).toHaveLength(0);
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(sbMock.calls[0]).toMatchObject({ op: 'delete', table: 'gastos_fijos_pagos', val: 'p1' });
  });

  it('editar cambia monto y día para los meses sin pagar', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('edit-gf', 'g1');
    $('f-gf-monto').value = '28000';
    $('f-gf-dia').value = '12';
    await win.handleAction('save-gf', 'g1');
    expect(win.STATE.gastosFijos[0]).toMatchObject({ monto: 28000, diaVencimiento: 12 });
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'gastos_fijos', val: 'g1' });
    expect(win.STATE.editing).toBeNull();
  });

  it('editar valida el día de vencimiento', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('edit-gf', 'g1');
    $('f-gf-dia').value = '40';
    await win.handleAction('save-gf', 'g1');
    expect(win.STATE.gfFormMsg).toMatch(/entre 1 y 31/);
    expect(win.STATE.gastosFijos[0].diaVencimiento).toBe(10);
  });

  it('borrar sin pagos lo elimina', async () => {
    win.STATE.gastosFijos = [club()];
    win.render();
    await win.handleAction('del-gf', 'g1');
    await win.handleAction('confirm-yes');
    expect(win.STATE.gastosFijos).toHaveLength(0);
    expect(sbMock.calls[0]).toMatchObject({ op: 'delete', table: 'gastos_fijos', val: 'g1' });
  });

  it('borrar con pagos lo corta en el último mes pagado y conserva el historial', async () => {
    win.STATE.gastosFijos = [club()];
    win.STATE.gastosFijosPagos = [pago({ id: 'p0', periodo: '2026-09' }), pago()];
    win.render();
    await win.handleAction('del-gf', 'g1');
    expect(win.STATE.confirmState.message).toMatch(/historial/);
    await win.handleAction('confirm-yes');
    expect(win.STATE.gastosFijos[0].hasta).toBe('2026-10');
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'gastos_fijos', fields: { hasta: '2026-10' } });
    expect(html()).toContain('Cuota club'); // octubre está pagado: sigue visible
    await win.handleAction('gf-mes-siguiente');
    expect(html()).not.toContain('Cuota club');
  });

  it('si el mes no tiene el día de vencimiento, vence el último día', () => {
    expect(win.fechaVencGastoFijo({ diaVencimiento: 31 }, '2026-11')).toBe('2026-11-30');
    expect(win.fechaVencGastoFijo({ diaVencimiento: 31 }, '2027-02')).toBe('2027-02-28');
    expect(win.fechaVencGastoFijo({ diaVencimiento: 5 }, '2026-12')).toBe('2026-12-05');
    expect(win.periodoMas('2026-12', 1)).toBe('2027-01');
    expect(win.periodoMas('2026-01', -1)).toBe('2025-12');
  });

  it('un gasto fijo sin pagar que vence mañana aparece en el aviso de vencimientos próximos', () => {
    restoreNow();
    restoreNow = mockNow(win, '2026-10-09T12:00:00');
    win.STATE.gastosFijos = [club()];
    win.STATE.activeTab = 'movimientos';
    win.render();
    expect(html()).toMatch(/Mañana<\/strong> — Cuota club/);
    win.STATE.gastosFijosPagos = [pago()];
    win.render();
    expect(html()).not.toContain('Cuota club');
  });

  it('el aviso también mira el mes siguiente (hoy 31/10, vence el 1/11)', () => {
    restoreNow();
    restoreNow = mockNow(win, '2026-10-31T12:00:00');
    win.STATE.gastosFijos = [{ ...club(), diaVencimiento: 1 }];
    win.STATE.activeTab = 'movimientos';
    win.render();
    expect(html()).toMatch(/Mañana<\/strong> — Cuota club/);
  });
});
