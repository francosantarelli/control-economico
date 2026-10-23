// Se corre UNA vez, a mano, en tu compu: obtiene el refresh token de OAuth que usa backup.js para
// subir el backup a Drive con tu cuenta. No corre en GitHub Actions.
//
// Antes, en Google Cloud Console (el mismo proyecto donde está habilitada la Google Drive API):
//   1. APIs y servicios > Pantalla de consentimiento de OAuth: tipo "Externo", agregá tu mail como
//      usuario de prueba y después tocá "Publicar app" (estado "En producción"). Si queda en
//      "Prueba", Google vence el refresh token a los 7 días y el backup deja de andar.
//   2. APIs y servicios > Credenciales > Crear credenciales > ID de cliente de OAuth, tipo
//      "App de escritorio". Copiá el ID de cliente y el secreto.
//
// Uso (desde scripts/backup-a-drive, con `npm install` ya hecho):
//   node obtener-refresh-token.js <ID_DE_CLIENTE> <SECRETO>
// Se abre el navegador, elegís tu cuenta y aceptás (va a decir "Google no verificó esta app": es
// la tuya, tocá "Avanzado" > "Ir a ..."). Al terminar, el refresh token se imprime acá.
import http from 'node:http';
import { exec } from 'node:child_process';
import { google } from 'googleapis';

// Acceso completo a Drive: con el scope reducido "drive.file" no se puede escribir en una carpeta
// que creaste vos a mano (solo en las que crea la propia app).
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const clientId = process.argv[2] || process.env.GDRIVE_OAUTH_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GDRIVE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Uso: node obtener-refresh-token.js <ID_DE_CLIENTE> <SECRETO>');
  process.exit(1);
}

function abrirNavegador(url) {
  var comando = process.platform === 'win32' ? 'start "" "' + url + '"'
    : process.platform === 'darwin' ? 'open "' + url + '"'
    : 'xdg-open "' + url + '"';
  exec(comando, function () { /* si falla, igual está la URL impresa en la consola */ });
}

// Servidor local de un solo uso: Google redirige acá (http://127.0.0.1:<puerto>) con el código de
// autorización después de que aceptás. Los clientes "App de escritorio" aceptan cualquier puerto.
var servidor = http.createServer();
servidor.listen(0, '127.0.0.1', function () {
  var redirectUri = 'http://127.0.0.1:' + servidor.address().port;
  var oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  var authUrl = oauth.generateAuthUrl({
    access_type: 'offline', // para que devuelva un refresh token, no solo un access token
    prompt: 'consent',      // fuerza a Google a devolverlo aunque ya hayas autorizado antes
    scope: SCOPES
  });

  servidor.on('request', async function (req, res) {
    var params = new URL(req.url, redirectUri).searchParams;
    if (!params.has('code') && !params.has('error')) { res.writeHead(404); res.end(); return; }
    try {
      if (params.get('error')) throw new Error('Google devolvió: ' + params.get('error'));
      var respuesta = await oauth.getToken(params.get('code'));
      var refreshToken = respuesta.tokens.refresh_token;
      if (!refreshToken) throw new Error('Google no devolvió refresh token. Probá de nuevo.');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>Listo</h2><p>Ya podés cerrar esta pestaña y volver a la consola.</p>');
      console.log('\nRefresh token (cargalo como secret GDRIVE_OAUTH_REFRESH_TOKEN en GitHub):\n');
      console.log(refreshToken + '\n');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>Error</h2><p>Mirá la consola.</p>');
      console.error('\n' + (err.message || err));
      process.exitCode = 1;
    }
    servidor.close();
  });

  console.log('Abriendo el navegador para autorizar el acceso a Drive...');
  console.log('Si no se abre solo, entrá a esta URL:\n\n' + authUrl + '\n');
  abrirNavegador(authUrl);
});
