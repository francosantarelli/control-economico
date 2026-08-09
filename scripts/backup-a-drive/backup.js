// Backup diario de Control Económico a Google Drive.
// Corre desde GitHub Actions (ver .github/workflows/backup-diario.yml), no desde la app.
// Necesita 3 variables de entorno (configuradas como secrets del repo en GitHub):
//   SUPABASE_SERVICE_ROLE_KEY  - Project Settings > API > "service_role" en Supabase
//   GDRIVE_SERVICE_ACCOUNT_JSON - contenido completo del JSON de la cuenta de servicio de Google
//   GDRIVE_FOLDER_ID           - ID de la carpeta de Drive destino (compartida con esa cuenta de servicio)
import { google } from 'googleapis';

const SUPABASE_URL = 'https://krgwoiufhvhoqucqjpff.supabase.co';
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const GDRIVE_FOLDER_ID = requireEnv('GDRIVE_FOLDER_ID');
const GDRIVE_SERVICE_ACCOUNT_JSON = requireEnv('GDRIVE_SERVICE_ACCOUNT_JSON');

// Mismas tablas que exporta el botón "Descargar backup" de la app.
const TABLAS = ['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos'];

function requireEnv(nombre) {
  var valor = process.env[nombre];
  if (!valor) throw new Error('Falta la variable de entorno ' + nombre);
  return valor;
}

async function leerTabla(nombre) {
  var res = await fetch(SUPABASE_URL + '/rest/v1/' + nombre + '?select=*', {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SERVICE_ROLE_KEY
    }
  });
  if (!res.ok) {
    throw new Error('No se pudo leer "' + nombre + '": ' + res.status + ' ' + (await res.text()));
  }
  return res.json();
}

async function subirADrive(nombreArchivo, contenidoJson) {
  var credentials = JSON.parse(GDRIVE_SERVICE_ACCOUNT_JSON);
  var auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  var drive = google.drive({ version: 'v3', auth: auth });
  await drive.files.create({
    requestBody: { name: nombreArchivo, parents: [GDRIVE_FOLDER_ID] },
    media: { mimeType: 'application/json', body: contenidoJson },
    fields: 'id'
  });
}

async function main() {
  var datosPorTabla = {};
  for (var i = 0; i < TABLAS.length; i++) {
    var nombre = TABLAS[i];
    datosPorTabla[nombre] = await leerTabla(nombre);
  }

  var backupObj = Object.assign(
    { version: 1, exportadoEn: new Date().toISOString() },
    datosPorTabla
  );

  var fecha = new Date().toISOString().slice(0, 10);
  var nombreArchivo = 'backup-control-economico-' + fecha + '.json';
  var contenido = JSON.stringify(backupObj, null, 2);

  await subirADrive(nombreArchivo, contenido);
  console.log('Backup subido a Drive: ' + nombreArchivo);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
