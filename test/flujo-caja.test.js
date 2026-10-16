import { describe, it, expect } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

describe('Flujo de Caja: capacidad de ahorro promedio', () => {
  it('cuenta el Sueldo (ARS + USDT acreditado) como ingreso, resta el resto neto, deja la Obra aparte y no duplica el Sueldo al venderse el USDT', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.categorias.push({ id: 'cat-obra', nombre: 'Obra', tipo: 'inversion' });
    win.STATE.subcategorias.push({ id: 'sub-venta-usdt', categoriaId: 'cat-suel', nombre: 'Venta USDT' });

    win.STATE.movimientos = [
      // Sueldo en pesos
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Trabajo', ingreso: 100000, egreso: 0 },
      // Venta del USDT que ya se había acreditado como parte del sueldo (ver usdtMovimientos abajo):
      // no debe sumarse de nuevo, ya se contó como ingreso cuando se acreditó el USDT.
      { id: 'm2', fecha: '2026-01-20', centroId: 'c-ef', categoriaId: 'cat-suel', subcategoriaId: 'sub-venta-usdt', proveedor: 'Venta USDT', ingreso: 48000, egreso: 0 },
      // Gasto normal (resto de categorías)
      { id: 'm3', fecha: '2026-01-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Verduleria', ingreso: 0, egreso: 30000 },
      // Obra: no se resta de la capacidad de ahorro (es inversión), se informa aparte
      { id: 'm4', fecha: '2026-01-12', centroId: 'c-ef', categoriaId: 'cat-obra', proveedor: 'Albañil', ingreso: 0, egreso: 20000 }
    ];
    win.STATE.usdtMovimientos = [
      { id: 'u1', fecha: '2026-01-10', tipo: 'ingreso', categoriaId: 'cat-suel', montoArs: 50000 }
    ];

    const cap = win.capacidadAhorroPromedio('3m');
    // ingreso: 100000 (sueldo ARS) + 50000 (sueldo acreditado en USDT) = 150000, sin sumar los 48000 de la venta
    // egreso resto: 30000 → 150000 - 30000 = 120000, sobre 1 solo mes con datos; obra: 20000 aparte
    expect(cap.promedio).toBe(120000);
    expect(cap.inversionPromedio).toBe(20000);

    restore();
  });

  it('no cuenta como sueldo los ingresos de Gerardo (cualquiera de sus variantes de proveedor)', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'AdvertMind', ingreso: 100000, egreso: 0 },
      { id: 'm2', fecha: '2026-01-11', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Gerardo', ingreso: 500000, egreso: 0 },
      { id: 'm3', fecha: '2026-01-12', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Gera', ingreso: 300000, egreso: 0 },
      { id: 'm4', fecha: '2026-01-13', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'CASADEI GERARDO CESAR', ingreso: 200000, egreso: 0 }
    ];
    win.STATE.usdtMovimientos = [];

    expect(win.capacidadAhorroPromedio('3m').promedio).toBe(100000);

    restore();
  });

  it('cuenta todo ingreso USDT como sueldo (aunque no tenga categoría ni valor en pesos), valuado a la cotización de la venta (FIFO) o a la de hoy si no se vendió', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.usdtCotizacionBid = 1200;
    win.STATE.movimientos = [
      // Sueldo de Franco en pesos
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Trabajo', ingreso: 100000, egreso: 0 },
      // Pesos de vender el USDT de Ani, cargados en una categoría normal: no deben sumar de nuevo
      { id: 'm-venta', fecha: '2026-01-20', centroId: 'c-ea', categoriaId: 'cat-super', proveedor: 'Venta USDT', ingreso: 110000, egreso: 0 },
      { id: 'm2', fecha: '2026-02-15', centroId: 'c-ea', categoriaId: 'cat-super', proveedor: 'Verduleria', ingreso: 0, egreso: 9000 }
    ];
    win.STATE.usdtMovimientos = [
      // Sueldo de Ani en USDT, sin categoría ni valor en pesos
      { id: 'u1', fecha: '2026-01-05', tipo: 'ingreso', cantidad: 100, categoriaId: '', montoArs: 0 },
      // Vende 100 a $1100: se consume entero el ingreso u1
      { id: 'u2', fecha: '2026-01-20', tipo: 'venta', cantidad: 100, montoArs: 110000, cotizacion: 1100, movimientoId: 'm-venta' },
      // Febrero: cobra 50 y vende 20 a $1150 → 20*1150 + 30*1200 (hoy) = 59000
      { id: 'u3', fecha: '2026-02-05', tipo: 'ingreso', cantidad: 50, categoriaId: '', montoArs: 0 },
      { id: 'u4', fecha: '2026-02-10', tipo: 'venta', cantidad: 20, montoArs: 23000, cotizacion: 1150 }
    ];

    const valores = win.valoresArsIngresosUsdt();
    expect(valores.u1).toBe(110000);
    expect(valores.u3).toBe(59000);

    // Ene: 100000 + 110000 = 210000; Feb: 59000 - 9000 = 50000 → promedio 130000
    expect(win.capacidadAhorroPromedio('3m').promedio).toBe(130000);

    const resumenEne = win.calcularTotalesResumenKpis([], [], ['2026-01']);
    expect(resumenEne.totalIngreso).toBe(210000);
    expect(resumenEne.totalEgreso).toBe(0);
    // Filtrando por la categoría Sueldo, el USDT sin categoría sigue contando como sueldo
    expect(win.calcularTotalesResumenKpis([], ['cat-suel'], ['2026-01']).totalIngreso).toBe(210000);

    restore();
  });
});
