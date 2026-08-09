import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

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
  it('agrega una regla nueva y la persiste en localStorage', () => {
    win.STATE.reglas = [];
    win.agregarOActualizarRegla('Nuevo Proveedor', 'Salida', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(1);
    expect(win.STATE.reglas[0]).toMatchObject({ proveedor: 'Nuevo Proveedor', categoria: 'Salida', subcategoria: 'Kiosco' });
    expect(win.STATE.reglas[0].id).toBeTruthy();

    const persisted = JSON.parse(win.localStorage.getItem('controlEconomico_reglasCategorizacion'));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].proveedor).toBe('Nuevo Proveedor');
  });

  it('actualiza la regla existente (match por proveedor case-insensitive) en vez de duplicarla', () => {
    win.STATE.reglas = [{ id: 'abc', proveedor: 'Melina', categoria: 'Comida', subcategoria: 'Verdulería' }];
    win.agregarOActualizarRegla('melina', 'Salida', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(1);
    expect(win.STATE.reglas[0]).toEqual({ id: 'abc', proveedor: 'Melina', categoria: 'Salida', subcategoria: 'Kiosco' });
  });

  it('no hace nada si falta el proveedor o la categoría', () => {
    win.STATE.reglas = [];
    win.agregarOActualizarRegla('', 'Salida', 'Kiosco');
    win.agregarOActualizarRegla('Proveedor', '', 'Kiosco');
    expect(win.STATE.reglas).toHaveLength(0);
  });
});
