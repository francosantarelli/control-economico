import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';

let win;
beforeEach(() => { win = loadApp(); });

describe('montoSignedMovimiento / montosIguales / normalizarProveedor', () => {
  it('un movimiento con ingreso da positivo, uno con egreso da negativo', () => {
    expect(win.montoSignedMovimiento({ ingreso: 100, egreso: 0 })).toBe(100);
    expect(win.montoSignedMovimiento({ ingreso: 0, egreso: 50 })).toBe(-50);
    expect(win.montoSignedMovimiento({ ingreso: 0, egreso: 0 })).toBe(-0);
  });

  it('montosIguales compara redondeando a centavos (evita errores de punto flotante)', () => {
    expect(win.montosIguales(0.1 + 0.2, 0.3)).toBe(true);
    expect(win.montosIguales(100, 100.004)).toBe(true);
    expect(win.montosIguales(100, 100.01)).toBe(false);
  });
});

describe('existeMovimientoIgual / calcularDuplicados', () => {
  beforeEach(() => {
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-08-01', centroId: 'c1', proveedor: 'Supermercado La Anonima', ingreso: 0, egreso: 1000 },
    ];
  });

  it('detecta un movimiento existente igual (mismo día, centro, proveedor normalizado y monto)', () => {
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'SUPERMERCADO LA ANONIMA', -1000)).toBe(true);
  });

  it('no lo considera igual si difiere el centro, el monto o el proveedor', () => {
    expect(win.existeMovimientoIgual('2026-08-01', 'c2', 'Supermercado La Anonima', -1000)).toBe(false);
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'Supermercado La Anonima', -999)).toBe(false);
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'Otro proveedor', -1000)).toBe(false);
  });

  it('sin fecha o centro nunca marca como duplicado', () => {
    expect(win.existeMovimientoIgual('', 'c1', 'Supermercado La Anonima', -1000)).toBe(false);
    expect(win.existeMovimientoIgual('2026-08-01', '', 'Supermercado La Anonima', -1000)).toBe(false);
  });

  it('calcularDuplicados marca tanto los que ya existen guardados como los repetidos dentro del mismo lote', () => {
    const filas = [
      { id: 'f1', fecha: '2026-08-01', centroId: 'c1', proveedor: 'Supermercado La Anonima', monto: -1000 }, // ya existe
      { id: 'f2', fecha: '2026-08-02', centroId: 'c1', proveedor: 'Netflix', monto: -500 }, // único
      { id: 'f3', fecha: '2026-08-03', centroId: 'c1', proveedor: 'Spotify', monto: -200 }, // repetido dentro del lote...
      { id: 'f4', fecha: '2026-08-03', centroId: 'c1', proveedor: 'SPOTIFY', monto: -200 }, // ...con f3
    ];
    expect(win.calcularDuplicados(filas)).toEqual({ f1: true, f3: true, f4: true });
  });
});

describe('calcularSaldos', () => {
  let restoreNow;
  beforeEach(() => {
    restoreNow = mockNow(win, new win.Date(2026, 7, 9)); // hoy = 2026-08-09
    win.STATE.centros = [
      { id: 'cA', codigo: 'EA', nombre: 'Efectivo Ana' },
      { id: 'cF', codigo: 'EF', nombre: 'Efectivo Franco' },
      { id: 'cX', codigo: 'CX', nombre: 'Cuenta Compartida' },
    ];
  });
  afterEach(() => { restoreNow(); });

  it('suma ingresos y resta egresos por centro, agrupando por titular según el sufijo del código', () => {
    win.STATE.movimientos = [
      { fecha: '2026-08-01', centroId: 'cA', ingreso: 1000, egreso: 0 },
      { fecha: '2026-08-02', centroId: 'cA', ingreso: 0, egreso: 300 },
      { fecha: '2026-08-01', centroId: 'cF', ingreso: 500, egreso: 0 },
      { fecha: '2026-08-01', centroId: 'cX', ingreso: 200, egreso: 0 },
      { fecha: '2026-08-01', centroId: null, ingreso: 50, egreso: 0 }, // sin centro asignado
    ];
    const s = win.calcularSaldos();
    expect(s.filas.find(function(f){ return f.id === 'cA'; }).saldo).toBe(700);
    expect(s.filas.find(function(f){ return f.id === 'cF'; }).saldo).toBe(500);
    expect(s.filas.find(function(f){ return f.id === 'cX'; }).saldo).toBe(200);
    expect(s.totalAna).toBe(700);
    expect(s.totalFranco).toBe(500);
    expect(s.saldoSinCentro).toBe(50);
    expect(s.hayOtros).toBe(true);
    expect(s.totalOtros).toBe(250); // cX (titular "Otros", código no termina en A/F) + sinCentro
    expect(s.totalGeneral).toBe(1450);
  });

  it('ignora movimientos con fecha futura (pendientes) para el cálculo del saldo', () => {
    win.STATE.movimientos = [
      { fecha: '2026-08-01', centroId: 'cA', ingreso: 1000, egreso: 0 },
      { fecha: '2026-09-01', centroId: 'cA', ingreso: 5000, egreso: 0 }, // futuro respecto al 2026-08-09 mockeado
    ];
    const s = win.calcularSaldos();
    expect(s.filas.find(function(f){ return f.id === 'cA'; }).saldo).toBe(1000);
  });
});

describe('esTipoCategoria / esCategoriaObra / esCategoriaSueldo', () => {
  beforeEach(() => {
    win.STATE.categorias = [
      { id: 'c1', nombre: 'Sueldo', tipo: 'ingreso' },
      { id: 'c2', nombre: 'Obra', tipo: 'egreso' },
      { id: 'c3', nombre: 'Comida', tipo: 'egreso' },
    ];
  });

  it('esTipoCategoria compara el campo tipo de la categoría', () => {
    expect(win.esTipoCategoria('c1', 'ingreso')).toBe(true);
    expect(win.esTipoCategoria('c3', 'ingreso')).toBe(false);
    expect(win.esTipoCategoria('inexistente', 'ingreso')).toBe(false);
  });

  it('esCategoriaObra / esCategoriaSueldo matchean por nombre, sin distinguir mayúsculas', () => {
    expect(win.esCategoriaObra('c2')).toBe(true);
    expect(win.esCategoriaObra('c1')).toBe(false);
    expect(win.esCategoriaSueldo('c1')).toBe(true);
    expect(win.esCategoriaSueldo('c2')).toBe(false);
  });
});
