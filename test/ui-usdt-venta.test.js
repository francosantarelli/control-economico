import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Una venta de USDT crea el ingreso en pesos en Movimientos siempre como Sueldo › Venta USDT,
// sin elegirlo a mano: así no queda en otra categoría ni se cuenta dos veces como sueldo.
function setVal(win, id, value) { win.document.getElementById(id).value = value; }

describe('USDT: venta con categoría fija Sueldo › Venta USDT', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.subcategorias.push({ id: 'sub-venta-usdt', categoriaId: 'cat-suel', nombre: 'Venta USDT' });
    win.STATE.usdtMovimientos = [];
    win.sb = mockSb().client;
    win.STATE.activeTab = 'usdt';
    win.STATE.usdtDraft = { tipo: 'venta', fecha: '', cantidad: '', detalle: '', montoArs: '', centroId: '', categoriaId: '', subcategoriaId: '' };
    win.render();
  });

  it('el formulario muestra la categoría fija en vez de los selectores', () => {
    expect(win.document.getElementById('f-usdt-categoria')).toBeNull();
    expect(win.document.getElementById('f-usdt-subcategoria')).toBeNull();
    expect(win.document.body.textContent).toContain('Sueldo › Venta USDT');
  });

  it('al guardar, el movimiento en pesos queda en Sueldo › Venta USDT', async () => {
    setVal(win, 'f-usdt-fecha', '2026-10-01');
    setVal(win, 'f-usdt-cantidad', '100');
    setVal(win, 'f-usdt-monto-ars', '130000');
    setVal(win, 'f-usdt-centro', 'c-ef');
    await win.handleAction('save-usdt', '');

    expect(win.STATE.usdtFormMsg).toBeNull();
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0].categoriaId).toBe('cat-suel');
    expect(win.STATE.movimientos[0].subcategoriaId).toBe('sub-venta-usdt');
    expect(win.STATE.usdtMovimientos[0].subcategoriaId).toBe('sub-venta-usdt');
  });
});
