import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Tarjeta típica: cierra el 25 y vence el 5 del mes siguiente, se paga desde el centro EF.
function tarjetaVisa(extra) {
  return Object.assign({ id: 't-visa', nombre: 'Visa Nación', banco: 'nacion', marca: 'Visa', centroId: 'c-ef', diaCierre: 25, diaVencimiento: 5, activa: true }, extra);
}
function resumen(extra) {
  return Object.assign({ id: 'r1', tarjetaId: 't-visa', fechaCierre: '2026-10-25', fechaVencimiento: '2026-11-05', totalReal: null, estado: 'abierto' }, extra);
}
function movTarjeta(extra) {
  return Object.assign({
    id: 'm1', fecha: '2026-11-05', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Coto', detalle: '',
    ingreso: 0, egreso: 1000, tarjeta: true, fechaConsumo: '2026-10-10', tarjetaMarca: 'Visa', cuotas: '', tarjetaId: 't-visa', resumenId: 'r1'
  }, extra);
}

let win, sbMock, restoreNow;
beforeEach(() => {
  win = loadApp();
  seedBase(win);
  sbMock = mockSb();
  win.sb = sbMock.client;
  restoreNow = mockNow(win, new win.Date(2026, 9, 15)); // hoy = 2026-10-15
  win.STATE.tarjetas = [tarjetaVisa()];
  win.STATE.resumenesTarjeta = [];
});
afterEach(() => restoreNow());

describe('Tarjetas: cálculo del resumen de un consumo', () => {
  it('el ciclo de un mes cierra el día de cierre y vence el siguiente día de vencimiento', () => {
    const t = tarjetaVisa();
    expect({ ...win.cicloDelMes(t, '2026-10') }).toEqual({ fechaCierre: '2026-10-25', fechaVencimiento: '2026-11-05' });
    // si vence después del día de cierre, vence ese mismo mes
    expect({ ...win.cicloDelMes(tarjetaVisa({ diaCierre: 3, diaVencimiento: 15 }), '2026-10') }).toEqual({ fechaCierre: '2026-10-03', fechaVencimiento: '2026-10-15' });
    // día 31 en un mes de 30: el último día
    expect(win.cicloDelMes(tarjetaVisa({ diaCierre: 31 }), '2026-11').fechaCierre).toBe('2026-11-30');
  });

  it('un consumo hasta el cierre cae en ese resumen; después del cierre, en el del mes siguiente', () => {
    const t = tarjetaVisa();
    expect(win.resumenesParaConsumo(t, '2026-10-25', 1)[0]).toMatchObject({ fechaCierre: '2026-10-25', fechaVencimiento: '2026-11-05', nuevo: true });
    expect(win.resumenesParaConsumo(t, '2026-10-26', 1)[0]).toMatchObject({ fechaCierre: '2026-11-25', fechaVencimiento: '2026-12-05' });
  });

  it('las cuotas van a los resúmenes de los meses siguientes, cruzando el año', () => {
    const rs = win.resumenesParaConsumo(tarjetaVisa(), '2026-11-20', 3);
    expect(rs.map(r => r.fechaVencimiento)).toEqual(['2026-12-05', '2027-01-05', '2027-02-05']);
  });

  it('usa el resumen guardado aunque su cierre real difiera de la estimación', () => {
    // el real cerró el 28 (no el 25): un consumo del 27 entra en ese, no en el de noviembre
    win.STATE.resumenesTarjeta = [resumen({ id: 'r-real', fechaCierre: '2026-10-28', fechaVencimiento: '2026-11-07' })];
    expect(win.resumenesParaConsumo(tarjetaVisa(), '2026-10-27', 1)[0].id).toBe('r-real');
    // el real cerró el 22: un consumo del 23 ya va al siguiente
    win.STATE.resumenesTarjeta = [resumen({ id: 'r-real', fechaCierre: '2026-10-22', fechaVencimiento: '2026-11-04' })];
    const r = win.resumenesParaConsumo(tarjetaVisa(), '2026-10-23', 1)[0];
    expect(r.id).not.toBe('r-real');
    expect(r.fechaCierre).toBe('2026-11-25');
  });

  it('al importar sin cierre, lo estima a partir del vencimiento real y reconoce el resumen ya guardado', () => {
    const t = tarjetaVisa();
    expect({ ...win.resumenParaImportacion(t, '2026-11-06', '') }).toEqual({ existente: null, fechaCierre: '2026-10-25', fechaVencimiento: '2026-11-06' });
    win.STATE.resumenesTarjeta = [resumen()];
    expect(win.resumenParaImportacion(t, '2026-11-07', '').existente.id).toBe('r1');
    expect(win.resumenParaImportacion(t, '2026-11-07', '2026-10-24')).toMatchObject({ fechaCierre: '2026-10-24', fechaVencimiento: '2026-11-07' });
    expect(win.resumenParaImportacion(t, '', '')).toBeNull();
  });
});

describe('Tarjetas: alta de un consumo desde el formulario', () => {
  function abrirFormConTarjeta(valores) {
    win.STATE.activeTab = 'movimientos';
    win.STATE.movDraft = Object.assign({ fecha: '', centroId: '', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Coto', detalle: '', tipo: 'egreso', monto: '1500', tarjeta: true, fechaConsumo: '', tarjetaMarca: '', tarjetaId: 't-visa', cuotas: 1, cuotasInfo: '' }, valores);
    win.handleAction('abrir-nuevo-mov');
    // handleAction limpia el draft al arrancar: se vuelve a poner para que el modal lo muestre
    win.STATE.movDraft = Object.assign({ fecha: '', centroId: '', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Coto', detalle: '', tipo: 'egreso', monto: '1500', tarjeta: true, fechaConsumo: '', tarjetaMarca: '', tarjetaId: 't-visa', cuotas: 1, cuotasInfo: '' }, valores);
    win.render();
  }

  it('con tarjeta elegida, la Fecha se calcula y no se tipea', () => {
    abrirFormConTarjeta({ fechaConsumo: '2026-10-10' });
    const fecha = win.document.getElementById('f-mov-fecha');
    expect(fecha.disabled).toBe(true);
    expect(fecha.value).toBe('2026-11-05');
    expect(win.document.getElementById('f-mov-tarjeta-marca')).toBeNull(); // la marca sale de la tarjeta
  });

  it('pide la fecha de consumo si hay tarjeta elegida', async () => {
    abrirFormConTarjeta({});
    await win.handleAction('save-mov');
    expect(win.STATE.movFieldErrors.fechaConsumo).toBeTruthy();
    expect(sbMock.calls.length).toBe(0);
  });

  it('crea el resumen, toma el centro de la tarjeta y deja la fecha en el vencimiento', async () => {
    abrirFormConTarjeta({ fechaConsumo: '2026-10-10' });
    await win.handleAction('save-mov');
    expect(win.STATE.movFieldErrors).toBeNull();
    expect(win.STATE.resumenesTarjeta).toHaveLength(1);
    const r = win.STATE.resumenesTarjeta[0];
    expect(r).toMatchObject({ fechaCierre: '2026-10-25', fechaVencimiento: '2026-11-05' });
    expect(r.nuevo).toBeUndefined();
    const m = win.STATE.movimientos[0];
    expect(m).toMatchObject({ fecha: '2026-11-05', centroId: 'c-ef', tarjetaId: 't-visa', resumenId: r.id, tarjetaMarca: 'Visa', fechaConsumo: '2026-10-10' });
    const insertResumen = sbMock.calls.find(c => c.table === 'resumenes_tarjeta');
    expect(insertResumen.rows[0]).toMatchObject({ tarjeta_id: 't-visa', fecha_cierre: '2026-10-25', fecha_vencimiento: '2026-11-05' });
    const insertMov = sbMock.calls.find(c => c.table === 'movimientos');
    expect(insertMov.rows[0]).toMatchObject({ tarjeta_id: 't-visa', resumen_id: r.id });
  });

  it('en cuotas: una por resumen, reutilizando los que ya existen', async () => {
    win.STATE.resumenesTarjeta = [resumen({ id: 'r-dic', fechaCierre: '2026-11-24', fechaVencimiento: '2026-12-04' })];
    abrirFormConTarjeta({ fechaConsumo: '2026-10-10', cuotas: 3 });
    await win.handleAction('save-mov');
    const movs = win.STATE.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    expect(movs.map(m => m.fecha)).toEqual(['2026-11-05', '2026-12-04', '2027-01-05']);
    expect(movs.map(m => m.cuotas)).toEqual(['1/3', '2/3', '3/3']);
    expect(movs[1].resumenId).toBe('r-dic');
    expect(win.STATE.resumenesTarjeta).toHaveLength(3); // se crearon solo los de noviembre y enero
  });

  it('sin tarjeta elegida sigue funcionando como antes (fecha a mano)', async () => {
    abrirFormConTarjeta({ tarjetaId: '', fecha: '2026-11-10', centroId: 'c-ef', cuotas: 2 });
    await win.handleAction('save-mov');
    const movs = win.STATE.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    expect(movs.map(m => m.fecha)).toEqual(['2026-11-10', '2026-12-10']);
    expect(movs.every(m => !m.resumenId && !m.tarjetaId)).toBe(true);
    expect(win.STATE.resumenesTarjeta).toHaveLength(0);
  });

  it('al editar y sacarle la tarjeta, borra tarjeta_id/resumen_id en la base', async () => {
    win.STATE.resumenesTarjeta = [resumen()];
    win.STATE.movimientos = [movTarjeta()];
    win.STATE.activeTab = 'movimientos';
    win.handleAction('edit-mov', 'm1');
    win.document.getElementById('f-mov-tarjeta').checked = false;
    win.document.getElementById('f-mov-fecha').value = '2026-10-10';
    await win.handleAction('save-mov', 'm1');
    const upd = sbMock.calls.find(c => c.op === 'update' && c.table === 'movimientos');
    expect(upd.fields).toMatchObject({ tarjeta: false, tarjeta_id: null, resumen_id: null });
  });
});

describe('Tarjetas: importar el resumen real', () => {
  const raw = [
    '10/10/26 COTO SUCURSAL 1                     111111*     1000,00',
    '20/09/26 COMERCIO EN CUOTAS     C.02/03      222222*     5000,00',
  ].join('\n');

  function previsualizar() {
    win.STATE.activeTab = 'importar';
    win.STATE.importEntidad = 'tarjeta';
    win.STATE.importTarjetaId = 't-visa';
    win.STATE.importVencimiento = '2026-11-07';
    win.STATE.importCierre = '2026-10-27';
    win.STATE.importRaw = raw;
    return win.handleAction('preview-import');
  }

  it('crea el resumen con las fechas reales y lo asigna a todo el lote, con el centro de la tarjeta', async () => {
    await previsualizar();
    expect(win.STATE.importPreview.every(r => r.centroId === 'c-ef')).toBe(true);
    await win.handleAction('confirm-import');
    expect(win.STATE.resumenesTarjeta).toHaveLength(1);
    const r = win.STATE.resumenesTarjeta[0];
    expect(r).toMatchObject({ fechaCierre: '2026-10-27', fechaVencimiento: '2026-11-07' });
    expect(win.STATE.movimientos).toHaveLength(2);
    expect(win.STATE.movimientos.every(m => m.resumenId === r.id && m.tarjetaId === 't-visa' && m.fecha === '2026-11-07' && m.tarjetaMarca === 'Visa')).toBe(true);
  });

  it('con un resumen ya proyectado: corrige sus fechas, mueve sus cuotas y las marca como duplicado', async () => {
    win.STATE.resumenesTarjeta = [resumen()];
    win.STATE.movimientos = [movTarjeta({ id: 'cuota-2', egreso: 5000, cuotas: '2/3', fechaConsumo: '2026-09-20' })];
    await previsualizar();
    // la cuota 2/3 de $5000 ya estaba proyectada en ese resumen (con otra fecha): posible duplicado
    expect(win.document.querySelectorAll('#import-preview-table tr.fila-duplicada')).toHaveLength(1);
    const filaCuota = win.STATE.importPreview.find(r => r.monto === -5000);
    filaCuota.incluir = false;
    await win.handleAction('confirm-import');
    expect(win.STATE.resumenesTarjeta).toHaveLength(1);
    expect(win.STATE.resumenesTarjeta[0]).toMatchObject({ id: 'r1', fechaCierre: '2026-10-27', fechaVencimiento: '2026-11-07' });
    expect(win.STATE.movimientos.map(m => m.fecha)).toEqual(['2026-11-07', '2026-11-07']);
    expect(sbMock.calls.some(c => c.op === 'update' && c.table === 'movimientos' && c.val === 'cuota-2' && c.fields.fecha === '2026-11-07')).toBe(true);
    expect(sbMock.calls.some(c => c.op === 'update' && c.table === 'resumenes_tarjeta' && c.fields.fecha_cierre === '2026-10-27')).toBe(true);
  });
});

describe('Tarjetas: Vencimientos y pago del resumen', () => {
  beforeEach(() => {
    win.STATE.tarjetas = [tarjetaVisa(), tarjetaVisa({ id: 't-master', nombre: 'Master Nación', marca: 'Mastercard' })];
    win.STATE.resumenesTarjeta = [resumen(), resumen({ id: 'r2', tarjetaId: 't-master' })];
    win.STATE.movimientos = [
      movTarjeta(), movTarjeta({ id: 'm2', egreso: 500 }),
      movTarjeta({ id: 'm3', egreso: 2000, tarjetaId: 't-master', resumenId: 'r2', tarjetaMarca: 'Mastercard' })
    ];
    win.STATE.activeTab = 'vencimientos';
  });

  it('agrupa por resumen: dos tarjetas con igual fecha y centro quedan separadas', () => {
    win.render();
    const grupos = [...win.document.querySelectorAll('details.resumen-tarjeta[data-grupo-key^="venc-tarjeta|"]')];
    expect(grupos).toHaveLength(2);
    const textos = grupos.map(g => g.querySelector('summary').textContent);
    expect(textos.some(t => t.includes('Visa Nación') && t.includes('2 movimiento(s)'))).toBe(true);
    expect(textos.some(t => t.includes('Master Nación') && t.includes('1 movimiento(s)'))).toBe(true);
  });

  it('pagar el resumen guarda el total real y muestra la diferencia con lo proyectado', async () => {
    win.handleAction('abrir-resumen', 'r1');
    expect(win.document.getElementById('f-resumen-total')).not.toBeNull();
    win.document.getElementById('f-resumen-total').value = '1620.50';
    await win.handleAction('pagar-resumen', 'r1');
    expect(win.STATE.resumenesTarjeta[0]).toMatchObject({ totalReal: 1620.5, estado: 'pagado' });
    expect(sbMock.calls.find(c => c.table === 'resumenes_tarjeta').fields).toEqual({ total_real: 1620.5, estado: 'pagado' });
    const grupoVisa = win.document.querySelector('details[data-grupo-key="venc-tarjeta|r|r1"]');
    expect(grupoVisa.textContent).toContain('Pagado');
    expect(grupoVisa.textContent).toContain('diferencia');
  });

  it('pagar sin tipear el total toma lo proyectado', async () => {
    win.handleAction('abrir-resumen', 'r1');
    await win.handleAction('pagar-resumen', 'r1');
    expect(win.STATE.resumenesTarjeta[0].totalReal).toBe(1500);
  });

  it('cambiar el vencimiento del resumen corre la fecha de todos sus consumos', async () => {
    win.handleAction('abrir-resumen', 'r1');
    win.document.getElementById('f-resumen-venc').value = '2026-11-09';
    await win.handleAction('save-resumen', 'r1');
    expect(win.STATE.movimientos.filter(m => m.resumenId === 'r1').map(m => m.fecha)).toEqual(['2026-11-09', '2026-11-09']);
    expect(win.STATE.movimientos.find(m => m.id === 'm3').fecha).toBe('2026-11-05'); // el de la otra tarjeta no se toca
    expect(win.STATE.resumenesTarjeta[0].estado).toBe('abierto');
  });

  it('rechaza un vencimiento anterior al cierre', async () => {
    win.handleAction('abrir-resumen', 'r1');
    win.document.getElementById('f-resumen-venc').value = '2026-10-01';
    await win.handleAction('save-resumen', 'r1');
    expect(win.STATE.resumenFormMsg).toBeTruthy();
    expect(sbMock.calls.length).toBe(0);
  });
});

describe('Tarjetas: ABM', () => {
  beforeEach(() => {
    win.STATE.tarjetas = [];
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'tarjetas';
    win.render();
  });

  it('da de alta una tarjeta y valida los días', async () => {
    win.document.getElementById('f-tarjeta-nombre').value = 'Visa Santander';
    win.document.getElementById('f-tarjeta-banco').value = 'santander';
    win.document.getElementById('f-tarjeta-dia-cierre').value = '40';
    await win.handleAction('save-tarjeta', '');
    expect(win.STATE.tarjetaFormMsg).toBeTruthy();
    expect(sbMock.calls.length).toBe(0);

    win.document.getElementById('f-tarjeta-nombre').value = 'Visa Santander';
    win.document.getElementById('f-tarjeta-banco').value = 'santander';
    win.document.getElementById('f-tarjeta-centro').value = 'c-ea';
    win.document.getElementById('f-tarjeta-dia-cierre').value = '23';
    win.document.getElementById('f-tarjeta-dia-venc').value = '4';
    await win.handleAction('save-tarjeta', '');
    expect(win.STATE.tarjetas[0]).toMatchObject({ nombre: 'Visa Santander', banco: 'santander', centroId: 'c-ea', diaCierre: 23, diaVencimiento: 4, activa: true });
    expect(sbMock.calls[0]).toMatchObject({ op: 'insert', table: 'tarjetas' });
    expect(win.document.body.textContent).toContain('Visa Santander');
  });

  it('borrar una tarjeta se lleva sus resúmenes y desvincula sus movimientos', async () => {
    win.STATE.tarjetas = [tarjetaVisa()];
    win.STATE.resumenesTarjeta = [resumen()];
    win.STATE.movimientos = [movTarjeta()];
    await win.handleAction('del-tarjeta-do', 't-visa');
    expect(win.STATE.tarjetas).toHaveLength(0);
    expect(win.STATE.resumenesTarjeta).toHaveLength(0);
    expect(win.STATE.movimientos[0]).toMatchObject({ tarjetaId: '', resumenId: '', tarjeta: true });
  });
});
