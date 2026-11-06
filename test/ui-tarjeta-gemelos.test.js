import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Cuota cargada a mano con un vencimiento estimado (07/11) y la misma cuota que llega en el
// resumen real con otro vencimiento (11/11): no tiene que quedar duplicada.
function movTarjeta(id, fecha, monto, extra = {}) {
  return { id, fecha, centroId: 'c-ef', categoriaId: '', subcategoriaId: '', proveedor: '', detalle: '',
    ingreso: 0, egreso: monto, tarjeta: true, fechaConsumo: '', tarjetaMarca: '', cuotas: '', ...extra };
}
function filaImport(id, fecha, monto, extra = {}) {
  return { id, fecha, centroId: 'c-ef', categoriaId: '', subcategoriaId: '', proveedor: 'FUTURE PIETRA', detalle: '',
    monto: -monto, incluir: true, guardarRegla: false, cuotas: '', fechaConsumo: '', tarjetaMarca: '', ...extra };
}

describe('Tarjeta: cuotas proyectadas vs. resumen real', () => {
  let win, sbMock, restaurar;
  beforeEach(() => {
    win = loadApp();
    restaurar = mockNow(win, '2026-11-03T12:00:00');
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
  });
  afterEach(() => restaurar());

  describe('al importar un resumen', () => {
    beforeEach(() => {
      win.STATE.activeTab = 'importar';
      win.STATE.importEntidad = 'tarjeta';
      win.STATE.movimientos = [
        movTarjeta('proy-1', '2026-11-07', 170000, { categoriaId: 'cat-super', proveedor: 'Future pietra', detalle: 'Vereda', cuotas: '4/9' }),
        movTarjeta('lejos', '2026-10-07', 51000, { proveedor: 'Otra' })
      ];
    });

    it('detecta la cuota ya cargada con otra fecha dentro de ±10 días y la muestra en la previsualización', () => {
      win.STATE.importPreview = [filaImport('r1', '2026-11-11', 170000), filaImport('r2', '2026-11-11', 51000)];
      win.render();
      const avisos = win.document.querySelectorAll('.aviso-gemelo');
      expect(avisos).toHaveLength(1);
      expect(avisos[0].textContent).toMatch(/Ya cargado el 07\/11\/2026/);
    });

    it('al confirmar mueve la cuota existente a la fecha real en vez de insertar otra', async () => {
      win.STATE.importPreview = [filaImport('r1', '2026-11-11', 170000, { cuotas: '4/9' }), filaImport('r2', '2026-11-11', 51000)];
      win.render();
      await win.handleAction('confirm-import', '');
      const proy = win.STATE.movimientos.find(m => m.id === 'proy-1');
      expect(proy).toMatchObject({ fecha: '2026-11-11', categoriaId: 'cat-super', proveedor: 'Future pietra', detalle: 'Vereda' });
      // Solo se inserta la fila sin gemelo (la de 51.000: el de octubre está a más de 10 días)
      const inserts = sbMock.calls.filter(c => c.op === 'insert' && c.table === 'movimientos');
      expect(inserts).toHaveLength(1);
      expect(inserts[0].rows).toHaveLength(1);
      expect(inserts[0].rows[0].egreso).toBe(51000);
      expect(sbMock.calls).toContainEqual(expect.objectContaining({ op: 'update', table: 'movimientos', val: 'proy-1', fields: { fecha: '2026-11-11' } }));
      expect(win.STATE.movimientos).toHaveLength(3);
    });

    it('si se desmarca "Ya cargado", se importa como movimiento nuevo', async () => {
      win.STATE.importPreview = [filaImport('r1', '2026-11-11', 170000, { unificar: false })];
      await win.handleAction('confirm-import', '');
      expect(win.STATE.movimientos.find(m => m.id === 'proy-1').fecha).toBe('2026-11-07');
      expect(win.STATE.movimientos).toHaveLength(3);
    });

    it('no empareja fuera de la ventana de 10 días', async () => {
      win.STATE.importPreview = [filaImport('r1', '2026-11-18', 170000)];
      await win.handleAction('confirm-import', '');
      expect(win.STATE.movimientos.find(m => m.id === 'proy-1').fecha).toBe('2026-11-07');
      expect(win.STATE.movimientos).toHaveLength(3);
    });

    it('dos cuotas del mismo monto no se emparejan con el mismo movimiento', async () => {
      win.STATE.importPreview = [filaImport('r1', '2026-11-11', 170000), filaImport('r2', '2026-11-11', 170000, { detalle: 'otra' })];
      await win.handleAction('confirm-import', '');
      expect(win.STATE.movimientos.filter(m => m.egreso === 170000)).toHaveLength(2);
    });
  });

  describe('en Vencimientos, resúmenes ya duplicados', () => {
    beforeEach(() => {
      win.STATE.activeTab = 'vencimientos';
      win.STATE.movimientos = [
        movTarjeta('p1', '2026-11-07', 170000, { categoriaId: 'cat-super', proveedor: 'Future pietra-link', detalle: 'Vereda' }),
        movTarjeta('p2', '2026-11-07', 51000, { categoriaId: 'cat-super', proveedor: 'Future pietra' }),
        movTarjeta('r1', '2026-11-11', 170000, { proveedor: 'FUTURE PIETRA-LINK D', cuotas: '4/9' }),
        movTarjeta('r2', '2026-11-11', 51000, { proveedor: 'FUTURE PIETRA-LINK DE PA' }),
        movTarjeta('r3', '2026-11-11', 28526.66, { proveedor: 'JUGUETERIA' })
      ];
      win.render();
    });

    it('cada resumen muestra cuántos movimientos faltan categorizar', () => {
      const porCategorizar = [...win.document.querySelectorAll('details.resumen-tarjeta summary')].map(s => {
        const tag = s.querySelector('.por-categorizar');
        return tag ? tag.textContent.trim() : '';
      });
      // 07/11: p1 y p2 tienen categoría; 11/11: r1, r2 y r3 no
      expect(porCategorizar).toEqual(['', '3 por categorizar']);
    });

    it('marca el resumen proyectado con repetidos y ofrece unificar con el real', () => {
      const btn = win.document.querySelector('[data-action="unificar-resumen-tarjeta"]');
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('data-id')).toBe('2026-11-07|c-ef');
      expect(btn.textContent).toMatch(/11\/11\/2026/);
      expect(win.document.querySelectorAll('[data-action="unificar-resumen-tarjeta"]')).toHaveLength(1);
    });

    it('unificar mueve los proyectados a la fecha real, completa datos y borra los repetidos', async () => {
      await win.handleAction('unificar-resumen-tarjeta', '2026-11-07|c-ef');
      expect(win.STATE.confirmState).toMatchObject({ action: 'unificar-resumen-tarjeta-do' });
      await win.handleAction('confirm-yes', '');
      const ids = win.STATE.movimientos.map(m => m.id).sort();
      expect(ids).toEqual(['p1', 'p2', 'r3']);
      expect(win.STATE.movimientos.find(m => m.id === 'p1')).toMatchObject({ fecha: '2026-11-11', categoriaId: 'cat-super', proveedor: 'Future pietra-link', cuotas: '4/9' });
      expect(win.STATE.movimientos.find(m => m.id === 'p2').fecha).toBe('2026-11-11');
      expect(sbMock.calls.filter(c => c.op === 'delete').map(c => c.val).sort()).toEqual(['r1', 'r2']);
      expect(win.document.querySelector('[data-action="unificar-resumen-tarjeta"]')).toBeNull();
    });
  });
});
