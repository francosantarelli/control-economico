import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

// Round-trip de los mappers toDbX/fromDbX: si `schema.sql` cambia un nombre de columna
// sin actualizar el mapper correspondiente, estos tests lo detectan.

let win;
beforeEach(() => { win = loadApp(); });

describe('centro', () => {
  it('toDbCentro -> fromDbCentro conserva los datos', () => {
    const centro = { id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco', color: '#4E9D77', colorTexto: '#fff' };
    expect(win.fromDbCentro(win.toDbCentro(centro))).toEqual(centro);
  });
  it('color/colorTexto ausentes se guardan como null y vuelven como string vacío', () => {
    const row = win.toDbCentro({ id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco' });
    expect(row.color).toBeNull();
    expect(row.color_texto).toBeNull();
    expect(win.fromDbCentro(row)).toEqual({ id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco', color: '', colorTexto: '' });
  });
});

describe('categoria', () => {
  it('toDbCategoria -> fromDbCategoria conserva los datos', () => {
    const categoria = { id: 'cat1', nombre: 'Comida', tipo: 'egreso', color: '#D97B6C', colorTexto: '' };
    expect(win.fromDbCategoria(win.toDbCategoria(categoria))).toEqual(categoria);
  });
});

describe('subcategoria', () => {
  it('toDbSubcategoria usa categoria_id (snake_case) y vuelve como categoriaId', () => {
    const sub = { id: 's1', categoriaId: 'cat1', nombre: 'Supermercado' };
    const row = win.toDbSubcategoria(sub);
    expect(row).toEqual({ id: 's1', categoria_id: 'cat1', nombre: 'Supermercado' });
    expect(win.fromDbSubcategoria(row)).toEqual(sub);
  });
});

describe('movimiento', () => {
  it('toDbMovimiento -> fromDbMovimiento conserva todos los campos, incluida la tarjeta', () => {
    const mov = {
      id: 'm1', fecha: '2026-08-09', centroId: 'c1', categoriaId: 'cat1', subcategoriaId: 's1',
      proveedor: 'Netflix', detalle: 'Suscripción mensual', ingreso: 0, egreso: 890,
      tarjeta: true, fechaConsumo: '2026-08-01', tarjetaMarca: 'Visa',
    };
    expect(win.fromDbMovimiento(win.toDbMovimiento(mov))).toEqual(mov);
  });

  it('ingreso/egreso siempre se guardan como número, aunque vengan como string o vacíos', () => {
    const row = win.toDbMovimiento({ id: 'm1', fecha: '2026-08-09', ingreso: '1234,56'.replace(',', '.'), egreso: '' });
    expect(row.ingreso).toBe(1234.56);
    expect(row.egreso).toBe(0);
  });

  it('IDs de referencia ausentes se guardan como null y vuelven como string vacío', () => {
    const row = win.toDbMovimiento({ id: 'm1', fecha: '2026-08-09', ingreso: 0, egreso: 0 });
    expect(row.centro_id).toBeNull();
    expect(row.categoria_id).toBeNull();
    expect(row.subcategoria_id).toBeNull();
    expect(win.fromDbMovimiento(row).centroId).toBe('');
  });
});

describe('vencimiento', () => {
  it('toDbVencimiento -> fromDbVencimiento conserva los datos, con estado por defecto "pendiente"', () => {
    const venc = { id: 'v1', concepto: 'Tarjeta Visa', fecha: '2026-08-15', monto: 5000, centroId: 'c1', estado: 'pendiente' };
    expect(win.fromDbVencimiento(win.toDbVencimiento(venc))).toEqual(venc);
    expect(win.toDbVencimiento({ id: 'v1', concepto: 'X', fecha: '2026-08-15', monto: 100 }).estado).toBe('pendiente');
  });
});

describe('gimnasio', () => {
  it('fromDbGimnasioVisita mapea la fila tal cual', () => {
    expect(win.fromDbGimnasioVisita({ id: 'g1', persona: 'franco', fecha: '2026-08-09' }))
      .toEqual({ id: 'g1', persona: 'franco', fecha: '2026-08-09' });
  });
});
