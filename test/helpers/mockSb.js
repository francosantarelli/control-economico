/**
 * Cliente Supabase falso para tests: soporta insert/update/delete/upsert (lo que usa
 * dbInsert/dbUpdate/dbDelete/dbUpsert en app.js), sin pegarle a la red. Cada llamada
 * queda registrada en `calls` para poder assertear qué se intentó persistir.
 * `tablas` (opcional) son las filas que devuelve select() por tabla, paginadas con range() como
 * lo pide dbFetchAll.
 */
export function mockSb(tablas = {}) {
  const calls = [];
  function from(table) {
    return {
      select() {
        const consulta = {
          order: () => consulta,
          range: async (desde, hasta) => ({ data: (tablas[table] || []).slice(desde, hasta + 1), error: null })
        };
        return consulta;
      },
      insert(rows) {
        calls.push({ op: 'insert', table, rows });
        return { select: async () => ({ data: Array.isArray(rows) ? rows : [rows], error: null }) };
      },
      update(fields) {
        return {
          eq: async (col, val) => {
            calls.push({ op: 'update', table, fields, val });
            return { error: null };
          }
        };
      },
      delete() {
        return {
          eq: async (col, val) => {
            calls.push({ op: 'delete', table, val });
            return { error: null };
          }
        };
      },
      upsert(rows) {
        calls.push({ op: 'upsert', table, rows });
        return { select: async () => ({ data: rows, error: null }) };
      }
    };
  }
  return { calls, client: { from } };
}
