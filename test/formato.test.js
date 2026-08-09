import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';

let win;
beforeEach(() => { win = loadApp(); });

describe('fmtMonto / formatMonto / parseMonto', () => {
  it('fmtMonto formatea con separador de miles argentino y 2 decimales', () => {
    expect(win.fmtMonto(1234.5)).toBe('1.234,50');
    expect(win.fmtMonto(0)).toBe('0,00');
    expect(win.fmtMonto(null)).toBe('0,00');
    expect(win.fmtMonto(undefined)).toBe('0,00');
  });

  it('formatMonto siempre devuelve el valor absoluto', () => {
    expect(win.formatMonto(-1234.5)).toBe('1.234,50');
    expect(win.formatMonto(NaN)).toBe('');
    expect(win.formatMonto(null)).toBe('');
  });

  it('parseMonto interpreta formato es-AR ($1.234,56)', () => {
    expect(win.parseMonto('$1.234,56')).toBeCloseTo(1234.56);
    expect(win.parseMonto('-$1.234,56')).toBeCloseTo(-1234.56);
    expect(win.parseMonto('')).toBeNull();
  });
});

describe('esc', () => {
  it('escapa caracteres HTML peligrosos', () => {
    expect(win.esc('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(win.esc("O'Brien & Cía")).toBe('O&#39;Brien &amp; Cía');
  });
  it('trata null/undefined como string vacío', () => {
    expect(win.esc(null)).toBe('');
    expect(win.esc(undefined)).toBe('');
  });
});

describe('parseFechaFlexible', () => {
  it('acepta ISO, DD-MM-AAAA y DD/MM/AAAA (con año de 2 o 4 dígitos)', () => {
    expect(win.parseFechaFlexible('2026-08-09')).toBe('2026-08-09');
    expect(win.parseFechaFlexible('9-8-26')).toBe('2026-08-09');
    expect(win.parseFechaFlexible('09/08/2026')).toBe('2026-08-09');
  });
  it('devuelve vacío si no matchea ningún formato conocido', () => {
    expect(win.parseFechaFlexible('no es una fecha')).toBe('');
    expect(win.parseFechaFlexible('')).toBe('');
  });
});

describe('parseNumeroFlexible', () => {
  it('interpreta miles+decimales es-AR (punto miles, coma decimal)', () => {
    expect(win.parseNumeroFlexible('1.234,56')).toBeCloseTo(1234.56);
  });
  it('interpreta miles+decimales en-US (coma miles, punto decimal)', () => {
    expect(win.parseNumeroFlexible('1,234.56')).toBeCloseTo(1234.56);
  });
  it('un único punto con 2 decimales se trata como decimal, no como miles', () => {
    expect(win.parseNumeroFlexible('1234.56')).toBeCloseTo(1234.56);
  });
  it('un único punto usado como separador de miles (sin 2 decimales) se descarta', () => {
    expect(win.parseNumeroFlexible('1.234')).toBe(1234);
  });
  it('valores vacíos o inválidos devuelven 0', () => {
    expect(win.parseNumeroFlexible('')).toBe(0);
    expect(win.parseNumeroFlexible(null)).toBe(0);
    expect(win.parseNumeroFlexible('abc')).toBe(0);
  });
});

describe('conversión de fechas cortas a ISO', () => {
  it('fechaCortaAISO convierte DD-MM-AA(AA) a ISO', () => {
    expect(win.fechaCortaAISO('09-08-26')).toBe('2026-08-09');
    expect(win.fechaCortaAISO('09-08-2026')).toBe('2026-08-09');
    expect(win.fechaCortaAISO('')).toBe('');
  });
  it('fechaVencCortaAISO convierte DD/MM/AA(AA) a ISO', () => {
    expect(win.fechaVencCortaAISO('9/8/26')).toBe('2026-08-09');
    expect(win.fechaVencCortaAISO('no-es-fecha')).toBe('');
  });
  it('fechaISOaDDMMAAAA hace el camino inverso', () => {
    expect(win.fechaISOaDDMMAAAA('2026-08-09')).toBe('09/08/2026');
    expect(win.fechaISOaDDMMAAAA('')).toBe('');
  });
});

describe('sumarMeses', () => {
  it('suma meses cruzando el fin de año', () => {
    expect(win.sumarMeses('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('resta meses cruzando el inicio de año', () => {
    expect(win.sumarMeses('2026-01-15', -1)).toBe('2025-12-15');
  });
  it('recorta el día si el mes destino es más corto (31 ene + 1 mes -> 28/29 feb)', () => {
    expect(win.sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('helpers de rangos de meses (dependen de un "hoy" inyectado)', () => {
  const hoy = new Date(2026, 7, 9); // 9 de agosto de 2026 (mes 7 = agosto, 0-indexado)

  it('mesesTrimestreActual devuelve los 3 meses del trimestre calendario', () => {
    expect(win.mesesTrimestreActual(hoy)).toEqual(['2026-07', '2026-08', '2026-09']);
  });
  it('mesesSemestreActual devuelve los 6 meses del semestre calendario', () => {
    expect(win.mesesSemestreActual(hoy)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  });
  it('mesesAnioActual devuelve los 12 meses del año', () => {
    expect(win.mesesAnioActual(hoy)).toHaveLength(12);
    expect(win.mesesAnioActual(hoy)[0]).toBe('2026-01');
    expect(win.mesesAnioActual(hoy)[11]).toBe('2026-12');
  });
  it('mesOffset se mueve hacia adelante/atrás cruzando años', () => {
    expect(win.mesOffset(hoy, -8)).toBe('2025-12');
    expect(win.mesOffset(hoy, 5)).toBe('2027-01');
  });
  it('mesesUltimos incluye el mes actual como último elemento', () => {
    expect(win.mesesUltimos(hoy, 3)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('mesesProximos no incluye el mes actual', () => {
    expect(win.mesesProximos(hoy, 3)).toEqual(['2026-09', '2026-10', '2026-11']);
  });
});

describe('mesesParaRango / diasHasta (dependen del reloj del sistema)', () => {
  let restoreNow;
  beforeEach(() => { restoreNow = mockNow(win, new win.Date(2026, 7, 9)); });
  afterEach(() => { restoreNow(); });

  it('mesesParaRango "3m" delega en mesesUltimos con el reloj actual', () => {
    expect(win.mesesParaRango([], '3m')).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('mesesParaRango "todo" devuelve la lista de meses disponibles tal cual', () => {
    const disponibles = ['2026-01', '2026-05'];
    expect(win.mesesParaRango(disponibles, 'todo')).toBe(disponibles);
  });
  it('diasHasta calcula días positivos para fechas futuras y negativos para pasadas', () => {
    expect(win.diasHasta('2026-08-19')).toBe(10);
    expect(win.diasHasta('2026-08-04')).toBe(-5);
    expect(win.diasHasta('2026-08-09')).toBe(0);
  });
  it('diasHasta devuelve null sin fecha', () => {
    expect(win.diasHasta('')).toBeNull();
  });
});
