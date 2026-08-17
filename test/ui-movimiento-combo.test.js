import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// El combo de Centro/Categoría/Subcategoría del formulario de "Nuevo movimiento" es justamente
// donde se descubrió y arregló (en una sesión anterior) la clase de bug que después reapareció en
// el modal de Efectivo: un re-render disparado por el combo pisando Proveedor/Detalle/Monto porque
// esos campos no tienen listener propio. Este test confirma que ese mecanismo sigue funcionando acá.
//
// Ojo: cada dispatchEvent que dispara un render() reemplaza el DOM entero (innerHTML), así que hay
// que volver a pedir el elemento con getElementById/querySelector después de cada uno -- una
// referencia guardada de antes queda "muerta" (sin los listeners de la nueva pasada de bindEvents).
describe('Formulario de Movimiento: combo de Categoría no pisa el resto de los campos', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.handleAction('abrir-nuevo-mov');
  });

  it('tipear y abrir el combo de Categoría conserva Proveedor/Detalle/Monto ya cargados', () => {
    win.document.getElementById('f-mov-proveedor').value = 'Coto';
    win.document.getElementById('f-mov-detalle').value = 'Compra semanal';
    win.document.getElementById('f-mov-monto').value = '15000';

    win.document.getElementById('mov-categoria-input').dispatchEvent(new win.Event('focus'));

    const catInput = win.document.getElementById('mov-categoria-input');
    catInput.value = 'super';
    catInput.dispatchEvent(new win.Event('input'));

    expect(win.document.getElementById('f-mov-proveedor').value).toBe('Coto');
    expect(win.document.getElementById('f-mov-detalle').value).toBe('Compra semanal');
    expect(win.document.getElementById('f-mov-monto').value).toBe('15000');
  });

  it('clickear una opción del combo aplica la selección y sigue sin pisar el resto', () => {
    win.document.getElementById('f-mov-proveedor').value = 'Coto';
    win.document.getElementById('f-mov-monto').value = '15000';

    win.document.getElementById('mov-categoria-input').dispatchEvent(new win.Event('focus'));

    const item = win.document.querySelector('[data-combo-wrap="mov-categoria"] .combo-item[data-value="cat-super"]');
    expect(item).toBeTruthy();
    item.dispatchEvent(new win.Event('mousedown', { bubbles: true }));
    item.dispatchEvent(new win.Event('click', { bubbles: true }));

    expect(win.document.getElementById('f-mov-categoria').value).toBe('cat-super');
    expect(win.document.getElementById('f-mov-proveedor').value).toBe('Coto');
    expect(win.document.getElementById('f-mov-monto').value).toBe('15000');
  });
});
