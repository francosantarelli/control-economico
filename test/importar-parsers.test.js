import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';

// Estos fixtures son reconstrucciones a mano del formato de texto que se pega al importar
// (copiado de la web/app de cada banco o tarjeta), armadas leyendo línea por línea la regex/máquina
// de estados de cada parser en app.js — no son capturas reales de las páginas de los bancos.
// Si alguna vez se cuenta con un pegado real (con montos/nombres inventados), conviene reemplazar
// el fixture correspondiente por ese texto real para subir la confianza del test.

let win;
beforeEach(() => { win = loadApp(); });

describe('reconstructMontos', () => {
  it('reconstruye un monto partido en líneas "$" / dígitos / "," / decimales (sin separador de miles)', () => {
    const out = win.reconstructMontos(['$', '1.234', ',', '56']);
    expect(out).toEqual(['$1234,56']);
  });
  it('preserva el signo cuando viene en línea propia', () => {
    expect(win.reconstructMontos(['-', '$', '999', ',', '00'])).toEqual(['-$999,00']);
  });
  it('deja intactas las líneas que no son parte de un monto partido', () => {
    expect(win.reconstructMontos(['hola', 'chau'])).toEqual(['hola', 'chau']);
  });
});

describe('joinFechaLines', () => {
  it('colapsa un encabezado de fecha + Disponible + saldo en un token __FECHA__', () => {
    const out = win.joinFechaLines(['9 de agosto', 'Disponible', '$48.765,44', '10:30', 'Proveedor']);
    expect(out).toEqual(['__FECHA__9__agosto', '10:30', 'Proveedor']);
  });
  it('colapsa "Hoy" + Disponible + saldo en __HOY__', () => {
    const out = win.joinFechaLines(['Hoy', 'Disponible', '$100,00', '10:30']);
    expect(out).toEqual(['__HOY__', '10:30']);
  });
});

describe('procesarTexto (movimientos de cuenta, ej. Mercado Pago)', () => {
  it('arma un movimiento a partir de fecha + hora + proveedor + tipo + monto', () => {
    const raw = [
      '9 de agosto',
      'Disponible',
      '$48.765,44',
      '10:30',
      'Juan Perez',
      'Transferencia enviada',
      'Movimiento ...',
      '-$1.234,56',
    ].join('\n');
    expect(win.procesarTexto(raw, '26')).toEqual([{
      fecha: '09-08-26', proveedor: 'Juan Perez', tipo: 'Transferencia enviada',
      monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);
  });

  it('usa la fecha de hoy y el tipo por defecto cuando el monto sigue directo al proveedor', () => {
    const restoreNow = mockNow(win, new win.Date(2026, 7, 9));
    try {
      const raw = ['Hoy', 'Disponible', '$50.000,00', '15:45', 'Kiosco Las Flores', '$2.500,00'].join('\n');
      expect(win.procesarTexto(raw, '26')).toEqual([{
        fecha: '09-08-26', proveedor: 'Kiosco Las Flores', tipo: 'Transferencia enviada',
        monto: 2500, ingreso: '2.500,00', egreso: '',
      }]);
    } finally {
      restoreNow();
    }
  });
});

describe('parseTarjetaSantander', () => {
  it('agrupa consumos bajo su fecha de consumo y limpia el sufijo "Cuota N de M"', () => {
    const raw = [
      '5 de agosto',
      'SUPERMERCADO LA ANONIMA',
      '1.234,56',
      '6 de agosto',
      'NETFLIX.COM',
      'Cuota 1 de 3',
      '890,00',
    ].join('\n');
    const rows = win.parseTarjetaSantander(raw, '2026-08-10');
    expect(rows).toEqual([
      { fecha: '10-08-26', fechaConsumo: '05-08-26', proveedor: 'SUPERMERCADO LA ANONIMA', tipo: '', monto: -1234.56, ingreso: '', egreso: '1.234,56' },
      { fecha: '10-08-26', fechaConsumo: '06-08-26', proveedor: 'NETFLIX.COM', tipo: '', monto: -890, ingreso: '', egreso: '890,00' },
    ]);
  });
});

describe('parseTarjeta (genérico, Nación/Provincia)', () => {
  it('separa fecha, comprobante, detalle y monto de una línea de consumo', () => {
    const raw = '09.08.26 123456 SUPERMERCADO LA ANONIMA $1.234,56';
    const rows = win.parseTarjeta(raw, '2026-08-15');
    expect(rows).toEqual([{
      fecha: '15-08-26', fechaConsumo: '09-08-26', proveedor: 'SUPERMERCADO LA ANONIMA',
      tipo: '', monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);
  });

  it('descarta las líneas de pago del resumen ("Su pago...") para no contarlas como consumo', () => {
    const raw = '10.07.26 SU PAGO EN PESOS $50.000,00-';
    expect(win.parseTarjeta(raw, '2026-08-15')).toEqual([]);
  });

  it('un monto con signo "-" al final indica un crédito/devolución (queda como ingreso)', () => {
    const raw = '11.07.26 DEVOLUCION TIENDA $500,00-';
    const rows = win.parseTarjeta(raw, '2026-08-15');
    expect(rows).toEqual([{
      fecha: '15-08-26', fechaConsumo: '11-07-26', proveedor: 'DEVOLUCION TIENDA',
      tipo: '', monto: 500, ingreso: '500,00', egreso: '',
    }]);
  });
});

describe('parseTarjetaMercadoPago', () => {
  // Regresión del bug corregido en el commit 7ae1005: la fecha del MOVIMIENTO debe salir del
  // vencimiento tipeado (fechaOut, igual para todas las filas), y la fecha de CONSUMO debe salir
  // de la fecha propia de cada fila del resumen (distinta fila a fila).
  it('usa el vencimiento como fecha del movimiento y la fecha de la fila como fecha de consumo; omite filas en dólares', () => {
    const raw = '09/ago Supermercado La Anonima 1 de 3 4521 $ 1.234,56 '
      + '10/ago Netflix 998877 $ 890,00 '
      + '11/ago Amazon Compras 55443 US$ 12,50';
    const { rows, omitidas } = win.parseTarjetaMercadoPago(raw, '2026', '2026-08-20');

    expect(rows).toEqual([
      { fecha: '20-08-26', fechaConsumo: '09-08-26', proveedor: 'Supermercado La Anonima', tipo: '', monto: -1234.56, ingreso: '', egreso: '1.234,56' },
      { fecha: '20-08-26', fechaConsumo: '10-08-26', proveedor: 'Netflix', tipo: '', monto: -890, ingreso: '', egreso: '890,00' },
    ]);
    expect(omitidas).toBe(1);
    // la fecha del movimiento es la misma (vencimiento) en todas las filas, distinta de la de consumo
    expect(new Set(rows.map(function(r){ return r.fecha; })).size).toBe(1);
    expect(rows[0].fecha).not.toBe(rows[0].fechaConsumo);
  });
});

describe('parseProvincia', () => {
  it('lee bloques fecha + detalle + "Saldo:" + saldo + monto con signo', () => {
    const raw = [
      '09/08/2026', 'Transferencia recibida', 'Juan Perez', 'Saldo:', '$50.000,00', '$1.234,56',
      '10/08/2026', 'Pago de servicios', 'Saldo:', '$48.765,44', '-$500,00',
    ].join('\n');
    expect(win.parseProvincia(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Transferencia recibida Juan Perez', tipo: '', monto: 1234.56, ingreso: '1.234,56', egreso: '' },
      { fecha: '10-08-26', proveedor: 'Pago de servicios', tipo: '', monto: -500, ingreso: '', egreso: '500,00' },
    ]);
  });
});

describe('parseNacion', () => {
  it('separa columnas por tab, ignora comprobantes numéricos y toma el signo del monto', () => {
    const raw = [
      '09/08/2026\t001\tTransferencia a Juan Perez\t$1.234,56',
      '10/08/2026\t002\tPago Edenor\t-$890,00',
    ].join('\n');
    expect(win.parseNacion(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Transferencia a Juan Perez', tipo: '', monto: 1234.56, ingreso: '1.234,56', egreso: '' },
      { fecha: '10-08-26', proveedor: 'Pago Edenor', tipo: '', monto: -890, ingreso: '', egreso: '890,00' },
    ]);
  });
});

describe('parseSantander (cuenta)', () => {
  it('agrupa por bloques de fecha y extrae proveedor desde "De X/Y" o desde el tipo', () => {
    const raw = [
      '09/08/2026', 'Transferencia enviada', 'De Juan Perez/CBU1234',
      'Debito por transferencia en pesos argentino -$1.234,56',
      '10/08/2026', 'Compra', 'Pago con tarjeta en pesos argentino +$500,00',
    ].join('\n');
    expect(win.parseSantander(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Juan Perez', tipo: 'Transferencia enviada', monto: -1234.56, ingreso: '', egreso: '1.234,56' },
      { fecha: '10-08-26', proveedor: 'Compra', tipo: 'Compra', monto: 500, ingreso: '500,00', egreso: '' },
    ]);
  });
});

describe('parseExcelHistorico', () => {
  it('ignora la fila de encabezado y mapea las 10 columnas esperadas', () => {
    const raw = [
      'Periodo\tTipo\tCategoria\tSubcategoria\tCC\tFecha\tProveedor\tDetalle\tIngresos\tEgresos',
      '2026-08\tEgreso\tComida\tSupermercado\tEF\t09/08/2026\tLa Anonima\tCompra semanal\t\t1234,56',
    ].join('\n');
    expect(win.parseExcelHistorico(raw)).toEqual([{
      fecha: '2026-08-09', cc: 'EF', categoria: 'Comida', subcategoria: 'Supermercado',
      proveedor: 'La Anonima', detalle: 'Compra semanal', ingreso: 0, egreso: 1234.56,
    }]);
  });
});
