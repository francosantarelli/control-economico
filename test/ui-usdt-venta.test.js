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

describe('Saldos: tarjeta de USDT', () => {
  it('muestra la tenencia de USDT (ingresos menos ventas), aparte del saldo en pesos', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.usdtMovimientos = [
      { id: 'u1', tipo: 'ingreso', fecha: '2026-09-01', cantidad: 1000 },
      { id: 'u2', tipo: 'venta', fecha: '2026-09-10', cantidad: 250, montoArs: 300000 }
    ];
    win.STATE.usdtCotizacionBid = 1200;
    win.STATE.activeTab = 'saldos';
    win.render();
    const texto = win.document.body.textContent;
    expect(texto).toContain('Saldo en USDT');
    expect(texto).toContain('750,00 USDT');
    expect(texto).toContain('≈ $900.000,00');
  });
});

describe('Flujo de Caja: Saldo actual total incluye el USDT', () => {
  it('suma pesos + USDT a la cotización de hoy y lo detalla debajo', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.usdtMovimientos = [{ id: 'u1', tipo: 'ingreso', fecha: '2026-09-01', cantidad: 100 }];
    win.STATE.usdtCotizacionBid = 1000;
    win.STATE.activeTab = 'flujo';
    win.render();
    const card = [...win.document.querySelectorAll('.summary-card')].find(c => c.textContent.includes('Saldo actual total'));
    expect(card.querySelector('.value').textContent).toBe('100.000,00'); // sin pesos cargados: solo los 100 USDT a $1.000
    expect(card.textContent).toContain('100,00 USDT (≈ 100.000,00 a $1.000,00)');
  });
});

describe('USDT: venta con categoría propia "Venta USDT"', () => {
  it('con la categoría nueva, el movimiento queda en esa categoría sin subcategoría y no se cuenta como Sueldo', async () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.categorias.push({ id: 'cat-venta-usdt', nombre: 'Venta USDT', tipo: 'sueldo' });
    win.STATE.usdtMovimientos = [];
    win.sb = mockSb().client;
    win.STATE.activeTab = 'usdt';
    win.STATE.usdtDraft = { tipo: 'venta', fecha: '', cantidad: '', detalle: '', montoArs: '', centroId: '', categoriaId: '', subcategoriaId: '' };
    win.render();
    expect(win.document.body.textContent).toContain('Venta USDT');

    setVal(win, 'f-usdt-fecha', '2026-10-01');
    setVal(win, 'f-usdt-cantidad', '100');
    setVal(win, 'f-usdt-monto-ars', '130000');
    setVal(win, 'f-usdt-centro', 'c-ef');
    await win.handleAction('save-usdt', '');

    expect(win.STATE.usdtFormMsg).toBeNull();
    expect(win.STATE.movimientos[0].categoriaId).toBe('cat-venta-usdt');
    expect(win.STATE.movimientos[0].subcategoriaId).toBeFalsy();
    expect(win.esIngresoPorVentaUsdt(win.STATE.movimientos[0], {})).toBe(true);
    expect(win.esVentaUsdtFacturable({ id: 'x', categoriaId: 'cat-venta-usdt', ingreso: 1000 })).toBe(true);
  });
});
