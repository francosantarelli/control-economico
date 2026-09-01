// SPIKE — no es la Edge Function final, es para validar UNA sola cosa antes de construir el resto:
// ¿se puede firmar un TRA (CMS/PKCS#7) con node-forge dentro del runtime de Supabase Edge Functions
// (Deno) y conseguir un Token+Sign real de WSAA homologación? Si esto no funciona acá, hay que
// reevaluar la plataforma (otro runtime con Node completo) antes de invertir en el resto del feature
// de facturación ARCA. Una vez validado, este archivo se borra — no es la función "facturar-arca".
//
// Uso: desplegar con secrets ya seteados (ver más abajo) e invocar sin body:
//   npx supabase functions deploy arca-wsaa-spike --no-verify-jwt
//   curl -s "https://<project-ref>.supabase.co/functions/v1/arca-wsaa-spike" | jq .
//
// Secrets que necesita (setear con `npx supabase secrets set NOMBRE=valor`, nunca commitear ni
// pegar el contenido de cert/key en el chat/código):
//   ARCA_CUIT        — CUIT sin guiones, ej. 20304050607
//   ARCA_CERT_B64     — certificado de homologación (.crt), en base64 de una sola línea
//   ARCA_KEY_B64      — clave privada SIN passphrase (.key), en base64 de una sola línea
//   ARCA_WSAA_URL     — (opcional) URL del endpoint LoginCms de WSAA homologación; default abajo.
//                       Verificar contra la documentación oficial vigente de ARCA antes de confiar
//                       en el default, porque el rebranding AFIP→ARCA (2024) pudo cambiar hostnames.

import forge from "npm:node-forge@1.3.1";

const WSAA_URL_DEFAULT = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

function env(nombre: string): string {
  const v = Deno.env.get(nombre);
  if (!v) throw new Error(`Falta el secret ${nombre}`);
  return v;
}

function pemDesdeBase64(b64: string): string {
  // Acepta tanto un PEM ya en base64 "tal cual" (con headers -----BEGIN...-----) codificado a
  // base64, como el base64 puro del contenido. Priorizamos: decodificar y usar directo si ya es PEM.
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  if (decoded.includes("-----BEGIN")) return decoded;
  throw new Error("El secret no decodifica a un PEM válido (¿faltó base64-encodear el archivo .crt/.key?)");
}

function armarTRA(servicio: string): string {
  const ahora = new Date();
  const generationTime = new Date(ahora.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(ahora.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(ahora.getTime() / 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
}

function firmarCMS(traXml: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: false });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function pedirTokenYSign(cmsBase64: string, wsaaUrl: string) {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(wsaaUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
    body: soapBody,
  });
  const texto = await res.text();
  return { status: res.status, texto };
}

Deno.serve(async () => {
  try {
    const cuit = env("ARCA_CUIT");
    const certPem = pemDesdeBase64(env("ARCA_CERT_B64"));
    const keyPem = pemDesdeBase64(env("ARCA_KEY_B64"));
    const wsaaUrl = Deno.env.get("ARCA_WSAA_URL") || WSAA_URL_DEFAULT;

    const tra = armarTRA("wsfe");
    const cms = firmarCMS(tra, certPem, keyPem);
    const { status, texto } = await pedirTokenYSign(cms, wsaaUrl);

    const tieneToken = /<token>/.test(texto) || /&lt;token&gt;/.test(texto);
    const tieneSign = /<sign>/.test(texto) || /&lt;sign&gt;/.test(texto);

    return new Response(
      JSON.stringify({
        ok: tieneToken && tieneSign,
        cuit,
        wsaaUrl,
        httpStatus: status,
        tieneToken,
        tieneSign,
        respuestaCruda: texto,
      }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
