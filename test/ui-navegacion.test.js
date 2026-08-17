import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

describe('Navegación de pestañas', () => {
  it('clic en una pestaña del sidebar la activa y limpia estados de edición abiertos', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'movimientos';
    win.STATE.nuevoMovAbierto = true;
    win.render();

    const tabResumen = win.document.querySelector('.tab[data-tab="resumen"]');
    expect(tabResumen).toBeTruthy();
    tabResumen.dispatchEvent(new win.Event('click', { bubbles: true }));

    expect(win.STATE.activeTab).toBe('resumen');
    expect(win.STATE.nuevoMovAbierto).toBe(false);
    expect(win.document.querySelector('.tab.active').getAttribute('data-tab')).toBe('resumen');
  });
});

describe('Modo oscuro', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.menuUsuarioAbierto = true;
    win.render();
  });

  it('arranca en modo claro por defecto (sin nada guardado en localStorage)', () => {
    expect(win.STATE.tema).toBe('claro');
    expect(win.document.documentElement.getAttribute('data-theme')).not.toBe('oscuro');
  });

  it('"toggle-tema" cambia a oscuro, lo marca en <html data-theme> y lo persiste en localStorage', () => {
    win.handleAction('toggle-tema');
    expect(win.STATE.tema).toBe('oscuro');
    expect(win.document.documentElement.getAttribute('data-theme')).toBe('oscuro');
    expect(win.localStorage.getItem('controlTema')).toBe('oscuro');
  });

  it('una segunda vez vuelve a claro', () => {
    win.handleAction('toggle-tema');
    win.handleAction('toggle-tema');
    expect(win.STATE.tema).toBe('claro');
    expect(win.localStorage.getItem('controlTema')).toBe('claro');
  });
});
