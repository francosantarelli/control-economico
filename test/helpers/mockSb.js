/**
 * Cliente Supabase falso para tests: soporta insert/update/delete/upsert (lo que usa
 * dbInsert/dbUpdate/dbDelete/dbUpsert en app.js), sin pegarle a la red. Cada llamada
 * queda registrada en `calls` para poder assertear qué se intentó persistir.
 */
export function mockSb() {
  const calls = [];
  function from(table) {
    return {
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
