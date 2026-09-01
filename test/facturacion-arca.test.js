import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

let win;
beforeEach(() => { win = loadApp(); });

describe('acumuladoFacturado12Meses', () => {
  it('suma solo las facturas emitidas dentro de los 12 meses móviles hasta la fecha de referencia', () => {
    const facturas = [
      { fecha: '2025-09-01', importe: 100000, estado: 'emitida' },  // justo en el borde, entra
      { fecha: '2025-08-31', importe: 999999, estado: 'emitida' },  // un día antes del borde, no entra
      { fecha: '2026-08-01', importe: 200000, estado: 'emitida' },
      { fecha: '2026-08-15', importe: 300000, estado: 'error' },    // no cuenta: no está emitida
      { fecha: '2026-09-02', importe: 400000, estado: 'emitida' },  // posterior a la fecha de referencia, no entra
    ];
    expect(win.acumuladoFacturado12Meses(facturas, '2026-09-01')).toBe(300000);
  });

  it('devuelve 0 si no hay facturas emitidas', () => {
    expect(win.acumuladoFacturado12Meses([], '2026-08-31')).toBe(0);
    expect(win.acumuladoFacturado12Meses([{ fecha: '2026-08-01', importe: 100, estado: 'error' }], '2026-08-31')).toBe(0);
  });
});

describe('esVentaUsdtFacturable', () => {
  beforeEach(() => {
    win.STATE.categorias = [{ id: 'c1', nombre: 'Ingresos' }];
    win.STATE.subcategorias = [{ id: 's1', categoriaId: 'c1', nombre: 'Venta USDT' }, { id: 's2', categoriaId: 'c1', nombre: 'Otra' }];
  });

  it('es facturable un movimiento de Venta USDT con ingreso positivo y sin factura emitida', () => {
    win.STATE.facturas = [];
    const mov = { id: 'm1', subcategoriaId: 's1', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('no es facturable si ya tiene una factura emitida en producción', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'emitida', ambiente: 'produccion' }];
    const mov = { id: 'm1', subcategoriaId: 's1', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(false);
  });

  it('sigue siendo facturable si la única factura previa quedó en error (se puede reintentar)', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'error', ambiente: 'produccion' }];
    const mov = { id: 'm1', subcategoriaId: 's1', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('sigue siendo facturable si la única factura emitida fue una prueba en homologación', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'emitida', ambiente: 'homologacion' }];
    const mov = { id: 'm1', subcategoriaId: 's1', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('no es facturable si la subcategoría no es "Venta USDT" o el ingreso no es positivo', () => {
    win.STATE.facturas = [];
    expect(win.esVentaUsdtFacturable({ id: 'm1', subcategoriaId: 's2', ingreso: 50000 })).toBe(false);
    expect(win.esVentaUsdtFacturable({ id: 'm1', subcategoriaId: 's1', ingreso: 0 })).toBe(false);
  });
});

describe('limiteCategoriaB', () => {
  it('lee el valor numérico configurado', () => {
    win.STATE.configuracion = [{ clave: 'monotributo_limite_categoria_b', valor: '1400000' }];
    expect(win.limiteCategoriaB()).toBe(1400000);
  });

  it('devuelve 0 si todavía no está configurado', () => {
    win.STATE.configuracion = [];
    expect(win.limiteCategoriaB()).toBe(0);
  });
});
