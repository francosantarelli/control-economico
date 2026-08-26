import { describe, it, expect } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

describe('Flujo de Caja: capacidad de ahorro promedio', () => {
  it('cuenta el Sueldo (ARS + USDT acreditado) como ingreso, resta el resto neto y Obra, y no duplica el Sueldo al venderse el USDT', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.categorias.push({ id: 'cat-obra', nombre: 'Obra', tipo: 'normal' });
    win.STATE.subcategorias.push({ id: 'sub-venta-usdt', categoriaId: 'cat-suel', nombre: 'Venta USDT' });

    win.STATE.movimientos = [
      // Sueldo en pesos
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Trabajo', ingreso: 100000, egreso: 0 },
      // Venta del USDT que ya se había acreditado como parte del sueldo (ver usdtMovimientos abajo):
      // no debe sumarse de nuevo, ya se contó como ingreso cuando se acreditó el USDT.
      { id: 'm2', fecha: '2026-01-20', centroId: 'c-ef', categoriaId: 'cat-suel', subcategoriaId: 'sub-venta-usdt', proveedor: 'Venta USDT', ingreso: 48000, egreso: 0 },
      // Gasto normal (resto de categorías)
      { id: 'm3', fecha: '2026-01-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Verduleria', ingreso: 0, egreso: 30000 },
      // Obra: se resta aparte del total, igual que en Resumen
      { id: 'm4', fecha: '2026-01-12', centroId: 'c-ef', categoriaId: 'cat-obra', proveedor: 'Albañil', ingreso: 0, egreso: 20000 }
    ];
    win.STATE.usdtMovimientos = [
      { id: 'u1', fecha: '2026-01-10', tipo: 'ingreso', categoriaId: 'cat-suel', montoArs: 50000 }
    ];

    const cap = win.capacidadAhorroPromedio('3m');
    // ingreso: 100000 (sueldo ARS) + 50000 (sueldo acreditado en USDT) = 150000, sin sumar los 48000 de la venta
    // egreso resto: 30000; obra: 20000 → 150000 - 30000 - 20000 = 100000, sobre 1 solo mes con datos
    expect(cap.promedio).toBe(100000);

    restore();
  });
});
