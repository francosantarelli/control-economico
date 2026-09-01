// Emite una Factura C ante ARCA (ex AFIP) para una "Venta USDT", a Consumidor Final sin
// identificar, validando antes que no se supere el tope de facturación de la categoría de
// Monotributo (acumulado de los últimos 12 meses móviles, el criterio real de recategorización).
//
// Se invoca desde la app con sb.functions.invoke('facturar-arca', {body:{movimientoId}}) — hereda
// el JWT del usuario logueado (verify_jwt no está deshabilitado acá), así que corre bajo las mismas
// políticas RLS que el resto de la app: no hace falta service_role.
//
// Contrato de respuesta: SIEMPRE HTTP 200 salvo errores de request/internos genuinos, con body
// { factura: <fila de facturas o null>, error: <mensaje o null> } — así el cliente puede mostrar
// el motivo real (límite superado, rechazo de ARCA) sin depender de cómo el SDK expone el body de
// un status no-2xx.
//
// Secrets necesarios (`npx supabase secrets set NOMBRE=valor`, nunca en el código ni en el chat):
//   ARCA_CUIT          — CUIT sin guiones
//   ARCA_CERT_B64      — certificado (el emitido por ARCA, no el CSR) en base64 de una línea
//   ARCA_KEY_B64       — clave privada SIN passphrase, en base64 de una línea
//   ARCA_PUNTO_VENTA   — número de punto de venta habilitado para Web Services
//   ARCA_AMBIENTE      — 'homologacion' | 'produccion' (arrancar en homologacion)
//   ARCA_WSAA_URL      — opcional, default homologación
//   ARCA_WSFE_URL      — opcional, default homologación
//   ARCA_CONCEPTO      — opcional, default '2' (Servicios). Confirmar con tu contador si la venta
//                        de USDT corresponde facturarla como Servicios (2) o Productos (1).

import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const WSAA_URL_DEFAULT = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";
const WSFE_URL_DEFAULT = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";
const CBTE_TIPO_POR_LETRA: Record<string, number> = { C: 11 };

function env(nombre: string): string {
  const v = Deno.env.get(nombre);
  if (!v) throw new Error(`Falta el secret ${nombre}`);
  return v;
}
function pemDesdeBase64(b64: string): string {
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  if (!decoded.includes("-----BEGIN")) throw new Error("El secret no decodifica a un PEM válido");
  return decoded;
}
function hoyArgentinaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}
// Ventana de 12 meses móviles terminando en fechaRefISO (inclusive) — mismo criterio que
// acumuladoFacturado12Meses en app.js. No se puede compartir código entre Deno y el browser,
// así que la fórmula está documentada en ambos lados para mantenerlos consistentes.
function inicioVentana12Meses(fechaRefISO: string): string {
  const m = fechaRefISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("fecha de referencia inválida: " + fechaRefISO);
  const y = parseInt(m[1], 10), mes = parseInt(m[2], 10), dia = parseInt(m[3], 10);
  const d = new Date(y, mes - 1 - 12, dia);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tag(xml: string, nombre: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nombre}>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`));
  return m ? m[1].trim() : null;
}

// ---- WSAA: obtener (o reusar del caché) el Token+Sign para el servicio "wsfe" ----
function armarTRA(servicio: string): string {
  const ahora = new Date();
  const generationTime = new Date(ahora.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(ahora.getTime() + 10 * 60 * 1000).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>
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
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}
async function pedirTaNueva(certPem: string, keyPem: string, wsaaUrl: string) {
  const cms = firmarCMS(armarTRA("wsfe"), certPem, keyPem);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(wsaaUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
    body: soapBody,
  });
  const texto = await res.text();
  const decodificado = texto.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const token = tag(decodificado, "token");
  const sign = tag(decodificado, "sign");
  if (!token || !sign) throw new Error("WSAA no devolvió token/sign: " + texto.slice(0, 500));
  return { token, sign };
}
async function obtenerTokenYSign(
  sb: ReturnType<typeof createClient>,
  ambiente: string,
  certPem: string,
  keyPem: string,
  wsaaUrl: string,
) {
  const { data: cache } = await sb.from("arca_ta").select("*").eq("ambiente", ambiente).maybeSingle();
  const margenMs = 5 * 60 * 1000; // renovar 5 min antes de que expire, no al filo
  if (cache && new Date(cache.expira_en).getTime() > Date.now() + margenMs) {
    return { token: cache.token, sign: cache.sign };
  }
  const { token, sign } = await pedirTaNueva(certPem, keyPem, wsaaUrl);
  const expiraEn = new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString(); // TA dura ~12hs; 11 de margen
  await sb.from("arca_ta").upsert({ ambiente, token, sign, expira_en: expiraEn });
  return { token, sign };
}

// ---- WSFEv1: número de comprobante y CAE ----
async function fecompUltimoAutorizado(
  wsfeUrl: string,
  auth: { token: string; sign: string; cuit: string },
  ptoVta: number,
  cbteTipo: number,
) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth><ar:Token>${auth.token}</ar:Token><ar:Sign>${auth.sign}</ar:Sign><ar:Cuit>${auth.cuit}</ar:Cuit></ar:Auth>
      <ar:PtoVta>${ptoVta}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(wsfeUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado" },
    body,
  });
  const texto = await res.text();
  const cbteNro = tag(texto, "CbteNro");
  if (cbteNro == null) throw new Error("No se pudo leer el último comprobante autorizado: " + texto.slice(0, 500));
  return parseInt(cbteNro, 10);
}

function extraerErrores(xml: string): string | null {
  const errs = [...xml.matchAll(/<(?:\w+:)?Err>[\s\S]*?<(?:\w+:)?Msg>([\s\S]*?)<\/(?:\w+:)?Msg>[\s\S]*?<\/(?:\w+:)?Err>/g)];
  if (!errs.length) return null;
  return errs.map((m) => m[1].trim()).join("; ");
}

async function fecaeSolicitar(
  wsfeUrl: string,
  auth: { token: string; sign: string; cuit: string },
  datos: { ptoVta: number; cbteTipo: number; numero: number; fechaISO: string; importe: number; concepto: number },
) {
  const fch = datos.fechaISO.replace(/-/g, "");
  const camposServicio = datos.concepto === 1 ? "" : `
        <ar:FchServDesde>${fch}</ar:FchServDesde>
        <ar:FchServHasta>${fch}</ar:FchServHasta>
        <ar:FchVtoPago>${fch}</ar:FchVtoPago>`;
  const importe = datos.importe.toFixed(2);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth><ar:Token>${auth.token}</ar:Token><ar:Sign>${auth.sign}</ar:Sign><ar:Cuit>${auth.cuit}</ar:Cuit></ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${datos.ptoVta}</ar:PtoVta><ar:CbteTipo>${datos.cbteTipo}</ar:CbteTipo></ar:FeCabReq>
        <ar:FeDetReq><ar:FECAEDetRequest>
          <ar:Concepto>${datos.concepto}</ar:Concepto>
          <ar:DocTipo>99</ar:DocTipo>
          <ar:DocNro>0</ar:DocNro>
          <ar:CbteDesde>${datos.numero}</ar:CbteDesde>
          <ar:CbteHasta>${datos.numero}</ar:CbteHasta>
          <ar:CbteFch>${fch}</ar:CbteFch>
          <ar:ImpTotal>${importe}</ar:ImpTotal>
          <ar:ImpTotConc>0.00</ar:ImpTotConc>
          <ar:ImpNeto>${importe}</ar:ImpNeto>
          <ar:ImpOpEx>0.00</ar:ImpOpEx>
          <ar:ImpIVA>0.00</ar:ImpIVA>
          <ar:ImpTrib>0.00</ar:ImpTrib>
          <ar:MonId>PES</ar:MonId>
          <ar:MonCotiz>1</ar:MonCotiz>${camposServicio}
        </ar:FECAEDetRequest></ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(wsfeUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar" },
    body,
  });
  const texto = await res.text();
  const detalle = tag(texto, "FECAEDetResponse") || "";
  const resultado = tag(detalle, "Resultado");
  const cae = tag(detalle, "CAE");
  const caeFchVto = tag(detalle, "CAEFchVto"); // formato AAAAMMDD
  const errorMsg = extraerErrores(detalle) || extraerErrores(texto);
  if (resultado !== "A" || !cae) {
    throw new Error(errorMsg || ("ARCA rechazó el comprobante. Respuesta: " + texto.slice(0, 800)));
  }
  const vto = caeFchVto ? `${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}` : null;
  return { cae, caeVencimiento: vto };
}

Deno.serve(async (req) => {
  const jsonRes = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  let movimientoId: string;
  try {
    const body = await req.json();
    movimientoId = body?.movimientoId;
    if (!movimientoId) throw new Error("Falta movimientoId");
  } catch {
    return jsonRes(400, { factura: null, error: "Body inválido: se espera { movimientoId }" });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );

  const ambiente = Deno.env.get("ARCA_AMBIENTE") === "produccion" ? "produccion" : "homologacion";
  const puntoVenta = parseInt(env("ARCA_PUNTO_VENTA"), 10);
  const cuit = env("ARCA_CUIT");
  const concepto = parseInt(Deno.env.get("ARCA_CONCEPTO") || "2", 10);
  const wsaaUrl = Deno.env.get("ARCA_WSAA_URL") || WSAA_URL_DEFAULT;
  const wsfeUrl = Deno.env.get("ARCA_WSFE_URL") || WSFE_URL_DEFAULT;
  const tipoComprobante = "C";
  const cbteTipo = CBTE_TIPO_POR_LETRA[tipoComprobante];

  try {
    const { data: mov, error: errMov } = await sb
      .from("movimientos").select("*, subcategorias(nombre)").eq("id", movimientoId).single();
    if (errMov || !mov) return jsonRes(400, { factura: null, error: "No se encontró el movimiento" });
    const esVentaUsdt = (mov.subcategorias?.nombre || "").trim() === "Venta USDT";
    const importe = Number(mov.ingreso) || 0;
    if (!esVentaUsdt || importe <= 0) {
      return jsonRes(400, { factura: null, error: "Este movimiento no es una Venta USDT facturable" });
    }

    const { data: existente } = await sb
      .from("facturas").select("*").eq("movimiento_id", movimientoId).eq("estado", "emitida").maybeSingle();
    if (existente) return jsonRes(200, { factura: existente, error: null });

    const hoy = hoyArgentinaISO();
    const desde = inicioVentana12Meses(hoy);
    const { data: emitidas } = await sb
      .from("facturas").select("importe").eq("estado", "emitida").gte("fecha", desde).lte("fecha", hoy);
    const acumulado = (emitidas || []).reduce((s, f) => s + (Number(f.importe) || 0), 0);
    const { data: cfg } = await sb.from("configuracion").select("valor").eq("clave", "monotributo_limite_categoria_b").maybeSingle();
    const limite = cfg ? Number(cfg.valor) || 0 : 0;
    if (limite > 0 && acumulado + importe > limite) {
      const mensaje = `Esto te haría superar el límite de categoría B: $${(acumulado + importe).toFixed(2)} de $${limite.toFixed(2)} (acumulado 12 meses: $${acumulado.toFixed(2)})`;
      const { data: filaError } = await sb.from("facturas").insert({
        movimiento_id: movimientoId, fecha: hoy, tipo_comprobante: tipoComprobante, punto_venta: puntoVenta,
        importe, estado: "error", error: mensaje, ambiente,
      }).select().single();
      return jsonRes(200, { factura: filaError, error: mensaje });
    }

    const { data: filaPendiente, error: errInsert } = await sb.from("facturas").insert({
      movimiento_id: movimientoId, fecha: hoy, tipo_comprobante: tipoComprobante, punto_venta: puntoVenta,
      importe, estado: "pendiente", ambiente,
    }).select().single();
    if (errInsert || !filaPendiente) throw new Error("No se pudo reservar la factura: " + (errInsert?.message || ""));

    try {
      const certPem = pemDesdeBase64(env("ARCA_CERT_B64"));
      const keyPem = pemDesdeBase64(env("ARCA_KEY_B64"));
      const { token, sign } = await obtenerTokenYSign(sb, ambiente, certPem, keyPem, wsaaUrl);
      const auth = { token, sign, cuit };

      const ultimo = await fecompUltimoAutorizado(wsfeUrl, auth, puntoVenta, cbteTipo);
      const numero = ultimo + 1;
      const { cae, caeVencimiento } = await fecaeSolicitar(wsfeUrl, auth, {
        ptoVta: puntoVenta, cbteTipo, numero, fechaISO: hoy, importe, concepto,
      });

      const { data: filaFinal } = await sb.from("facturas").update({
        numero, cae, cae_vencimiento: caeVencimiento, estado: "emitida",
      }).eq("id", filaPendiente.id).select().single();
      return jsonRes(200, { factura: filaFinal, error: null });
    } catch (eArca) {
      const mensaje = eArca instanceof Error ? eArca.message : String(eArca);
      const { data: filaError } = await sb.from("facturas").update({ estado: "error", error: mensaje })
        .eq("id", filaPendiente.id).select().single();
      return jsonRes(200, { factura: filaError, error: mensaje });
    }
  } catch (e) {
    return jsonRes(500, { factura: null, error: e instanceof Error ? e.message : String(e) });
  }
});
