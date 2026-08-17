import { describe, it, expect } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// La "Comparativa mensual" de Resumen usa mesesParaRango/mesesProximos (ya cubiertos a nivel unitario
// en formato.test.js) pero acá se prueba el cableado real: elegir "Próximos 3 meses" en el <select>
// del Resumen efectivamente cambia STATE.grillaRango y la grilla se recalcula con esos meses.
describe('Resumen: selector de rango de la Comparativa mensual', () => {
  it('"Próximos 3 meses" muestra los meses futuros con datos, no el histórico completo', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-07-15T12:00:00');
    win.STATE.movimientos = [
      { id: 'm-pasado', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Viejo', ingreso: 0, egreso: 100 },
      { id: 'm-futuro', fecha: '2026-09-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Cuota futura', ingreso: 0, egreso: 5000 }
    ];
    win.STATE.activeTab = 'resumen';
    win.render();

    const select = win.document.getElementById('rf-grilla-rango');
    select.value = 'prox3m';
    select.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.STATE.grillaRango).toBe('prox3m');

    // La tabla de la Comparativa mensual es la última de la pestaña (la de "Tendencia mensual", más
    // arriba, a propósito sigue mostrando todo el histórico sin importar este selector -- ver el
    // comentario de ayuda en el propio render: "Ignora el filtro... usa el selector de rango de acá").
    const tablas = win.document.querySelectorAll('table');
    const encabezado = tablas[tablas.length - 1].querySelector('thead').textContent;
    expect(encabezado).toContain('Ago 26'); // agosto 2026, primer mes de la ventana "próximos 3 meses"
    expect(encabezado).toContain('Sep 26');
    expect(encabezado).toContain('Oct 26');
    expect(encabezado).not.toContain('Ene 26'); // el mes con el movimiento "pasado" no debería listarse en este rango
    restore();
  });

  it('"Todo el histórico" es el valor por defecto y no filtra por fecha', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2020-01-10', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Muy viejo', ingreso: 0, egreso: 100 }
    ];
    win.STATE.activeTab = 'resumen';
    win.render();
    expect(win.STATE.grillaRango).toBe('todo');
    const tablas = win.document.querySelectorAll('table');
    expect(tablas[tablas.length - 1].querySelector('thead').textContent).toContain('Ene 20');
  });
});
