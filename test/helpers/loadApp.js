import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const rawHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// Sacamos el <script> externo del SDK de Supabase: no queremos que jsdom intente
// pegarle a la red en cada test. Sin `window.supabase`, app.js deja `sb = null`
// y arranca en modo "no se pudo cargar la librería" sin romper nada (ver initAuth()).
const html = rawHtml.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, '');
const appJsSource = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/**
 * Crea una ventana jsdom nueva con index.html + app.js cargados, tal como los
 * cargaría un navegador. Cada llamada devuelve un STATE/DOM aislado.
 */
export function loadApp() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = appJsSource;
  dom.window.document.body.appendChild(scriptEl);
  return dom.window;
}

/**
 * Fija el reloj interno de una ventana jsdom (la que devuelve loadApp()) a `fixedDate`.
 * `win` vive en un realm separado del proceso de test, así que vi.useFakeTimers()/vi.setSystemTime
 * de Vitest NO alcanzan al `new Date()` que corre dentro de app.js — hay que pisar win.Date directo.
 * Devuelve una función para restaurar el Date original.
 */
export function mockNow(win, fixedDate) {
  const RealDate = win.Date;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(fixedDate);
      super(...args);
    }
    static now() { return new RealDate(fixedDate).getTime(); }
  }
  win.Date = MockDate;
  return () => { win.Date = RealDate; };
}
