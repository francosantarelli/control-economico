import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { mockSb } from './helpers/mockSb.js';

let win;
beforeEach(() => { win = loadApp(); });

describe('buscarReglaParaProveedor', () => {
  it('encuentra una regla por coincidencia parcial (substring, sin importar mayúsculas)', () => {
    win.STATE.reglas = [{ id: '1', proveedor: 'Barrientos', categoria: 'Casa', subcategoria: 'Limpieza' }];
    const r = win.buscarReglaParaProveedor('PAGO A BARRIENTOS SRL');
    expect(r.categoria).toBe('Casa');
  });

  it('cuando varias reglas matchean, prefiere la más específica (texto más largo)', () => {
    win.STATE.reglas = [
      { id: '1', proveedor: 'Barrientos', categoria: 'Casa', subcategoria: 'Limpieza' },
      { id: '2', proveedor: 'Barrientos Hijos', categoria: 'Obra', subcategoria: '' },
    ];
    const r = win.buscarReglaParaProveedor('PAGO BARRIENTOS HIJOS SRL');
    expect(r.id).toBe('2');
  });

  it('devuelve null si no hay ninguna coincidencia o el proveedor está vacío', () => {
    win.STATE.reglas = [{ id: '1', proveedor: 'Barrientos', categoria: 'Casa', subcategoria: '' }];
    expect(win.buscarReglaParaProveedor('Otro proveedor')).toBeNull();
    expect(win.buscarReglaParaProveedor('')).toBeNull();
  });
});

describe('resolverCategoriaSubcategoriaPorNombre', () => {
  beforeEach(() => {
    win.STATE.categorias = [{ id: 'c1', nombre: 'Comida' }, { id: 'c2', nombre: 'Casa' }];
    win.STATE.subcategorias = [{ id: 's1', categoriaId: 'c1', nombre: 'Supermercado' }];
  });

  it('resuelve categoría y subcategoría por nombre, sin distinguir mayúsculas', () => {
    expect(win.resolverCategoriaSubcategoriaPorNombre('comida', 'supermercado')).toEqual({ categoriaId: 'c1', subcategoriaId: 's1' });
  });

  it('resuelve solo la categoría si no se pide subcategoría', () => {
    expect(win.resolverCategoriaSubcategoriaPorNombre('Comida', '')).toEqual({ categoriaId: 'c1', subcategoriaId: '' });
  });

  it('no matchea una subcategoría que pertenece a otra categoría', () => {
    expect(win.resolverCategoriaSubcategoriaPorNombre('Casa', 'Supermercado')).toEqual({ categoriaId: 'c2', subcategoriaId: '' });
  });

  it('devuelve todo vacío si la categoría no existe', () => {
    expect(win.resolverCategoriaSubcategoriaPorNombre('Inexistente', '')).toEqual({ categoriaId: '', subcategoriaId: '' });
  });
});

describe('aplicarReglaAFila', () => {
  it('encadena buscarReglaParaProveedor + resolverCategoriaSubcategoriaPorNombre', () => {
    win.STATE.categorias = [{ id: 'c1', nombre: 'Comida' }];
    win.STATE.subcategorias = [{ id: 's1', categoriaId: 'c1', nombre: 'Verdulería' }];
    win.STATE.reglas = [{ id: '1', proveedor: 'Melina', categoria: 'Comida', subcategoria: 'Verdulería' }];
    expect(win.aplicarReglaAFila('VERDULERIA MELINA SRL')).toEqual({ categoriaId: 'c1', subcategoriaId: 's1' });
  });

  it('devuelve ids vacíos cuando ninguna regla matchea', () => {
    win.STATE.reglas = [];
    expect(win.aplicarReglaAFila('Proveedor sin regla')).toEqual({ categoriaId: '', subcategoriaId: '' });
  });
});

describe('agregarOActualizarRegla', () => {
  let sbMock;
  beforeEach(() => {
    sbMock = mockSb();
    win.sb = sbMock.client;
  });

  it('agrega una regla nueva y la persiste en la base', async () => {
    win.STATE.reglas = [];
    await win.agregarOActualizarRegla('Nuevo Proveedor', 'Salida', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(1);
    expect(win.STATE.reglas[0]).toMatchObject({ proveedor: 'Nuevo Proveedor', categoria: 'Salida', subcategoria: 'Kiosco' });
    expect(win.STATE.reglas[0].id).toBeTruthy();

    expect(sbMock.calls).toHaveLength(1);
    expect(sbMock.calls[0]).toMatchObject({ op: 'insert', table: 'reglas_categorizacion' });
    expect(sbMock.calls[0].rows[0]).toMatchObject({ proveedor: 'Nuevo Proveedor', categoria: 'Salida', subcategoria: 'Kiosco' });
  });

  it('actualiza la regla existente (match por proveedor case-insensitive) en vez de duplicarla', async () => {
    win.STATE.reglas = [{ id: 'abc', proveedor: 'Melina', categoria: 'Comida', subcategoria: 'Verdulería' }];
    await win.agregarOActualizarRegla('melina', 'Salida', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(1);
    expect(win.STATE.reglas[0]).toEqual({ id: 'abc', proveedor: 'Melina', categoria: 'Salida', subcategoria: 'Kiosco' });

    expect(sbMock.calls).toHaveLength(1);
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'reglas_categorizacion', val: 'abc' });
  });

  it('no hace nada si falta el proveedor o la categoría', async () => {
    win.STATE.reglas = [];
    await win.agregarOActualizarRegla('', 'Salida', 'Kiosco');
    await win.agregarOActualizarRegla('Proveedor', '', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(0);
    expect(sbMock.calls).toHaveLength(0);
  });
});
