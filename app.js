// ===================== ESTADO Y CONEXIÓN A SUPABASE =====================
var SUPABASE_URL = 'https://krgwoiufhvhoqucqjpff.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyZ3dvaXVmaHZob3F1Y3FqcGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MDA2MTIsImV4cCI6MjA5OTk3NjYxMn0.HxA7P1_LUEkZq75kMPKmiCLixeJQ2sROXcmW37gnQOE';
var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ===================== REGLAS DE CATEGORIZACIÓN AL IMPORTAR (localStorage) =====================
// Coincidencia parcial (substring, sin distinguir mayúsc/minúsc) del proveedor de la fila importada
// contra el texto de cada regla. Se guardan en el navegador, no en la base de datos compartida.
var REGLAS_STORAGE_KEY = 'controlEconomico_reglasCategorizacion';
var REGLAS_DEFAULT = [
  {proveedor:'Barrientos', categoria:'Casa', subcategoria:'Limpieza'},
  {proveedor:'Zuvilivia', categoria:'Comida', subcategoria:'Carnicería'},
  {proveedor:'Melina', categoria:'Comida', subcategoria:'Verdulería'},
  {proveedor:'Rocio Jaqueline Oderda', categoria:'Comida', subcategoria:'Panadería'},
  {proveedor:'Kiosco las flores', categoria:'Salida', subcategoria:'Kiosco'},
  {proveedor:'Rendimientos', categoria:'Intereses', subcategoria:'Rendimientos'},
  {proveedor:'Nahir Aldana Kastelan', categoria:'Emma y Juli', subcategoria:'Librería'},
  {proveedor:'Carina Ines', categoria:'Emma y Juli', subcategoria:'Pañalera'},
  {proveedor:'Macarena', categoria:'Emma y Juli', subcategoria:'Niñera'},
  {proveedor:'Boqon', categoria:'Salida', subcategoria:''},
  {proveedor:'Casa oriental', categoria:'Casa', subcategoria:''},
  {proveedor:'Claudio Gabriel Valerio', categoria:'Super', subcategoria:''},
  {proveedor:'Luis Alberto Aguero', categoria:'Obra', subcategoria:'Albañil'},
  {proveedor:'Francisco Mira', categoria:'Comida', subcategoria:'Dietética'},
  {proveedor:'Mariano Del Valle', categoria:'Comida', subcategoria:'Pollería'},
  {proveedor:'Gustavo Canale', categoria:'Obra', subcategoria:''},
  {proveedor:'PEMASYS S. A.', categoria:'Sueldo', subcategoria:'Maslow'},
  {proveedor:'Rendimiento', categoria:'Intereses', subcategoria:''},
  {proveedor:'LA ANóNIMA SUC 100', categoria:'Super', subcategoria:''},
  {proveedor:'APPYPF 03008 COMBUST', categoria:'Auto', subcategoria:''},
  {proveedor:'Spotify', categoria:'Servicios', subcategoria:'Spotify'},
  {proveedor:'IMPUESTO DE SELLOS', categoria:'Servicios', subcategoria:'Gastos Bancarios'},
  {proveedor:'IIBB PERCEP-BSAS 2,00%( 5499,00)', categoria:'Servicios', subcategoria:'Gastos Bancarios'},
  {proveedor:'IVA RG 4240 21%( 5499,00)', categoria:'Servicios', subcategoria:'Gastos Bancarios'},
  {proveedor:'DB.RG 5617 30% ( 5499,00 )', categoria:'Servicios', subcategoria:'Gastos Bancarios'}
];
function guardarReglas(lista){
  try{ window.localStorage.setItem(REGLAS_STORAGE_KEY, JSON.stringify(lista)); }catch(e){}
}
function cargarReglas(){
  try{
    var raw = window.localStorage.getItem(REGLAS_STORAGE_KEY);
    if(raw){
      var parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  }catch(e){}
  var seed = REGLAS_DEFAULT.map(function(r){ return Object.assign({id:uid()}, r); });
  guardarReglas(seed);
  return seed;
}

var STATE = { centros: [], categorias: [], subcategorias: [], movimientos: [], vencimientos: [], gimnasioVisitas: [], activeTab: 'movimientos', editing: null, ready:false,
  importEntidad:'mp', importAnio:'26', importBanco:'nacion', importVencimiento:'', importTarjetaMarca:'', importRaw:'', importPreview:null, importPreviewExcel:null, importMsg:null,
  bulkCatMsg:null, bulkColorCatMsg:null, confirmState:null, subDeleteState:null, movFormMsg:null,
  filtros:{centro:[], categoria:[], subcategoria:[], mes:[], texto:'', soloIncompletos:false, soloTarjeta:false},
  resumenFiltros:{centro:[], categoria:[], mes:[], vista:'categoria'}, multiSelectAbierto:null, multiSelectBusqueda:'', abmSubTab:'categorias', grillaRango:'todo',
  bulkVencMsg:null, vencFormMsg:null, dbError:null, saldosCache:null, saldosDirty:true, gimnasioMsg:null,
  usuarioEmail:null, efectivoAbierto:false, efectivoMsg:null, efectivoCategoriaId:'', backupMsg:null, backupPendiente:null, menuMovilAbierto:false, incompletosSnapshotIds:null,
  reglas: cargarReglas(), reglaFormMsg:null,
  nuevoMovAbierto:false, movDraftCentroDestinoId:'', comboAbierto:null, comboBusqueda:'', comboHighlight:0,
  movSeleccionados:[], bulkEditMovAbierto:false, bulkEditMovMsg:null, movPaginaActual:1, gruposAbiertos:{},
  tema: (function(){ try{ return localStorage.getItem('controlTema')==='oscuro' ? 'oscuro' : 'claro'; }catch(e){ return 'claro'; } })(),
  menuUsuarioAbierto:false };
var MOV_PAGE_SIZE = 50;

// ===================== FILTROS MÚLTIPLES (selects convertidos a checkboxes) =====================
var MULTISELECT_MAP = {
  'ff-centro': {store:'filtros', field:'centro'},
  'ff-categoria': {store:'filtros', field:'categoria'},
  'ff-subcategoria': {store:'filtros', field:'subcategoria'},
  'ff-mes': {store:'filtros', field:'mes'},
  'rf-centro': {store:'resumenFiltros', field:'centro'},
  'rf-categoria': {store:'resumenFiltros', field:'categoria'},
  'rf-mes': {store:'resumenFiltros', field:'mes'}
};
function arrayFiltro(msId){
  var map = MULTISELECT_MAP[msId];
  if(!map) return [];
  var obj = STATE[map.store];
  if(!obj[map.field]) obj[map.field] = [];
  return obj[map.field];
}
function toggleMultiSelectValor(msId, valor, marcado){
  var arr = arrayFiltro(msId);
  var idx = arr.indexOf(valor);
  if(marcado && idx===-1) arr.push(valor);
  else if(!marcado && idx!==-1) arr.splice(idx,1);
  if(MULTISELECT_MAP[msId] && MULTISELECT_MAP[msId].store==='filtros') STATE.movPaginaActual = 1;
  if(msId==='ff-categoria' && STATE.filtros.categoria.length){
    // podar de la selección de Subcategoría las que ya no pertenecen a ninguna categoría elegida
    var catArr = STATE.filtros.categoria;
    STATE.filtros.subcategoria = (STATE.filtros.subcategoria||[]).filter(function(v){
      if(v==='__vacio__') return true;
      var s = STATE.subcategorias.find(function(x){return x.id===v;});
      return s && catArr.indexOf(s.categoriaId)!==-1;
    });
  }
}
function renderMultiSelect(id, options, seleccion){
  var abierto = STATE.multiSelectAbierto === id;
  var resumen;
  if(!seleccion.length) resumen = 'Todos';
  else if(seleccion.length===1){
    var opt = options.find(function(o){ return o.value===seleccion[0]; });
    resumen = opt ? opt.label : '1 seleccionado';
  } else resumen = seleccion.length+' seleccionados';

  var panelHtml = '';
  if(abierto){
    var q = (STATE.multiSelectBusqueda||'').trim().toLowerCase();
    var visibles = q ? options.filter(function(o){ return o.label.toLowerCase().indexOf(q)!==-1; }) : options;
    var itemsHtml = visibles.map(function(o){
      var checked = seleccion.indexOf(o.value)!==-1;
      return '<label class="multiselect-item"><input type="checkbox" data-multiselect="'+id+'" value="'+esc(o.value)+'" '+(checked?'checked':'')+'>'+esc(o.label)+'</label>';
    }).join('');
    panelHtml = ''+
      '<div class="multiselect-panel">'+
        (options.length ? '<input type="text" id="ms-buscar-'+id+'" class="multiselect-search" placeholder="Buscar..." value="'+esc(STATE.multiSelectBusqueda||'')+'" autocomplete="off">' : '')+
        (options.length ? '<div class="multiselect-panel-actions"><button type="button" class="link" data-action="multiselect-limpiar" data-id="'+id+'">Limpiar</button></div>' : '')+
        '<div class="multiselect-list">'+(itemsHtml || '<div class="empty" style="padding:6px 4px">'+(q?'Sin resultados.':'Sin opciones.')+'</div>')+'</div>'+
      '</div>';
  }
  return '<div class="multiselect'+(abierto?' abierto':'')+'" data-multiselect-wrap="'+id+'">'+
    '<button type="button" class="multiselect-toggle" data-action="toggle-multiselect" data-id="'+id+'">'+esc(resumen)+' <span class="multiselect-caret">▾</span></button>'+
    panelHtml+
  '</div>';
}

// ===================== MENÚ DE USUARIO (avatar arriba a la derecha) =====================
function inicialesUsuario(){
  var email = STATE.usuarioEmail || '';
  var nombre = (email.split('@')[0] || '').replace(/[^a-zA-Zá-úÁ-Ú]+/g, ' ').trim();
  var partes = nombre.split(/\s+/).filter(Boolean);
  var iniciales = partes.length >= 2 ? (partes[0][0] + partes[1][0]) : nombre.slice(0, 2);
  return (iniciales || '?').toUpperCase();
}
// Se renderiza tanto en la barra superior de escritorio como en la de mobile (misma marca
// data-user-menu-wrap, mismo STATE.menuUsuarioAbierto) — solo una de las dos queda visible
// según el ancho de pantalla, pero conviene que las dos compartan el mismo estado.
function renderMenuUsuario(){
  var abierto = STATE.menuUsuarioAbierto;
  var panelHtml = '';
  if(abierto){
    panelHtml = '<div class="user-menu-panel">'+
      (STATE.usuarioEmail ? '<div class="user-menu-email">'+esc(STATE.usuarioEmail)+'</div>' : '')+
      '<button type="button" class="user-menu-item" data-action="toggle-tema">'+(STATE.tema==='oscuro'?'☀️ Modo claro':'🌙 Modo oscuro')+'</button>'+
      '<button type="button" class="user-menu-item" data-action="cerrar-sesion">Cerrar sesión</button>'+
    '</div>';
  }
  return '<div class="user-menu-wrap'+(abierto?' abierto':'')+'" data-user-menu-wrap>'+
    '<button type="button" class="avatar-btn" data-action="toggle-menu-usuario" aria-label="Cuenta" title="'+esc(STATE.usuarioEmail||'')+'">'+esc(inicialesUsuario())+'</button>'+
    panelHtml+
  '</div>';
}

// ===================== COMBOBOX (select con buscador y autocompletado) =====================
// Se usa en el formulario de Movimiento (Centro/Categoría/Subcategoría/Centro Destino). Mantiene
// un <input type="hidden"> con el value real (para no tocar el código que ya lee esos ids) y un
// <input type="text"> visible que al escribir filtra las opciones. Con la lista filtrada abierta,
// Enter o Tab confirman la opción resaltada (por defecto la primera) y Tab sigue al próximo campo.
// Etiqueta vacía a propósito: si no hay selección, el input debe verse vacío (con el placeholder
// gris nativo), no mostrar literalmente el texto "Elegir..." como si fuera lo tipeado.
// Excepción para Subcategoría: si lo tipeado no matchea ninguna opción de la categoría elegida,
// confirmar (Enter/Tab/blur) da de alta esa subcategoría al vuelo — ver obtenerOCrearSubcategoriaId.
function comboOpcionVacia(){ return {value:'', label:''}; }
function filtrarOpcionesCombo(options, query){
  var q = (query||'').trim().toLowerCase();
  if(!q) return options;
  return options.filter(function(o){ return o.label.toLowerCase().indexOf(q)!==-1; });
}
function renderCombo(comboId, hiddenId, options, valorSeleccionado, placeholder){
  var abierto = STATE.comboAbierto === comboId;
  var seleccionado = options.find(function(o){ return o.value===(valorSeleccionado||''); });
  var etiquetaActual = seleccionado ? seleccionado.label : '';
  var query = abierto ? (STATE.comboBusqueda||'') : '';
  var valorVisible = abierto ? query : etiquetaActual;
  var panelHtml = '';
  if(abierto){
    var visibles = filtrarOpcionesCombo(options, query);
    var itemsHtml = visibles.map(function(o, i){
      return '<div class="combo-item'+(i===STATE.comboHighlight?' resaltado':'')+'" data-value="'+esc(o.value)+'">'+(o.label?esc(o.label):'<span style="color:var(--ink-soft)">(vacío)</span>')+'</div>';
    }).join('');
    var mensajeSinResultados = (comboId==='mov-subcategoria' && query.trim())
      ? 'Sin resultados. Presioná Enter para crear "'+esc(query.trim())+'".'
      : 'Sin resultados.';
    panelHtml = '<div class="combo-panel"><div class="combo-list">'+(itemsHtml || '<div class="empty" style="padding:6px 4px">'+mensajeSinResultados+'</div>')+'</div></div>';
  }
  return '<div class="combo'+(abierto?' abierto':'')+'" data-combo-wrap="'+comboId+'">'+
    '<input type="hidden" id="'+hiddenId+'" value="'+esc(valorSeleccionado||'')+'">'+
    '<input type="text" class="combo-input" id="'+comboId+'-input" data-combo-id="'+comboId+'" autocomplete="off" placeholder="'+esc(placeholder||'Elegir...')+'" value="'+esc(valorVisible)+'">'+
    panelHtml+
  '</div>';
}
// Busca (o crea) la subcategoría de la categoría actualmente elegida en el formulario de
// Movimiento a partir de un texto tipeado que no matcheó ninguna opción existente del combo.
// Se usa cuando el usuario tipea un nombre nuevo y confirma (Enter/Tab/blur): en vez de perder
// lo tipeado, se da de alta la subcategoría al vuelo, igual que ya pasa al importar movimientos.
async function obtenerOCrearSubcategoriaId(nombreTexto){
  var categoriaId = (document.getElementById('f-mov-categoria')||{}).value || '';
  if(!categoriaId) return null;
  var existente = STATE.subcategorias.find(function(s){
    return s.categoriaId===categoriaId && s.nombre.toLowerCase()===nombreTexto.toLowerCase();
  });
  if(existente) return existente.id;
  var nueva = {id:uid(), categoriaId:categoriaId, nombre:nombreTexto};
  try{
    await dbInsert('subcategorias', toDbSubcategoria(nueva));
    STATE.subcategorias.push(nueva);
    return nueva.id;
  }catch(e){
    STATE.dbError = 'No se pudo crear la subcategoría: '+(e.message||e);
    return null;
  }
}
// Aplica la opción elegida en un combo del formulario de Movimiento al draft correspondiente.
function aplicarSeleccionCombo(comboId, valor){
  // Siempre se sincroniza todo el draft del formulario (no solo el campo que cambia): Fecha,
  // Proveedor, Detalle, Monto, etc. no tienen listener propio, así que si no los capturamos acá
  // antes de re-renderizar, un re-render disparado por el combo los pisaría con el valor en blanco.
  var draft = getMovFormValues();
  if(comboId==='mov-centro-destino'){ STATE.movDraftCentroDestinoId = valor; STATE.movDraft = draft; return; }
  if(comboId==='mov-centro') draft.centroId = valor;
  else if(comboId==='mov-categoria'){ draft.categoriaId = valor; draft.subcategoriaId = ''; }
  else if(comboId==='mov-subcategoria') draft.subcategoriaId = valor;
  STATE.movDraft = draft;
}
// Lee del DOM ya renderizado cuál es la opción resaltada (o la primera visible) del combo abierto.
function comboValorResaltadoDOM(comboId){
  var wrap = document.querySelector('[data-combo-wrap="'+comboId+'"]');
  if(!wrap) return null;
  var item = wrap.querySelector('.combo-item.resaltado') || wrap.querySelector('.combo-item');
  return item ? item.getAttribute('data-value') : null;
}
function moverResaltadoCombo(comboId, delta){
  var wrap = document.querySelector('[data-combo-wrap="'+comboId+'"]');
  var total = wrap ? wrap.querySelectorAll('.combo-item').length : 0;
  if(!total) return;
  STATE.movDraft = getMovFormValues(); // ver el porqué en aplicarSeleccionCombo
  STATE.comboHighlight = ((STATE.comboHighlight + delta) % total + total) % total;
  render();
}
// Id del próximo campo tabulable dentro del mismo modal/tarjeta, calculado ANTES de re-renderizar
// (se usa para reenfocar "a mano" tras un Tab en un combo, ver el porqué en el keydown de abajo).
function idSiguienteFocuseable(elementoActual){
  var contenedor = elementoActual.closest('.modal-card') || elementoActual.closest('.card') || document;
  var lista = Array.prototype.slice.call(contenedor.querySelectorAll('input, select, textarea, button')).filter(function(x){
    return x.type !== 'hidden' && !x.disabled;
  });
  var idx = lista.indexOf(elementoActual);
  var siguiente = idx > -1 ? lista[idx+1] : null;
  return siguiente && siguiente.id ? siguiente.id : null;
}
// Cierra el combo abierto. Si forzar es true (Enter, click en una opción) confirma siempre la
// opción resaltada; si no (blur / Tab), solo confirma cuando el usuario efectivamente tipeó algo
// para filtrar — así tabular por el campo sin tocarlo no pisa el valor que ya tenía cargado.
async function finalizarCombo(comboId, forzar){
  if(STATE.comboAbierto !== comboId) return;
  if(forzar || STATE.comboBusqueda){
    var valor = comboValorResaltadoDOM(comboId);
    if(valor === null && comboId==='mov-subcategoria' && STATE.comboBusqueda.trim()){
      valor = await obtenerOCrearSubcategoriaId(STATE.comboBusqueda.trim());
    }
    if(valor !== null) aplicarSeleccionCombo(comboId, valor);
  } else {
    STATE.movDraft = getMovFormValues(); // cerrar sin confirmar nada igual dispara un render: ver aplicarSeleccionCombo
  }
  STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
  render();
}

function uid(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    var r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

// ---- Mapeo entre el modelo JS (camelCase) y las columnas de Supabase (snake_case) ----
function toDbCentro(c){ return {id:c.id, codigo:c.codigo, nombre:c.nombre, color:c.color||null, color_texto:c.colorTexto||null}; }
function fromDbCentro(r){ return {id:r.id, codigo:r.codigo, nombre:r.nombre, color:r.color||'', colorTexto:r.color_texto||''}; }
function toDbCategoria(c){ return {id:c.id, nombre:c.nombre, tipo:c.tipo||null, color:c.color||null, color_texto:c.colorTexto||null}; }
function fromDbCategoria(r){ return {id:r.id, nombre:r.nombre, tipo:r.tipo||'', color:r.color||'', colorTexto:r.color_texto||''}; }
function toDbSubcategoria(s){ return {id:s.id, categoria_id:s.categoriaId||null, nombre:s.nombre}; }
function fromDbSubcategoria(r){ return {id:r.id, categoriaId:r.categoria_id||'', nombre:r.nombre}; }
function toDbMovimiento(m){ return {id:m.id, fecha:m.fecha, centro_id:m.centroId||null, categoria_id:m.categoriaId||null, subcategoria_id:m.subcategoriaId||null, proveedor:m.proveedor||null, detalle:m.detalle||null, ingreso:Number(m.ingreso)||0, egreso:Number(m.egreso)||0, tarjeta:!!m.tarjeta, fecha_consumo:m.fechaConsumo||null, tarjeta_marca:m.tarjetaMarca||null}; }
function fromDbMovimiento(r){ return {id:r.id, fecha:r.fecha, centroId:r.centro_id||'', categoriaId:r.categoria_id||'', subcategoriaId:r.subcategoria_id||'', proveedor:r.proveedor||'', detalle:r.detalle||'', ingreso:Number(r.ingreso)||0, egreso:Number(r.egreso)||0, tarjeta:!!r.tarjeta, fechaConsumo:r.fecha_consumo||'', tarjetaMarca:r.tarjeta_marca||''}; }
function toDbVencimiento(v){ return {id:v.id, concepto:v.concepto, fecha:v.fecha, monto:Number(v.monto)||0, centro_id:v.centroId||null, estado:v.estado||'pendiente'}; }
function fromDbVencimiento(r){ return {id:r.id, concepto:r.concepto, fecha:r.fecha, monto:Number(r.monto)||0, centroId:r.centro_id||'', estado:r.estado||'pendiente'}; }
function fromDbGimnasioVisita(r){ return {id:r.id, persona:r.persona, fecha:r.fecha}; }

// ---- CRUD genérico contra Supabase ----
async function dbFetchAll(table){
  var allRows = [];
  var pageSize = 1000;
  var from = 0;
  while(true){
    var res = await sb.from(table).select('*').range(from, from + pageSize - 1);
    if(res.error) throw res.error;
    var rows = res.data || [];
    allRows = allRows.concat(rows);
    if(rows.length < pageSize) break; // ya no hay más filas
    from += pageSize;
  }
  return allRows;
}
async function dbInsert(table, rowOrRows){
  var res = await sb.from(table).insert(rowOrRows).select();
  if(res.error) throw res.error;
  return res.data;
}
async function dbUpdate(table, id, fields){
  var res = await sb.from(table).update(fields).eq('id', id);
  if(res.error) throw res.error;
}
async function dbDelete(table, id){
  var res = await sb.from(table).delete().eq('id', id);
  if(res.error) throw res.error;
}
async function dbUpsert(table, rows){
  if(!rows.length) return [];
  var res = await sb.from(table).upsert(rows).select();
  if(res.error) throw res.error;
  return res.data;
}

async function cargarTodo(){
  var [centros, categorias, subcategorias, movimientos, vencimientos] = await Promise.all([
    dbFetchAll('centros'), dbFetchAll('categorias'), dbFetchAll('subcategorias'), dbFetchAll('movimientos'), dbFetchAll('vencimientos')
  ]);
  STATE.centros = centros.map(fromDbCentro);
  STATE.categorias = categorias.map(fromDbCategoria);
  STATE.subcategorias = subcategorias.map(fromDbSubcategoria);
  STATE.movimientos = movimientos.map(fromDbMovimiento);
  STATE.vencimientos = vencimientos.map(fromDbVencimiento);
  try{
    // Try/catch aparte: si todavía no corriste migracion_gimnasio.sql en Supabase, que no
    // reviente la carga de toda la app — el bonus track simplemente arranca vacío.
    var gimnasioVisitas = await dbFetchAll('gimnasio_visitas');
    STATE.gimnasioVisitas = gimnasioVisitas.map(fromDbGimnasioVisita);
  }catch(e){ STATE.gimnasioVisitas = []; }
}

// ===================== AUTENTICACIÓN =====================
async function mostrarApp(){
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  try{
    await cargarTodo();
  }catch(e){
    STATE.dbError = 'No se pudo cargar la información desde la base de datos: ' + (e.message||e);
  }
  STATE.saldosDirty = true;
  STATE.ready = true;
  render();
}

function mostrarLogin(msg){
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('loginMsg').innerHTML = msg ? '<div class="msg err" style="margin-bottom:10px">'+msg.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];})+'</div>' : '';
}

async function intentarLogin(){
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if(!email || !password){ mostrarLogin('Completá email y contraseña.'); return; }
  mostrarLogin('Iniciando sesión...');
  var res = await sb.auth.signInWithPassword({ email: email, password: password });
  if(res.error){ mostrarLogin('No pudimos iniciar sesión: ' + res.error.message); return; }
  STATE.usuarioEmail = (res.data && res.data.user) ? res.data.user.email : email;
  await mostrarApp();
}

async function cerrarSesion(){
  await sb.auth.signOut();
  mostrarLogin();
}

async function initAuth(){
  if(!sb){ mostrarLogin('No se pudo cargar la librería de Supabase. Revisá tu conexión a internet y refrescá la página.'); return; }
  var { data } = await sb.auth.getSession();
  if(data && data.session){
    STATE.usuarioEmail = data.session.user ? data.session.user.email : null;
    await mostrarApp();
  } else {
    mostrarLogin();
  }
  sb.auth.onAuthStateChange(function(event, session){
    if(event === 'SIGNED_OUT'){ mostrarLogin(); }
  });
}

// ===================== HELPERS =====================
function fmtMonto(n){
  n = Number(n)||0;
  return n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function nombreCentro(id){ var c = STATE.centros.find(function(x){return x.id===id;}); return c ? c.codigo+' · '+c.nombre : '—'; }
function centrosOrdenados(){ return STATE.centros.slice().sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'', 'es', {sensitivity:'base'}); }); }
function categoriasOrdenadas(){ return STATE.categorias.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'}); }); }
function subcategoriasOrdenadas(lista){ return lista.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'}); }); }
function nombreCategoria(id){ var c = STATE.categorias.find(function(x){return x.id===id;}); return c ? c.nombre : '—'; }
function nombreSubcategoria(id){ var s = STATE.subcategorias.find(function(x){return x.id===id;}); return s ? s.nombre : '—'; }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function codigoCentroPorUsuario(){
  var email = (STATE.usuarioEmail||'').trim().toLowerCase();
  if(email === 'fhsantarelli@gmail.com') return 'EF';
  if(email === 'anitacasadei@gmail.com') return 'EA';
  return '';
}
function personaPorUsuario(){
  var email = (STATE.usuarioEmail||'').trim().toLowerCase();
  if(email === 'fhsantarelli@gmail.com') return 'franco';
  if(email === 'anitacasadei@gmail.com') return 'ana';
  return '';
}
function nombrePersona(p){ return p==='ana' ? 'Ana' : (p==='franco' ? 'Franco' : '—'); }
function fechaHoyISO(){
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  return yyyy+'-'+mm+'-'+dd;
}
function esMovimientoPendiente(m){
  return !!(m.fecha) && m.fecha > fechaHoyISO();
}

// ===================== PARSERS PORTADOS DEL CONVERSOR =====================
function matchRule(prov){ return null; } // acá la categorización se hace a mano en la previsualización

var MESES_RE = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
var mesMap = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
function mesNum(m){ return mesMap[(m||'').toLowerCase()]||'01'; }

function parseMonto(str){
  if(!str) return null;
  return parseFloat(str.replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,''));
}
function formatMonto(n){
  if(n===null||n===undefined||isNaN(n)) return '';
  return Math.abs(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function reconstructMontos(rawLines){
  var out = [];
  var i = 0;
  var reMOnlyNum = /^[\d.]+$/;
  while(i < rawLines.length){
    var l = rawLines[i];
    if(l === '$' || l === '-' || l === '+'){
      var sign = '';
      var j = i;
      if(l === '-' || l === '+'){ sign = l; j++; }
      if(j < rawLines.length && rawLines[j] === '$'){ j++; }
      var numPart = '';
      if(j < rawLines.length && reMOnlyNum.test(rawLines[j])){ numPart = rawLines[j].replace(/\./g,''); j++; }
      var decPart = '';
      if(j < rawLines.length && rawLines[j] === ','){ j++;
        if(j < rawLines.length && /^\d+$/.test(rawLines[j])){ decPart = rawLines[j]; j++; }
      }
      out.push(sign + '$' + numPart + (decPart ? ',' + decPart : ''));
      i = j;
      continue;
    }
    out.push(l); i++;
  }
  return out;
}

function joinFechaLines(lines){
  var reFechaSolo = new RegExp('^(\\d+)\\s+de\\s+('+MESES_RE+')\\s*$','i');
  var reMonto = /^[+\-]?\$[\d.,]+$/;
  var out = [];
  var i = 0;
  while(i < lines.length){
    var l = lines[i];
    if(l.toLowerCase() === 'hoy'){
      var j = i+1;
      if(j < lines.length && /^(Disponible|Saldo del día)/i.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){ j++; }
      out.push('__HOY__'); i = j; continue;
    }
    var mF = l.match(reFechaSolo);
    if(mF){
      var j = i+1;
      if(j < lines.length && /^(Disponible|Saldo del día)/i.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){ j++; }
      out.push('__FECHA__'+mF[1]+'__'+mF[2]);
      i = j; continue;
    }
    var mFpeg = l.match(new RegExp('^(\\d+)\\s+de\\s+('+MESES_RE+')','i'));
    if(mFpeg){
      out.push('__FECHA__'+mFpeg[1]+'__'+mFpeg[2]);
      i++; continue;
    }
    if(/^(Disponible|Saldo del día)\s*$/i.test(l)){ i++; continue; }
    out.push(l); i++;
  }
  return out;
}

function getTodayStr(anio){
  var t = new Date();
  return String(t.getDate()).padStart(2,'0')+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+anio;
}

function parseLines(lines, anio){
  var reMonto = /^[+\-]?\$[\d.,]+$/;
  var reHora = /^\d{1,2}:\d{2}$/;
  var reMovimiento = /^Movimiento\s+\.\.\./i;
  var currentDate = null;
  var rows = [];
  var i = 0;
  while(i < lines.length){
    var line = lines[i];
    if(line === '__HOY__'){ currentDate = getTodayStr(anio); i++; continue; }
    if(line.indexOf('__FECHA__') === 0){
      var parts = line.split('__').filter(function(x){return x.length>0;});
      var dia = parts[1] ? parts[1].padStart(2,'0') : '01';
      var mes = mesNum(parts[2]||'');
      currentDate = dia+'-'+mes+'-'+anio;
      i++; continue;
    }
    if(reMonto.test(line) || reMovimiento.test(line)){ i++; continue; }
    if(reHora.test(line)){
      var hora = line; var j = i+1;
      if(j >= lines.length){ i++; continue; }
      var proveedor = lines[j]; j++;
      var half = Math.ceil(proveedor.length/2);
      var firstH = proveedor.slice(0,half).trim();
      var secondH = proveedor.slice(half);
      if(firstH.length > 3 && secondH.toLowerCase().indexOf(firstH.toLowerCase()) === 0){
        proveedor = firstH;
      }
      if(j < lines.length && lines[j].toLowerCase() === proveedor.toLowerCase()){ j++; }
      var tipo = 'Transferencia enviada';
      if(j < lines.length && !reMonto.test(lines[j]) && !reHora.test(lines[j]) && !reMovimiento.test(lines[j]) && lines[j].indexOf('__') !== 0){
        var kandidato = lines[j];
        if(kandidato.toLowerCase().indexOf(proveedor.toLowerCase()) === 0){
          var t2 = kandidato.slice(proveedor.length).trim();
          if(t2.length > 0) tipo = t2;
        } else {
          tipo = kandidato;
        }
        j++;
      }
      if(j < lines.length && reMovimiento.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){
        var monto = parseMonto(lines[j]); j++;
        rows.push({
          fecha: currentDate||'',
          proveedor: proveedor,
          tipo: tipo,
          monto: monto,
          ingreso: monto>0 ? formatMonto(monto) : '',
          egreso: monto<0 ? formatMonto(monto) : ''
        });
        i = j;
      } else { i++; }
      continue;
    }
    i++;
  }
  return rows;
}

function procesarTexto(raw, anio){
  var rawLines = raw.split('\n').map(function(l){ return l.replace(/^[*\u2022]\s*/,'').trim(); }).filter(function(l){ return l.length>0; });
  var step1 = reconstructMontos(rawLines);
  var step2 = joinFechaLines(step1);
  return parseLines(step2, anio);
}

function parseTarjetaSantander(raw, vencimientoStr){
  var lines = raw.split('\n')
    .map(function(l){ return l.replace(/\r$/,'').replace(/^\s*\*\s*/, '').trim(); })
    .filter(function(l){ return l.length>0; });

  var reDateHeader = /^(\d{1,2})\s+de\s+([a-záéíóúñ]+)$/i;
  var reDollarLine = /^\$$/;
  var reAmount = /^-?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
  var reUSD = /^U\$S$/i;
  var reSubtotal = /^subtotal$/i;
  var reOtros = /^otros conceptos$/i;

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vf = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vf ? (vf[3]+'-'+vf[2]+'-'+vf[1].slice(2)) : (vencimientoStr||'').trim();
  var anioCortoVenc = vf ? vf[1].slice(2) : '';

  var rows = [];
  var pendingName = [];
  var fechaConsumoActual = '';
  var i = 0;
  while(i < lines.length){
    var l = lines[i];
    var mFechaHeader = l.match(reDateHeader);
    if(mFechaHeader){
      pendingName = [];
      var mesCodHeader = MESES_ABR_MAP[mFechaHeader[2].toLowerCase().slice(0,3)];
      fechaConsumoActual = mesCodHeader ? (mFechaHeader[1].padStart(2,'0')+'-'+mesCodHeader+'-'+anioCortoVenc) : '';
      i++; continue;
    }
    if(reSubtotal.test(l)){
      i++;
      if(lines[i] && reDollarLine.test(lines[i])) i++;
      if(lines[i] && reAmount.test(lines[i])) i++;
      if(lines[i] && reUSD.test(lines[i])) i++;
      if(lines[i] && reAmount.test(lines[i])) i++;
      pendingName = [];
      continue;
    }
    if(reOtros.test(l)){ pendingName = []; i++; continue; }
    if(reDollarLine.test(l)){ i++; continue; }
    if(reAmount.test(l)){
      var detalle = pendingName.join(' ')
        .replace(/\bCuota\s+\d+\s+de\s+\d+\b/i,'')
        .replace(/\$\s*$/,'')
        .replace(/\s+/g,' ')
        .trim();
      pendingName = [];
      if(detalle){
        var isNeg = /^-/.test(l) || /-$/.test(l);
        var cleaned = l.replace(/-/g,'');
        var val = parseMonto(cleaned);
        if(val !== null && !isNaN(val)){
          if(isNeg) val = -val;
          var monto = -val;
          rows.push({
            fecha: fechaOut,
            fechaConsumo: fechaConsumoActual,
            proveedor: detalle,
            tipo: '',
            monto: monto,
            ingreso: monto>0 ? formatMonto(monto) : '',
            egreso: monto<0 ? formatMonto(monto) : ''
          });
        }
      }
      i++;
      continue;
    }
    pendingName.push(l);
    i++;
  }
  return rows;
}

var TARJETA_CC = { 'nacion':'BNF', 'santander':'BSF', 'provincia':'BPF', 'mercadopago':'MPF' };

function parseTarjeta(raw, vencimientoStr){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var reFecha = /^(\d{2})\.(\d{2})\.(\d{2})\b/;
  var reMoney = /^-?\$?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
  var reComprobante = /^\d+\*?$/;

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vf = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vf ? (vf[3]+'-'+vf[2]+'-'+vf[1].slice(2)) : (vencimientoStr||'').trim();

  var rows = [];
  lines.forEach(function(line){
    var trimmed = line.trim();
    var fm = trimmed.match(reFecha);
    if(!fm) return;
    var fechaConsumo = fm[1]+'-'+fm[2]+'-'+fm[3];

    var tokens = trimmed.split(/\s+/).filter(function(t){ return t.length>0; });
    var rest = tokens.slice(1);
    if(rest.length && reComprobante.test(rest[0])) rest = rest.slice(1);

    var moneyIdx = -1;
    for(var i=0;i<rest.length;i++){ if(reMoney.test(rest[i])){ moneyIdx = i; break; } }
    if(moneyIdx === -1) return;

    var moneyTok = rest[moneyIdx];
    var detalle = rest.slice(0, moneyIdx).filter(function(w){ return w !== '$'; }).join(' ')
      .replace(/\bCuota\s+\d+\/\d+\b/i,'')
      .replace(/\bC\.\d+\/\d+\b/i,'')
      .replace(/\s+/g,' ')
      .trim();
    if(!detalle) return;
    if(/^su pago/i.test(detalle) || /pago en pesos/i.test(detalle)) return;

    var cleaned = moneyTok.replace(/\$/g,'');
    var isNeg = /^-/.test(cleaned) || /-$/.test(cleaned);
    cleaned = cleaned.replace(/-/g,'');
    var val = parseMonto(cleaned);
    if(val === null || isNaN(val)) return;
    if(isNeg) val = -val;
    var monto = -val;

    rows.push({
      fecha: fechaOut,
      fechaConsumo: fechaConsumo,
      proveedor: detalle,
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

var MESES_ABR_MAP = {ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',set:'09',oct:'10',nov:'11',dic:'12'};

// Resumen de Tarjeta de Crédito Mercado Pago: cada fila trae su propia fecha (dd/mmm, sin año) y
// puede venir en Pesos ($) o Dólares (US$). Las filas en dólares se descartan (no hay forma de
// cargarlas junto con las de pesos sin un campo de moneda en "movimientos") y se informan aparte.
function parseTarjetaMercadoPago(raw, anio, vencimientoStr){
  var text = raw.replace(/\s+/g, ' ').trim();
  var yy = (anio||'26').toString().trim();
  if(yy.length===4) yy = yy.slice(2);

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vfVenc = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vfVenc ? (vfVenc[3]+'-'+vfVenc[2]+'-'+vfVenc[1].slice(2)) : (vencimientoStr||'').trim();

  var reFecha = /(\d{1,2})\/([a-záéíóúñ]{3,4})\b/gi;
  var marcas = [];
  var m;
  while((m = reFecha.exec(text)) !== null){
    var mesCod = MESES_ABR_MAP[m[2].toLowerCase()];
    if(!mesCod) continue; // token con "/" que no corresponde a un mes válido (evita falsos positivos)
    marcas.push({ index: m.index, largo: m[0].length, dia: m[1].padStart(2,'0'), mes: mesCod });
  }

  var reFila = /^(.+?)(?:\s+(\d+)\s+de\s+(\d+))?\s+(\d+)\s+(\$|US\$)\s*([\d.,]+)/i;
  var rows = [];
  var omitidas = 0;

  marcas.forEach(function(marca, idx){
    var desde = marca.index + marca.largo;
    var hasta = (idx+1 < marcas.length) ? marcas[idx+1].index : text.length;
    var segmento = text.slice(desde, hasta).trim();
    var fm = segmento.match(reFila);
    if(!fm) return;

    if(fm[5].toUpperCase() !== '$'){ omitidas++; return; } // fila en dólares

    var detalle = fm[1].replace(/\s+/g,' ').trim();
    if(!detalle) return;

    var val = parseMonto(fm[6]);
    if(val === null || isNaN(val)) return;
    var monto = -val; // un consumo de tarjeta es un egreso

    rows.push({
      fecha: fechaOut,
      fechaConsumo: marca.dia+'-'+marca.mes+'-'+yy,
      proveedor: detalle,
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });

  return { rows: rows, omitidas: omitidas };
}

function parseProvincia(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,'').trim(); }).filter(function(l){ return l.length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reSaldoLabel = /^saldo:?$/i;
  var reMontoSolo = /^\$\s*[\d.,]+$/;
  var reMontoConSigno = /^(-?)\$\s*([\d.,]+)$/;
  var rows = [];
  var i = 0;
  while(i < lines.length){
    var fm = lines[i].match(reFecha);
    if(!fm){ i++; continue; }
    var fecha = fm[1]+'-'+fm[2]+'-'+fm[3].slice(2);
    i++;
    var detalleLineas = [];
    while(i < lines.length && !reSaldoLabel.test(lines[i]) && !reFecha.test(lines[i])){
      detalleLineas.push(lines[i]);
      i++;
    }
    if(i < lines.length && reSaldoLabel.test(lines[i])) i++; // saltar "Saldo:"
    if(i < lines.length && reMontoSolo.test(lines[i])) i++; // saltar el saldo resultante ("$ X.XXX,XX")
    if(i >= lines.length) break;
    var mm = lines[i].match(reMontoConSigno);
    if(!mm){ i++; continue; }
    i++;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var detalle = detalleLineas.join(' ').trim();
    rows.push({
      fecha: fecha,
      proveedor: detalle || 'Movimiento',
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  }
  return rows;
}

function parseNacion(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reMontoField = /\$\s*[\d.,]+/;
  var reMontoExtract = /(-?)\s*\$\s*([\d.,]+)/;
  var rows = [];
  lines.forEach(function(line){
    var parts = line.split('\t').map(function(p){ return p.trim(); }).filter(function(p){ return p.length>0; });
    if(parts.length < 3){
      parts = line.split(/\s{2,}/).map(function(p){ return p.trim(); }).filter(function(p){ return p.length>0; });
    }
    if(!parts.length) return;
    var fm = parts[0].match(reFecha);
    if(!fm) return;
    var fecha = fm[1]+'-'+fm[2]+'-'+fm[3].slice(2);
    var resto = parts.slice(1);
    var montoIdx = -1;
    for(var i=0;i<resto.length;i++){
      if(reMontoField.test(resto[i])){ montoIdx = i; break; }
    }
    if(montoIdx === -1) return;
    var mm = resto[montoIdx].match(reMontoExtract);
    if(!mm) return;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var concepto = resto.slice(0, montoIdx).filter(function(p){ return !/^\d+$/.test(p); }).join(' ').trim();
    rows.push({
      fecha: fecha,
      proveedor: concepto || 'Movimiento',
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

var CC_MAP = { mp:'MPF', santander:'BSF', nacion:'BNF', provincia:'BPF' };

function extraerProveedorSantander(tipo, detalle){
  var m = detalle.match(/^(De|A)\s+(.+)$/i);
  if(m){
    var resto = m[2];
    var partes = resto.split('/');
    return partes[0].replace(/,/g,' ').replace(/\s+/g,' ').trim();
  }
  var m2 = detalle.match(/^(.+?)\s*-\s*\d+$/);
  if(m2) return m2[1].trim();
  return tipo;
}

function parseSantander(raw){
  var lines = raw.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reMontoLine = /pesos argentino/i;
  var reMontoExtract = /([+\-]?)\$([\d.,]+)\s*$/;

  var blocks = [];
  var current = null;
  lines.forEach(function(l){
    if(reFecha.test(l)){
      if(current) blocks.push(current);
      current = { fecha: l, lines: [] };
    } else if(current){
      current.lines.push(l);
    }
  });
  if(current) blocks.push(current);

  var rows = [];
  blocks.forEach(function(b){
    var fp = b.fecha.match(reFecha);
    if(!fp) return;
    var fecha = fp[1]+'-'+fp[2]+'-'+fp[3].slice(2);
    if(!b.lines.length) return;
    var tipo = b.lines[0];
    var idx = 1;
    var detalleLines = [];
    while(idx < b.lines.length && !reMontoLine.test(b.lines[idx])){
      detalleLines.push(b.lines[idx]);
      idx++;
    }
    var detalle = detalleLines.join(' / ');
    if(idx >= b.lines.length) return;
    var montoLine = b.lines[idx];
    var mm = montoLine.match(reMontoExtract);
    if(!mm) return;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var proveedor = extraerProveedorSantander(tipo, detalle);
    rows.push({
      fecha: fecha,
      proveedor: proveedor,
      tipo: tipo,
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

// ===================== HELPERS DE IMPORTACIÓN =====================
function fechaCortaAISO(fCorta){
  var m = (fCorta||'').match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if(!m) return '';
  var yy = m[3].length===2 ? '20'+m[3] : m[3];
  return yy+'-'+m[2]+'-'+m[1];
}

function findDefaultCentroId(){
  var code = STATE.importEntidad === 'tarjeta' ? (TARJETA_CC[STATE.importBanco]||'') : (CC_MAP[STATE.importEntidad]||'');
  if(!code) return '';
  var c = STATE.centros.find(function(x){ return (x.codigo||'').toUpperCase() === code.toUpperCase(); });
  return c ? c.id : '';
}

function buscarReglaParaProveedor(proveedor){
  var texto = (proveedor||'').toLowerCase();
  if(!texto) return null;
  var candidatas = (STATE.reglas||[]).filter(function(r){
    return r.proveedor && texto.indexOf(r.proveedor.toLowerCase()) !== -1;
  });
  if(!candidatas.length) return null;
  candidatas.sort(function(a,b){ return b.proveedor.length - a.proveedor.length; }); // preferir el match más específico (texto más largo)
  return candidatas[0];
}
function resolverCategoriaSubcategoriaPorNombre(categoriaNombre, subcategoriaNombre){
  var cat = STATE.categorias.find(function(c){ return (c.nombre||'').toLowerCase() === (categoriaNombre||'').toLowerCase(); });
  if(!cat) return { categoriaId:'', subcategoriaId:'' };
  var subId = '';
  if(subcategoriaNombre){
    var sub = STATE.subcategorias.find(function(s){ return s.categoriaId===cat.id && (s.nombre||'').toLowerCase()===subcategoriaNombre.toLowerCase(); });
    if(sub) subId = sub.id;
  }
  return { categoriaId: cat.id, subcategoriaId: subId };
}
function aplicarReglaAFila(proveedor){
  var regla = buscarReglaParaProveedor(proveedor);
  if(!regla) return { categoriaId:'', subcategoriaId:'' };
  return resolverCategoriaSubcategoriaPorNombre(regla.categoria, regla.subcategoria);
}
function agregarOActualizarRegla(proveedorTexto, categoriaNombre, subcategoriaNombre){
  var texto = (proveedorTexto||'').trim();
  if(!texto || !categoriaNombre) return;
  var existente = STATE.reglas.find(function(r){ return r.proveedor.toLowerCase() === texto.toLowerCase(); });
  if(existente){
    existente.categoria = categoriaNombre;
    existente.subcategoria = subcategoriaNombre||'';
  } else {
    STATE.reglas.push({ id: uid(), proveedor: texto, categoria: categoriaNombre, subcategoria: subcategoriaNombre||'' });
  }
  guardarReglas(STATE.reglas);
}

// ===================== DETECCIÓN DE DUPLICADOS EN IMPORTACIÓN =====================
// Un movimiento se considera "el mismo" si coincide Centro de Costo, día y proveedor,
// y el monto (con signo: ingreso positivo, egreso negativo) es igual.
function montoSignedMovimiento(m){
  var ingreso = Number(m.ingreso)||0, egreso = Number(m.egreso)||0;
  return ingreso>0 ? ingreso : -egreso;
}
function normalizarProveedor(p){ return (p||'').trim().toLowerCase(); }
function montosIguales(a, b){ return Math.round((Number(a)||0)*100) === Math.round((Number(b)||0)*100); }

function existeMovimientoIgual(fecha, centroId, proveedor, monto){
  if(!fecha || !centroId) return false;
  var provNorm = normalizarProveedor(proveedor);
  return STATE.movimientos.some(function(m){
    return m.fecha===fecha && m.centroId===centroId && normalizarProveedor(m.proveedor)===provNorm && montosIguales(montoSignedMovimiento(m), monto);
  });
}

// Recibe una lista normalizada [{id, fecha, centroId, proveedor, monto}] y devuelve un mapa
// id -> true para las filas que son posible duplicado: ya existe un movimiento igual guardado,
// o se repite otra fila del mismo lote pegado (p. ej. el usuario pegó el resumen dos veces).
function calcularDuplicados(filasNormalizadas){
  var dupIds = {};
  filasNormalizadas.forEach(function(f, i){
    if(existeMovimientoIgual(f.fecha, f.centroId, f.proveedor, f.monto)){ dupIds[f.id] = true; return; }
    for(var j=0;j<filasNormalizadas.length;j++){
      if(j===i) continue;
      var o = filasNormalizadas[j];
      if(o.fecha===f.fecha && o.centroId===f.centroId && normalizarProveedor(o.proveedor)===normalizarProveedor(f.proveedor) && montosIguales(o.monto, f.monto)){
        dupIds[f.id] = true; break;
      }
    }
  });
  return dupIds;
}

// Suma n meses a una fecha ISO (YYYY-MM-DD), ajustando al último día del mes
// destino si este tiene menos días (ej: 31-01 + 1 mes -> 28/29-02, no 03-03).
function sumarMeses(fechaISO, n){
  var m = (fechaISO||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return fechaISO;
  var y = parseInt(m[1],10), mes = parseInt(m[2],10), dia = parseInt(m[3],10);
  var total = (mes-1) + n;
  var nuevoY = y + Math.floor(total/12);
  var nuevoMes = ((total % 12) + 12) % 12; // 0-11
  var ultimoDia = new Date(nuevoY, nuevoMes+1, 0).getDate();
  var nuevoDia = Math.min(dia, ultimoDia);
  return nuevoY+'-'+String(nuevoMes+1).padStart(2,'0')+'-'+String(nuevoDia).padStart(2,'0');
}

function parseFechaFlexible(s){
  if(!s) return '';
  s = s.trim();
  var m;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if(m){
    var dd1 = m[1].padStart(2,'0'), mm1 = m[2].padStart(2,'0');
    var yy1 = m[3].length===2 ? '20'+m[3] : m[3];
    return yy1+'-'+mm1+'-'+dd1;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){
    var dd2 = m[1].padStart(2,'0'), mm2 = m[2].padStart(2,'0');
    var yy2 = m[3].length===2 ? '20'+m[3] : m[3];
    return yy2+'-'+mm2+'-'+dd2;
  }
  return '';
}

function parseNumeroFlexible(s){
  if(!s) return 0;
  s = String(s).trim().replace(/[^\d.,\-]/g,'');
  if(!s) return 0;
  var lastComma = s.lastIndexOf(',');
  var lastDot = s.lastIndexOf('.');
  var val;
  if(lastComma > -1 && lastDot > -1){
    val = lastComma > lastDot ? parseFloat(s.replace(/\./g,'').replace(',','.')) : parseFloat(s.replace(/,/g,''));
  } else if(lastComma > -1){
    val = parseFloat(s.replace(/\./g,'').replace(',','.'));
  } else if(lastDot > -1){
    var afterDot = s.length - lastDot - 1;
    val = (afterDot === 2) ? parseFloat(s) : parseFloat(s.replace(/\./g,''));
  } else {
    val = parseFloat(s);
  }
  return isNaN(val) ? 0 : val;
}

function parseExcelHistorico(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var rows = [];
  lines.forEach(function(line){
    var cols = line.split('\t');
    if(cols.length < 10){ cols = line.split(/\s{2,}/); }
    if(cols.length < 10) return;
    var periodo = (cols[0]||'').trim();
    var categoria = (cols[2]||'').trim();
    var subcategoria = (cols[3]||'').trim();
    var cc = (cols[4]||'').trim();
    var fechaRaw = (cols[5]||'').trim();
    var proveedor = (cols[6]||'').trim();
    var detalle = (cols[7]||'').trim();
    var ingresosRaw = (cols[8]||'').trim();
    var egresosRaw = (cols[9]||'').trim();

    if(/^periodo$/i.test(periodo) && /^categor/i.test(categoria)) return; // fila de encabezado

    var fecha = parseFechaFlexible(fechaRaw);
    var ingreso = parseNumeroFlexible(ingresosRaw);
    var egreso = parseNumeroFlexible(egresosRaw);
    if(!fecha && !proveedor && !ingreso && !egreso) return;

    rows.push({ fecha: fecha, cc: cc, categoria: categoria, subcategoria: subcategoria,
      proveedor: proveedor, detalle: detalle, ingreso: ingreso||0, egreso: egreso||0 });
  });
  return rows;
}

function runParser(){
  var entidad = STATE.importEntidad;
  var raw = STATE.importRaw || '';
  if(!raw.trim()) return { rows: [], error: 'Pegá el texto del resumen primero.' };
  if(entidad === 'mp') return { rows: procesarTexto(raw, STATE.importAnio||'26'), error: null };
  if(entidad === 'santander') return { rows: parseSantander(raw), error: null };
  if(entidad === 'nacion') return { rows: parseNacion(raw), error: null };
  if(entidad === 'provincia') return { rows: parseProvincia(raw), error: null };
  if(entidad === 'tarjeta'){
    var venc = STATE.importVencimiento || '';
    if(!venc.trim()) return { rows: [], error: 'Ingresá la fecha de vencimiento del resumen.' };
    var banco = STATE.importBanco || 'nacion';
    if(banco === 'mercadopago'){
      // el resumen de MP trae fecha propia por fila (dd/mmm, sin año): se usa como Fecha de consumo,
      // y el Vencimiento tipeado (con el que también se deduce el año de esas fechas) queda como fecha
      // del movimiento, igual que en Nación/Santander.
      var anioMp = /^\d{4}/.test(venc.trim()) ? venc.trim().slice(2,4) : '26';
      var resMp = parseTarjetaMercadoPago(raw, anioMp, venc);
      return { rows: resMp.rows, error: null, omitidas: resMp.omitidas };
    }
    var rows = (banco === 'santander') ? parseTarjetaSantander(raw, venc) : parseTarjeta(raw, venc);
    return { rows: rows, error: null };
  }
  if(entidad === 'excel') return { rows: [], error: null }; // se maneja aparte en el handler de preview-import
  return { rows: [], error: 'Entidad no reconocida.' };
}

// ===================== RENDER PRINCIPAL =====================
// Reemplazar app.innerHTML mientras un input tiene el foco dispara blur/focus síncronos sobre ese
// nodo; como algunos de esos handlers (combobox) a su vez llaman a render(), sin esta guarda se
// entra en una recursión infinita (reemplazar el DOM dispara blur/focus, que llama a render(), que
// vuelve a reemplazar el DOM...). Si ya hay un render en curso, los mutan STATE igual pero el
// re-render efectivo queda para la próxima llamada real (siempre llega enseguida: el próximo
// tipeo, o el blur final al salir del campo).
var RENDER_EN_CURSO = false;
function render(){
  if(RENDER_EN_CURSO) return;
  RENDER_EN_CURSO = true;
  try{
    renderInterno();
  } finally {
    RENDER_EN_CURSO = false;
  }
}
function renderInterno(){
  var app = document.getElementById('app');
  if(!STATE.ready){ app.innerHTML = '<div class="loading">Cargando datos...</div>'; return; }

  // Guardar qué campo de texto tenía el foco (y en qué posición del cursor), para
  // restaurarlo después de reconstruir el HTML — si no, cada letra tipeada te saca el foco.
  var focoActivo = document.activeElement;
  var focoPendiente = null;
  if(focoActivo && focoActivo.id && (focoActivo.tagName==='INPUT' || focoActivo.tagName==='TEXTAREA')){
    focoPendiente = { id: focoActivo.id, start: focoActivo.selectionStart, end: focoActivo.selectionEnd };
  }

  MODAL_HTML = '';

  var tabs = [
    {id:'movimientos', label:'Movimientos', icono:'🧾'},
    {id:'importar', label:'Importar', icono:'📥'},
    {id:'vencimientos', label:'Vencimientos', icono:'⏰'},
    {id:'saldos', label:'Saldos', icono:'🏦'},
    {id:'resumen', label:'Resumen', icono:'📊'},
    {id:'gimnasio', label:'Gimnasio', icono:'💪'},
    {id:'abm', label:'ABM', icono:'⚙️'}
  ];

  var sidebarHtml = '<div class="sidebar'+(STATE.menuMovilAbierto?' abierto':'')+'">'+
    '<div class="masthead"><h1>Control</h1><div class="tagline">Control económico<br>datos compartidos</div></div>'+
    '<button data-action="abrir-nuevo-mov" title="Nuevo movimiento" style="width:100%;margin-bottom:10px;font-size:14px;padding:12px">+<span class="tab-label"> Movimiento</span></button>'+
    '<button data-action="abrir-efectivo" class="solo-mobile" style="width:100%;margin-bottom:16px;background:transparent;border:1.5px solid var(--accent);color:var(--accent);font-size:14px;padding:12px">💵 Efectivo</button>'+
    '<div class="tabs">';
  tabs.forEach(function(t){
    sidebarHtml += '<div class="tab '+(STATE.activeTab===t.id?'active':'')+'" data-tab="'+t.id+'" title="'+esc(t.label)+'"><span class="tab-icon">'+t.icono+'</span><span class="tab-label">'+esc(t.label)+'</span></div>';
  });
  sidebarHtml += '</div>'+
    '</div>';

  var tabActual = tabs.find(function(t){ return t.id===STATE.activeTab; });
  var tituloSeccion = tabActual ? tabActual.label : 'Control';

  var mobileTopbarHtml = '<div class="mobile-topbar">'+
    '<button class="hamburger-btn" data-action="toggle-menu-movil" aria-label="Abrir menú">☰</button>'+
    '<h1>Control</h1>'+
    renderMenuUsuario()+
  '</div>'+
  '<div class="sidebar-backdrop'+(STATE.menuMovilAbierto?' visible':'')+'" data-action="cerrar-menu-movil"></div>';

  var contentHtml = '<div class="topbar-desktop"><h2 class="topbar-titulo">'+esc(tituloSeccion)+'</h2>'+renderMenuUsuario()+'</div>';
  if(STATE.dbError){
    contentHtml += '<div class="msg err" style="margin-bottom:14px">'+esc(STATE.dbError)+'</div>';
  }

  contentHtml += '<div class="panel active">';
  if(STATE.activeTab==='movimientos') contentHtml += renderMovimientos();
  else {
    // Los movimientos pendientes (fecha futura) se editan/borran desde la pestaña Vencimientos, y el
    // botón "+ Movimiento" del sidebar abre el alta desde cualquier pestaña. El modal (edición o alta)
    // vive dentro de renderMovimientos(), así que hay que construirlo igual aunque no se muestre el
    // listado completo de esa pestaña.
    if((STATE.editing && STATE.editing.type==='mov') || STATE.nuevoMovAbierto) renderMovimientos();
    if(STATE.activeTab==='importar') contentHtml += renderImportar();
    else if(STATE.activeTab==='vencimientos') contentHtml += renderVencimientos();
    else if(STATE.activeTab==='saldos') contentHtml += renderSaldos();
    else if(STATE.activeTab==='resumen') contentHtml += renderResumen();
    else if(STATE.activeTab==='gimnasio') contentHtml += renderGimnasio();
    else if(STATE.activeTab==='abm') contentHtml += renderABM();
  }
  contentHtml += '</div>';

  contentHtml += '<footer class="small">Los datos se guardan en la base de datos compartida: vos y quien tenga usuario ven y editan la misma información.</footer>';

  if(STATE.confirmState){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="confirm"><div class="modal-card">'+
      '<div style="margin-bottom:16px">'+esc(STATE.confirmState.message)+'</div>'+
      '<button class="danger" data-action="confirm-yes">Sí, borrar</button> '+
      '<button class="secondary" data-action="confirm-no">Cancelar</button>'+
    '</div></div>';
  }

  if(STATE.subDeleteState){
    var sds = STATE.subDeleteState;
    var otrasSubs = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId===sds.categoriaId && s.id!==sds.id; }));
    var mensajeSub = sds.afectados > 0
      ? '¿Borrar la subcategoría "'+esc(sds.nombre)+'"? Hay <strong>'+sds.afectados+' movimiento(s)</strong> que la tienen asignada.'
      : '¿Borrar la subcategoría "'+esc(sds.nombre)+'"? No tiene movimientos asignados.';
    var selectorReasignar = (sds.afectados > 0 && otrasSubs.length > 0) ? ''+
      '<div class="field" style="margin-top:12px;margin-bottom:16px">'+
        '<label>¿Qué hacer con esos '+sds.afectados+' movimiento(s)?</label>'+
        '<select id="sub-delete-reasignar">'+
          '<option value="">Dejarlos sin subcategoría</option>'+
          otrasSubs.map(function(s){ return '<option value="'+s.id+'">Reasignar a: '+esc(s.nombre)+'</option>'; }).join('')+
        '</select>'+
      '</div>' : '';
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="subdelete"><div class="modal-card">'+
      '<div style="margin-bottom:8px">'+mensajeSub+'</div>'+
      selectorReasignar+
      '<button class="danger" data-action="sub-delete-confirmar">Sí, borrar</button> '+
      '<button class="secondary" data-action="sub-delete-cancel">Cancelar</button>'+
    '</div></div>';
  }

  if(STATE.efectivoAbierto){
    var codigoDefault = codigoCentroPorUsuario();
    var centroDefault = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase()===codigoDefault; });
    var centroDefaultId = centroDefault ? centroDefault.id : '';
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="efectivo"><div class="modal-card">'+
      '<h2>💵 Cargar efectivo</h2>'+
      (STATE.efectivoMsg ? '<div class="msg err">'+esc(STATE.efectivoMsg)+'</div>' : '')+
      '<div class="row">'+
        '<div class="field"><label>Fecha</label><input type="date" id="ef-fecha" value="'+fechaHoyISO()+'"></div>'+
        '<div class="field"><label>Centro de Costo</label><select id="ef-centro"><option value="">Elegir...</option>'+
          centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(centroDefaultId===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label>Tipo</label><select id="ef-tipo">'+
          '<option value="egreso" selected>Egreso</option>'+
          '<option value="ingreso">Ingreso</option>'+
        '</select></div>'+
      '</div>'+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field" style="flex:1 1 100%"><label>Monto</label><input type="number" step="0.01" id="ef-monto" placeholder="0.00" style="font-size:18px"></div>'+
      '</div>'+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field"><label>Proveedor (opcional)</label><input type="text" id="ef-proveedor" placeholder="Ej: Kiosco"></div>'+
        '<div class="field"><label>Detalle (opcional)</label><input type="text" id="ef-detalle"></div>'+
      '</div>'+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field"><label>Categoría (opcional)</label><select id="ef-categoria"><option value="">Elegir...</option>'+
          categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(STATE.efectivoCategoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label>Subcategoría (opcional)</label><select id="ef-subcategoria"><option value="">Elegir...</option>'+
          subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){return s.categoriaId===STATE.efectivoCategoriaId;})).map(function(s){ return '<option value="'+s.id+'">'+esc(s.nombre)+'</option>'; }).join('')+
        '</select></div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:10px">Podés completar Categoría y Subcategoría ahora, o dejarlas para después desde Movimientos.</div>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="guardar-efectivo">Guardar</button>'+
        '<button class="secondary" data-action="cerrar-efectivo">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var html = mobileTopbarHtml + '<div class="layout">'+sidebarHtml+'<div class="main-content">'+contentHtml+'</div></div>' + MODAL_HTML;

  app.innerHTML = html;
  bindEvents();

  if(focoPendiente){
    var elFoco = document.getElementById(focoPendiente.id);
    if(elFoco && (elFoco.tagName==='INPUT' || elFoco.tagName==='TEXTAREA')){
      elFoco.focus();
      if(typeof elFoco.setSelectionRange === 'function' && focoPendiente.start !== null && focoPendiente.start !== undefined){
        try{ elFoco.setSelectionRange(focoPendiente.start, focoPendiente.end); }catch(e){}
      }
    }
  }
}

var MODAL_HTML = '';

// ===================== CENTROS DE COSTO =====================
function campoCentro(codigo, nombre, color){
  return '<div class="field"><label>Código (CC)</label><input type="text" id="f-centro-codigo" placeholder="Ej: MPF" value="'+esc(codigo)+'" style="width:100px;text-transform:uppercase"></div>'+
    '<div class="field"><label>Nombre</label><input type="text" id="f-centro-nombre" placeholder="Ej: Mercado Pago" value="'+esc(nombre)+'" style="width:220px"></div>'+
    '<div class="field"><label>Color</label><input type="color" id="f-centro-color" value="'+esc(color)+'"></div>';
}
function renderCentros(){
  var rows = STATE.centros.map(function(c){
    return '<tr><td data-label="Código">'+renderChip(c.codigo, colorCentro(c.id), colorTextoCentro(c.id))+'</td><td data-label="Nombre">'+esc(c.nombre)+'</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-centro" data-id="'+c.id+'">editar</button>'+
      '<button class="link" data-action="del-centro" data-id="'+c.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='centro' ? STATE.centros.find(function(x){return x.id===STATE.editing.id;}) : null;

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar centro de costo</h2>'+
      '<div class="row">'+ campoCentro(editing.codigo, editing.nombre, colorCentro(editing.id)) +'</div>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="save-centro" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevoCentro = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nuevo centro de costo</h2>'+
    '<div class="row">'+ campoCentro('', '', PALETA_DONUT[STATE.centros.length % PALETA_DONUT.length]) +
      '<button data-action="save-centro" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  return formNuevoCentro +
  '<div class="card">'+
    '<h3>Centros de costo cargados</h3>'+
    (STATE.centros.length ? '<table class="tabla-movil"><thead><tr><th>Código</th><th>Nombre</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún centro de costo.</div>')+
  '</div>';
}

// ===================== CATEGORÍAS =====================
function tipoLabel(tipo){
  return tipo==='tec' ? 'TEC' : '—';
}
function esPalabraDeTipo(s){
  // reconoce las palabras que suelen venir en la columna "Cuenta" del Excel (Ingresos/Egresos/Ahorros/TeC),
  // solo para poder detectar el orden de las columnas al pegar — el valor real que se guarda sale de normalizarTipo()
  s = (s||'').trim().toLowerCase();
  return /^ingres/.test(s) || /^egres/.test(s) || /^ahorr/.test(s) || /^tec$/.test(s) || /transfer.*cuenta/.test(s);
}
function normalizarTipo(s){
  s = (s||'').trim().toLowerCase();
  if(/^tec$/.test(s) || /transfer.*cuenta/.test(s)) return 'tec';
  return '';
}

function renderABM(){
  var subtabs = [
    {id:'categorias', label:'Categorías'},
    {id:'subcategorias', label:'Subcategorías'},
    {id:'centros', label:'Centros de Costo'},
    {id:'backup', label:'Backup'}
  ];
  var html = '<div class="subtabs">';
  subtabs.forEach(function(t){
    html += '<div class="subtab '+(STATE.abmSubTab===t.id?'active':'')+'" data-subtab="'+t.id+'">'+t.label+'</div>';
  });
  html += '</div>';

  if(STATE.abmSubTab === 'subcategorias') html += renderSubcategorias();
  else if(STATE.abmSubTab === 'centros') html += renderCentros();
  else if(STATE.abmSubTab === 'backup') html += renderBackup();
  else html += renderCategorias();

  return html;
}

function renderBackup(){
  var msgHtml = STATE.backupMsg ? '<div class="msg '+(STATE.backupMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.backupMsg.text)+'</div>' : '';
  return ''+
  '<div class="card">'+
    '<h2>Descargar backup</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:12px">Genera un archivo con todo lo que hay cargado hoy (Centros, Categorías, Subcategorías, Movimientos y Vencimientos). Guardalo en Google Drive, tu mail, o donde prefieras — te sirve para restaurar todo si algún día se pierde algo en la base de datos. El plan gratis de Supabase no hace backups automáticos, así que conviene descargar uno de tanto en tanto (por ejemplo, una vez al mes).</div>'+
    '<button data-action="descargar-backup">⬇ Descargar backup completo (.json)</button>'+
  '</div>'+
  '<div class="card">'+
    '<h2>Restaurar desde un backup</h2>'+
    msgHtml+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:12px">Elegí un archivo .json descargado antes con "Descargar backup". Esto <strong>no borra</strong> lo que ya tenés cargado: agrega lo que falte y actualiza lo que coincida por ID. Te va a pedir confirmación antes de aplicar nada.</div>'+
    '<div class="row">'+
      '<input type="file" id="backup-file" accept="application/json,.json">'+
      '<button data-action="restaurar-backup-preview">Restaurar</button>'+
    '</div>'+
  '</div>';
}

function campoCategoria(nombre, tipo, color){
  return '<div class="field"><label>Nombre</label><input type="text" id="f-categoria-nombre" placeholder="Ej: Alimentos" value="'+esc(nombre)+'" style="width:220px"></div>'+
    '<div class="field"><label>Color</label><input type="color" id="f-categoria-color" value="'+esc(color)+'"></div>'+
    '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
      '<input type="checkbox" id="f-categoria-es-tec" '+(tipo==='tec'?'checked':'')+' style="width:auto"> Es TEC (transferencia entre cuentas)'+
    '</label></div>';
}
function renderCategorias(){
  var rows = STATE.categorias.map(function(c){
    var subCount = STATE.subcategorias.filter(function(s){return s.categoriaId===c.id;}).length;
    return '<tr><td data-label="Nombre">'+renderChip(c.nombre, colorCategoria(c.id), colorTextoCategoria(c.id))+'</td><td class="mono" data-label="Tipo">'+tipoLabel(c.tipo)+'</td><td class="mono" data-label="Subcategorías">'+subCount+' subcategoría(s)</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-categoria" data-id="'+c.id+'">editar</button>'+
      '<button class="link" data-action="del-categoria" data-id="'+c.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='categoria' ? STATE.categorias.find(function(x){return x.id===STATE.editing.id;}) : null;

  var bulkMsgHtml = STATE.bulkCatMsg ? '<div class="msg '+(STATE.bulkCatMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkCatMsg.text)+'</div>' : '';
  var bulkColorMsgHtml = STATE.bulkColorCatMsg ? '<div class="msg '+(STATE.bulkColorCatMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkColorCatMsg.text)+'</div>' : '';

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar categoría</h2>'+
      '<div class="row">'+ campoCategoria(editing.nombre, editing.tipo||'', colorCategoria(editing.id)) +'</div>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="save-categoria" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevaCategoria = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nueva categoría</h2>'+
    '<div class="row">'+ campoCategoria('', '', PALETA_DONUT[STATE.categorias.length % PALETA_DONUT.length]) +
      '<button data-action="save-categoria" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  return formNuevaCategoria +
  '<div class="card">'+
    '<h3>Carga masiva</h3>'+
    bulkMsgHtml+
    '<div class="field"><label>Pegá "Nombre" + tab + "Tipo" (Ingreso/Egreso/Ahorro/TEC) por línea — también podés pegar solo el nombre, una por línea, sin tipo. Si la categoría ya existe, se actualiza el tipo; si no existe, se crea.</label>'+
    '<textarea id="bulk-categorias" rows="8" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Aguinaldo\tIngreso\nAlq. Campo\tEgreso\n..."></textarea></div>'+
    '<div class="row" style="margin-top:10px"><button data-action="bulk-add-categorias">Cargar / actualizar todas</button></div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Actualizar colores en masa</h3>'+
    bulkColorMsgHtml+
    '<div class="field"><label>Pegá "Nombre" + tab + "Color" (hex, ej #FDE68A) por línea. También podés pegar directamente la fila "Categoría / Color sugerido / Hex" tal cual, usa la última columna. Solo actualiza categorías que ya existen (por nombre, sin importar mayúsculas); no crea categorías nuevas.</label>'+
    '<textarea id="bulk-colores-categorias" rows="8" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Comida\tDurazno\t#FED7AA"></textarea></div>'+
    '<div class="row" style="margin-top:10px"><button data-action="bulk-actualizar-colores-categorias">Actualizar colores</button></div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Categorías cargadas</h3>'+
    (STATE.categorias.length ? '<table class="tabla-movil"><thead><tr><th>Nombre</th><th>Tipo</th><th>Subcategorías</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ninguna categoría.</div>')+
  '</div>';
}

// ===================== SUBCATEGORÍAS =====================
function campoSubcategoria(catOptions, nombre){
  return '<div class="field"><label>Categoría</label><select id="f-sub-categoria">'+catOptions+'</select></div>'+
    '<div class="field"><label>Nombre</label><input type="text" id="f-sub-nombre" placeholder="Ej: Supermercado" value="'+esc(nombre)+'" style="width:220px"></div>';
}
function renderSubcategorias(){
  var catOptions = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');
  var subsOrdenadasPorCategoria = STATE.subcategorias.slice().sort(function(a,b){
    var cmpCat = nombreCategoria(a.categoriaId).localeCompare(nombreCategoria(b.categoriaId), 'es', {sensitivity:'base'});
    if(cmpCat !== 0) return cmpCat;
    return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'});
  });
  var rows = subsOrdenadasPorCategoria.map(function(s){
    return '<tr><td data-label="Categoría">'+esc(nombreCategoria(s.categoriaId))+'</td><td data-label="Subcategoría">'+esc(s.nombre)+'</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-subcategoria" data-id="'+s.id+'">editar</button>'+
      '<button class="link" data-action="del-subcategoria" data-id="'+s.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='subcategoria' ? STATE.subcategorias.find(function(x){return x.id===STATE.editing.id;}) : null;

  if(STATE.categorias.length === 0){
    return '<div class="card"><div class="empty">Primero cargá al menos una categoría en ABM → Categorías.</div></div>';
  }

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar subcategoría</h2>'+
      '<div class="row">'+ campoSubcategoria(catOptions, editing.nombre) +'</div>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="save-subcategoria" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevaSub = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nueva subcategoría</h2>'+
    '<div class="row">'+ campoSubcategoria(catOptions, '') +
      '<button data-action="save-subcategoria" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  return formNuevaSub +
  '<div class="card">'+
    '<h3>Subcategorías cargadas</h3>'+
    (STATE.subcategorias.length ? '<table class="tabla-movil"><thead><tr><th>Categoría</th><th>Subcategoría</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ninguna subcategoría.</div>')+
  '</div>';

  // Nota: si hay editing, seteamos el select después en bindEvents (post-render) porque innerHTML no respeta "selected" con reflow directo en todos los navegadores.
}

// ===================== MOVIMIENTOS =====================
function getMeses(){
  var set = {};
  STATE.movimientos.forEach(function(m){
    var mes = (m.fecha||'').slice(0,7); // yyyy-mm
    if(mes) set[mes] = true;
  });
  return Object.keys(set).sort().reverse();
}

function camposFaltantes(m){
  var faltan = [];
  if(!m.fecha) faltan.push('Fecha');
  if(!m.centroId) faltan.push('Centro de Costo');
  if(!m.categoriaId) faltan.push('Categoría');
  if(!m.proveedor) faltan.push('Proveedor');
  if(Number(m.ingreso)===0 && Number(m.egreso)===0) faltan.push('Ingreso/Egreso');
  return faltan;
}

// Celdas editables (selects/inputs) para categorizar un movimiento en línea, sin abrir el modal:
// se usan tanto en "Solo incompletos" como dentro de los grupos de tarjeta desplegables.
function celdasEditablesMov(m){
  var subOpcionesFila = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId===m.categoriaId; }))
    .map(function(s){ return '<option value="'+s.id+'" '+(m.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
  return {
    centro: '<td data-label="Centro"><select data-mov-id="'+m.id+'" data-field="centroId"><option value="">—</option>'+
      centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(m.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+'</option>'; }).join('')+
      '</select></td>',
    categoria: '<td data-label="Categoría"><select data-mov-id="'+m.id+'" data-field="categoriaId"><option value="">—</option>'+
      categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(m.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
      '</select></td>',
    subcategoria: '<td data-label="Subcategoría"><select data-mov-id="'+m.id+'" data-field="subcategoriaId"><option value="">—</option>'+subOpcionesFila+'</select></td>',
    proveedor: '<td data-label="Proveedor">'+(m.tarjeta?'<span title="Pagado con tarjeta de crédito">💳</span> ':'')+'<input type="text" data-mov-id="'+m.id+'" data-field="proveedor" value="'+esc(m.proveedor||'')+'" style="width:100%;box-sizing:border-box"></td>',
    detalle: '<td data-label="Detalle"><input type="text" data-mov-id="'+m.id+'" data-field="detalle" value="'+esc(m.detalle||'')+'" style="width:100%;box-sizing:border-box"></td>'
  };
}

// Celdas de solo lectura (chips + texto, con filtro al click) para mostrar un movimiento sin editar
// en línea: se usan en la tabla normal y dentro de las líneas de un resumen de tarjeta desplegado.
// Para editarlas hay que usar el ícono de editar (abre el modal completo), igual que cualquier otra fila.
function celdasSoloLecturaMov(m){
  var subValorFiltro = m.subcategoriaId || '__vacio__';
  return {
    centro: '<td'+(m.centroId?' class="celda-filtrable" data-filter-field="centro" data-filter-value="'+esc(m.centroId)+'" title="Filtrar por este Centro de Costo"':'')+' data-label="Centro">'+(m.centroId?renderChip(nombreCentro(m.centroId).split(' · ')[0], colorCentro(m.centroId), colorTextoCentro(m.centroId)):'—')+'</td>',
    categoria: '<td'+(m.categoriaId?' class="celda-filtrable" data-filter-field="categoria" data-filter-value="'+esc(m.categoriaId)+'" title="Filtrar por esta Categoría"':'')+' data-label="Categoría">'+(m.categoriaId?renderChip(nombreCategoria(m.categoriaId), colorCategoria(m.categoriaId), colorTextoCategoria(m.categoriaId)):'—')+'</td>',
    subcategoria: '<td class="celda-filtrable" data-filter-field="subcategoria" data-filter-value="'+esc(subValorFiltro)+'" title="Filtrar por esta Subcategoría" data-label="Subcategoría">'+esc(nombreSubcategoria(m.subcategoriaId))+'</td>',
    proveedor: '<td'+(m.proveedor?' class="celda-filtrable" data-filter-field="texto" data-filter-value="'+esc(m.proveedor)+'" title="Filtrar por este Proveedor"':'')+' data-label="Proveedor">'+(m.tarjeta?'<span title="Pagado con tarjeta de crédito">💳</span> ':'')+esc(m.proveedor||'')+'</td>',
    detalle: '<td data-label="Detalle">'+esc(m.detalle||'')+'</td>'
  };
}

function renderBulkEditMovModal(){
  var n = (STATE.movSeleccionados||[]).length;
  var subOpts = subcategoriasOrdenadas(STATE.subcategorias).map(function(s){
    return {value:s.id, label:nombreCategoria(s.categoriaId)+' → '+s.nombre};
  });
  var msgHtml = STATE.bulkEditMovMsg ? '<div class="msg '+(STATE.bulkEditMovMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkEditMovMsg.text)+'</div>' : '';
  return '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
    '<h2>Editar '+n+' movimiento(s) seleccionado(s)</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">Dejá "— Sin cambios —" (o vacío) en los campos que no querés tocar: solo se aplican a los '+n+' movimientos los campos que completes acá.</div>'+
    msgHtml+
    '<div class="row">'+
      '<div class="field"><label>Fecha</label><input type="date" id="bem-fecha"></div>'+
      '<div class="field"><label>Centro de Costo</label><select id="bem-centro"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        centrosOrdenados().map(function(c){ return '<option value="'+c.id+'">'+esc(c.codigo+' · '+c.nombre)+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field"><label>Categoría</label><select id="bem-categoria"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field"><label>Subcategoría</label><select id="bem-subcategoria"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        subOpts.map(function(o){ return '<option value="'+o.value+'">'+esc(o.label)+'</option>'; }).join('')+
      '</select></div>'+
    '</div>'+
    '<div class="row" style="margin-top:10px">'+
      '<div class="field"><label>Proveedor</label><input type="text" id="bem-proveedor" placeholder="— Sin cambios —" style="width:160px"></div>'+
      '<div class="field" style="justify-content:flex-end"><label style="font-size:12px;font-weight:normal;display:flex;align-items:center;gap:4px;padding-bottom:8px;white-space:nowrap"><input type="checkbox" id="bem-proveedor-vaciar" style="width:auto"> Vaciar</label></div>'+
      '<div class="field"><label>Detalle</label><input type="text" id="bem-detalle" placeholder="— Sin cambios —" style="width:160px"></div>'+
      '<div class="field" style="justify-content:flex-end"><label style="font-size:12px;font-weight:normal;display:flex;align-items:center;gap:4px;padding-bottom:8px;white-space:nowrap"><input type="checkbox" id="bem-detalle-vaciar" style="width:auto"> Vaciar</label></div>'+
    '</div>'+
    '<div class="row" style="margin-top:10px">'+
      '<div class="field"><label>Tipo</label><select id="bem-tipo"><option value="">— Sin cambios —</option><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></div>'+
      '<div class="field"><label>Monto</label><input type="number" step="0.01" id="bem-monto" placeholder="— Sin cambios —" style="width:120px"></div>'+
      '<div class="field"><label>Tarjeta</label><select id="bem-tarjeta"><option value="">— Sin cambios —</option><option value="si">💳 Marcar</option><option value="no">Desmarcar</option></select></div>'+
    '</div>'+
    '<button data-action="guardar-bulk-edit-mov">Aplicar a '+n+' movimiento(s)</button>'+
    '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
  '</div></div>';
}

function renderMovimientos(){
  var f = STATE.filtros || {centro:[], categoria:[], mes:[], texto:'', subcategoria:[], soloIncompletos:false};

  var centroOptions = centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo}; });
  var categoriaOptions = categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; });
  var meses = getMeses();
  var mesOptions = meses.map(function(m){ return {value:m, label:m}; });
  var subsParaFiltro = subcategoriasOrdenadas(f.categoria.length ? STATE.subcategorias.filter(function(s){ return f.categoria.indexOf(s.categoriaId)!==-1; }) : STATE.subcategorias);
  var subcategoriaOptions = [{value:'__vacio__', label:'(Sin subcategoría)'}].concat(subsParaFiltro.map(function(s){
    var etiqueta = f.categoria.length ? s.nombre : nombreCategoria(s.categoriaId)+' → '+s.nombre;
    return {value:s.id, label:etiqueta};
  }));

  var cantidadIncompletos = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).length;

  // Control de integridad de TEC: debería dar 0 (cada transferencia es un ingreso en un centro y un egreso en otro, por el mismo monto)
  var movsTec = STATE.movimientos.filter(function(m){ return esTipoCategoria(m.categoriaId,'tec'); });
  var ingresoTec = movsTec.reduce(function(s,m){ return s+(Number(m.ingreso)||0); },0);
  var egresoTec = movsTec.reduce(function(s,m){ return s+(Number(m.egreso)||0); },0);
  var difTec = ingresoTec - egresoTec;
  var categoriasSospechosas = STATE.categorias.filter(function(c){
    return c.tipo !== 'tec' && /tec|transfer/i.test(c.nombre||'');
  });

  var lista = STATE.movimientos.filter(function(m){
    if(esMovimientoPendiente(m)) return false; // los movimientos con fecha futura se muestran en Vencimientos, no acá
    if(f.centro.length && f.centro.indexOf(m.centroId)===-1) return false;
    if(f.categoria.length && f.categoria.indexOf(m.categoriaId)===-1) return false;
    if(f.mes.length && f.mes.indexOf((m.fecha||'').slice(0,7))===-1) return false;
    if(f.subcategoria.length){
      var valorSub = m.subcategoriaId || '__vacio__';
      if(f.subcategoria.indexOf(valorSub)===-1) return false;
    }
    if(f.soloIncompletos){
      var idsCongelados = STATE.incompletosSnapshotIds;
      if(idsCongelados){ if(idsCongelados.indexOf(m.id)===-1) return false; }
      else if(camposFaltantes(m).length===0){ return false; }
    }
    if(f.soloTarjeta && !m.tarjeta) return false;
    if(f.texto){
      var t = f.texto.toLowerCase();
      if((m.proveedor||'').toLowerCase().indexOf(t)===-1 && (m.detalle||'').toLowerCase().indexOf(t)===-1) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });

  var totalIngreso = lista.reduce(function(s,m){ return esTipoCategoria(m.categoriaId,'tec') ? s : s + (Number(m.ingreso)||0); },0);
  var totalEgreso = lista.reduce(function(s,m){ return esTipoCategoria(m.categoriaId,'tec') ? s : s + (Number(m.egreso)||0); },0);

  // Los movimientos con tarjeta se agrupan por Fecha + Centro + Marca (un resumen = un pago de una
  // tarjeta puntual) en una sola línea desplegable, ubicada en la tabla en el mismo lugar cronológico
  // que le tocaría a cualquier otro movimiento (no aparte). Con "Solo incompletos" activo no se agrupa,
  // para no interferir con ese filtro.
  var agruparTarjeta = !f.soloIncompletos;
  var gruposTarjetaMap = {};
  var vista = [];
  lista.forEach(function(m){
    if(!agruparTarjeta || !m.tarjeta){ vista.push({tipo:'mov', mov:m}); return; }
    var clave = 'mov-tarjeta|'+m.fecha+'|'+(m.centroId||'')+'|'+(m.tarjetaMarca||'');
    var g = gruposTarjetaMap[clave];
    if(!g){
      g = {tipo:'grupo', clave:clave, fecha:m.fecha, centroId:m.centroId||'', marca:m.tarjetaMarca||'', movs:[]};
      gruposTarjetaMap[clave] = g;
      vista.push(g);
    }
    g.movs.push(m);
  });

  var totalPaginasMov = Math.max(1, Math.ceil(vista.length / MOV_PAGE_SIZE));
  if(STATE.movPaginaActual > totalPaginasMov) STATE.movPaginaActual = totalPaginasMov;
  if(STATE.movPaginaActual < 1) STATE.movPaginaActual = 1;
  var inicioPaginaMov = (STATE.movPaginaActual-1) * MOV_PAGE_SIZE;
  var vistaPagina = vista.slice(inicioPaginaMov, inicioPaginaMov + MOV_PAGE_SIZE);

  var seleccionados = STATE.movSeleccionados || [];
  var idsCheckboxVisibles = [];

  function filaMovNormal(m){
    var faltan = camposFaltantes(m);
    var incompleto = faltan.length>0;

    var celdaCentro, celdaCategoria, celdaSubcategoria, celdaProveedor, celdaDetalle;
    if(f.soloIncompletos){
      var celdasEd = celdasEditablesMov(m);
      celdaCentro = celdasEd.centro; celdaCategoria = celdasEd.categoria; celdaSubcategoria = celdasEd.subcategoria;
      celdaProveedor = celdasEd.proveedor; celdaDetalle = celdasEd.detalle;
    } else {
      var celdasRO = celdasSoloLecturaMov(m);
      celdaCentro = celdasRO.centro; celdaCategoria = celdasRO.categoria; celdaSubcategoria = celdasRO.subcategoria;
      celdaProveedor = celdasRO.proveedor; celdaDetalle = celdasRO.detalle;
    }

    var claseFila = incompleto ? 'fila-incompleta' : '';
    var tituloFila = incompleto ? ' title="Falta: '+esc(faltan.join(', '))+'"' : '';
    var fechaFiltrable = !f.soloIncompletos && (m.fecha||'').slice(0,7);
    idsCheckboxVisibles.push(m.id);
    return '<tr'+(claseFila?' class="'+claseFila+'"':'')+tituloFila+'>'+
      '<td data-label=""><input type="checkbox" class="chk-select-mov" data-mov-id="'+m.id+'" '+(seleccionados.indexOf(m.id)!==-1?'checked':'')+'></td>'+
      '<td class="mono'+(fechaFiltrable?' celda-filtrable':'')+'" data-label="Fecha"'+(fechaFiltrable?' data-filter-field="mes" data-filter-value="'+esc(fechaFiltrable)+'" title="Filtrar por este Mes"':'')+'>'+(incompleto?'⚠️ ':'')+esc(fechaISOaDDMMAAAA(m.fecha)||m.fecha||'')+'</td>'+
      celdaCentro + celdaCategoria + celdaSubcategoria + celdaProveedor + celdaDetalle +
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell"><button class="icon-btn" data-action="edit-mov" data-id="'+m.id+'" title="Editar" aria-label="Editar">✏️</button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-mov" data-id="'+m.id+'" title="Borrar" aria-label="Borrar">🗑️</button></td>'+
    '</tr>';
  }

  function filaDetalleTarjeta(m){
    var faltan = camposFaltantes(m);
    var incompleto = faltan.length>0;
    var celdas = celdasSoloLecturaMov(m);
    var tituloFila = incompleto ? ' title="Falta: '+esc(faltan.join(', '))+'"' : '';
    idsCheckboxVisibles.push(m.id);
    return '<tr class="fila-detalle-tarjeta'+(incompleto?' fila-incompleta':'')+'"'+tituloFila+'>'+
      '<td data-label=""><input type="checkbox" class="chk-select-mov" data-mov-id="'+m.id+'" '+(seleccionados.indexOf(m.id)!==-1?'checked':'')+'></td>'+
      '<td class="mono" data-label="Fecha de consumo">'+(incompleto?'⚠️ ':'')+esc(m.fechaConsumo?fechaISOaDDMMAAAA(m.fechaConsumo):'—')+'</td>'+
      '<td class="mono" data-label="Centro" style="color:var(--ink-soft)">↳</td>'+
      celdas.categoria + celdas.subcategoria + celdas.proveedor + celdas.detalle +
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell"><button class="icon-btn" data-action="edit-mov" data-id="'+m.id+'" title="Editar" aria-label="Editar">✏️</button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-mov" data-id="'+m.id+'" title="Borrar" aria-label="Borrar">🗑️</button></td>'+
    '</tr>';
  }

  function filaGrupoTarjeta(g){
    var abierto = !!STATE.gruposAbiertos[g.clave];
    var totalIngresoG = g.movs.reduce(function(s,m){ return s+(Number(m.ingreso)||0); },0);
    var totalEgresoG = g.movs.reduce(function(s,m){ return s+(Number(m.egreso)||0); },0);
    var faltantesGrupo = g.movs.filter(function(m){ return camposFaltantes(m).length>0; }).length;
    var caret = abierto ? '▾' : '▸';
    var leyenda = 'Resumen '+(g.marca ? esc(g.marca) : 'tarjeta')+' · '+g.movs.length+' movimiento(s)'+(faltantesGrupo?' · ⚠️ '+faltantesGrupo+' por categorizar':'');
    var filaResumen = '<tr class="fila-grupo-tarjeta">'+
      '<td data-label=""></td>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(g.fecha)||g.fecha)+'</td>'+
      '<td data-label="Centro">'+(g.centroId?renderChip(nombreCentro(g.centroId).split(' · ')[0], colorCentro(g.centroId), colorTextoCentro(g.centroId)):'—')+'</td>'+
      '<td colspan="4" data-label="Detalle"><button class="link" data-action="toggle-grupo-tarjeta-mov" data-id="'+esc(g.clave)+'">'+caret+' 💳 '+leyenda+'</button></td>'+
      '<td class="num ingreso" data-label="Ingreso">'+(totalIngresoG?fmtMonto(totalIngresoG):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(totalEgresoG?fmtMonto(totalEgresoG):'')+'</td>'+
      '<td class="actions-cell"></td>'+
    '</tr>';
    if(!abierto) return filaResumen;
    return filaResumen + g.movs.map(filaDetalleTarjeta).join('');
  }

  var rows = vistaPagina.map(function(item){ return item.tipo==='grupo' ? filaGrupoTarjeta(item) : filaMovNormal(item.mov); }).join('');
  var todosVisiblesSeleccionados = idsCheckboxVisibles.length>0 && idsCheckboxVisibles.every(function(mid){ return seleccionados.indexOf(mid)!==-1; });

  var editing = STATE.editing && STATE.editing.type==='mov' ? STATE.movimientos.find(function(x){return x.id===STATE.editing.id;}) : null;
  var editingNormalizado = editing ? {
    fecha: editing.fecha, centroId: editing.centroId, categoriaId: editing.categoriaId, subcategoriaId: editing.subcategoriaId,
    proveedor: editing.proveedor, detalle: editing.detalle,
    tipo: Number(editing.ingreso) > 0 ? 'ingreso' : 'egreso',
    monto: Number(editing.ingreso) > 0 ? editing.ingreso : editing.egreso,
    tarjeta: !!editing.tarjeta, fechaConsumo: editing.fechaConsumo||'', tarjetaMarca: editing.tarjetaMarca||'', cuotas:1
  } : null;
  var e = STATE.movDraft || editingNormalizado || {fecha:'', centroId:'', categoriaId:'', subcategoriaId:'', proveedor:'', detalle:'', tipo:'egreso', monto:'', tarjeta:false, fechaConsumo:'', tarjetaMarca:'', cuotas:1};
  var subOptionsArr = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId === e.categoriaId; }))
    .map(function(s){ return {value:s.id, label:s.nombre}; });

  function camposMov(e, subOptionsArr){
    var catSel = STATE.categorias.find(function(c){return c.id===e.categoriaId;});
    var esTec = catSel && catSel.tipo === 'tec';
    var destinoOpts = [comboOpcionVacia()].concat(STATE.centros.filter(function(c){return c.id!==e.centroId;}).map(function(c){ return {value:c.id, label:c.codigo+' · '+c.nombre}; }));
    var campoDestino = esTec ? ''+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field" style="flex:1 1 240px"><label>Centro de Costo Destino (transferencia, opcional)</label>'+renderCombo('mov-centro-destino', 'f-mov-centro-destino', destinoOpts, STATE.movDraftCentroDestinoId, 'Elegir...')+'</div>'+
        '<div class="field" style="flex:2 1 260px;justify-content:flex-end"><div style="font-size:11px;color:var(--ink-soft);padding-bottom:8px">'+(editing ?
          'Si lo completás, se va a crear un movimiento espejo nuevo en ese centro (misma fecha y categoría, mismo monto, tipo contrario) — pensado para cuando falta la contrapartida de un movimiento importado. No hace falta si ya la cargaste.' :
          'Si lo completás, se va a crear automáticamente el movimiento espejo en ese centro (misma fecha y categoría, mismo monto, tipo contrario). Si lo dejás vacío, se carga solo este movimiento.'
        )+'</div></div>'+
      '</div>' : '';
    var cuotasNum = Math.max(1, parseInt(e.cuotas,10)||1);
    var textoAyudaCuotas;
    if(cuotasNum<=1){
      textoAyudaCuotas = 'La Fecha de arriba se toma como vencimiento del resumen en que se paga.';
    } else if(editing){
      textoAyudaCuotas = 'Este movimiento queda como la cuota 1/'+cuotasNum+'. Se van a crear '+(cuotasNum-1)+' movimiento(s) más para las cuotas siguientes, uno por mes a partir de la Fecha de arriba, con este mismo monto cada uno.';
    } else {
      textoAyudaCuotas = 'La Fecha de arriba se toma como vencimiento de la 1ª cuota. Se van a crear '+cuotasNum+' movimientos, uno por mes, con este mismo monto cada uno.';
    }
    var campoCuotas = e.tarjeta ? ''+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field"><label>Fecha de consumo (opcional)</label><input type="date" id="f-mov-fecha-consumo" value="'+esc(e.fechaConsumo||'')+'"></div>'+
        '<div class="field"><label>Marca de tarjeta (opcional)</label><input type="text" id="f-mov-tarjeta-marca" autocomplete="off" placeholder="Visa, Mastercard, Amex..." value="'+esc(e.tarjetaMarca||'')+'" style="width:140px"></div>'+
        '<div class="field"><label>Cantidad de cuotas</label><input type="number" min="1" step="1" id="f-mov-cuotas" value="'+cuotasNum+'" style="width:100px"></div>'+
        '<div class="field" style="flex:2 1 260px;justify-content:flex-end"><div style="font-size:11px;color:var(--ink-soft);padding-bottom:8px">'+textoAyudaCuotas+'</div></div>'+
      '</div>' : '';
    return ''+
      (STATE.movFormMsg ? '<div class="msg err">'+esc(STATE.movFormMsg)+'</div>' : '')+
      '<div class="row">'+
        '<div class="field"><label>Fecha</label><input type="date" id="f-mov-fecha" value="'+esc(e.fecha)+'"></div>'+
        '<div class="field"><label>Centro de Costo'+((e.fecha && e.fecha>fechaHoyISO())?' (opcional, fecha futura)':'')+'</label>'+
          renderCombo('mov-centro', 'f-mov-centro', [comboOpcionVacia()].concat(centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo+' · '+c.nombre}; })), e.centroId, 'Elegir...')+
        '</div>'+
        '<div class="field"><label>Categoría</label>'+
          renderCombo('mov-categoria', 'f-mov-categoria', [comboOpcionVacia()].concat(categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; })), e.categoriaId, 'Elegir...')+
        '</div>'+
        '<div class="field"><label>Subcategoría</label>'+
          renderCombo('mov-subcategoria', 'f-mov-subcategoria', [comboOpcionVacia()].concat(subOptionsArr), e.subcategoriaId, 'Elegir o crear...')+
        '</div>'+
      '</div>'+
      campoDestino+
      '<div class="row" style="margin-top:10px">'+
        '<div class="field"><label>Proveedor</label><input type="text" id="f-mov-proveedor" value="'+esc(e.proveedor)+'" style="width:200px"></div>'+
        '<div class="field"><label>Detalle</label><input type="text" id="f-mov-detalle" value="'+esc(e.detalle)+'" style="width:200px"></div>'+
        '<div class="field"><label>Tipo</label><select id="f-mov-tipo">'+
          '<option value="egreso" '+(e.tipo==='egreso'?'selected':'')+'>Egreso</option>'+
          '<option value="ingreso" '+(e.tipo==='ingreso'?'selected':'')+'>Ingreso</option>'+
        '</select></div>'+
        '<div class="field"><label>Monto</label><input type="number" step="0.01" id="f-mov-monto" value="'+esc(e.monto)+'" style="width:120px"></div>'+
        '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
          '<input type="checkbox" id="f-mov-tarjeta" '+(e.tarjeta?'checked':'')+' style="width:auto"> 💳 Pagado con tarjeta de crédito'+
        '</label></div>'+
      campoCuotas;
  }

  if(STATE.bulkEditMovAbierto){
    MODAL_HTML = renderBulkEditMovModal();
  } else if(editing || STATE.nuevoMovAbierto){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>'+(editing?'Editar movimiento':'Nuevo movimiento')+'</h2>'+
      camposMov(e, subOptionsArr)+
        '<button data-action="save-mov" data-id="'+(editing?editing.id:'')+'">'+(editing?'Guardar cambios':'Agregar')+'</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var controlTecHtml = (Math.abs(difTec) > 0.005 || categoriasSospechosas.length > 0) ? ''+
  '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'+
    '<h3 style="color:var(--danger)">⚠️ Control TEC</h3>'+
    (Math.abs(difTec) > 0.005 ? ''+
      '<div style="font-size:13px;margin-bottom:6px">Ingresos TEC: <strong class="mono">'+fmtMonto(ingresoTec)+'</strong> — Egresos TEC: <strong class="mono">'+fmtMonto(egresoTec)+'</strong> — Diferencia: <strong class="mono">'+fmtMonto(difTec)+'</strong></div>'+
      '<div style="font-size:12px;color:var(--ink-soft)">Debería dar $0,00. Si no da cero, hay transferencias sin su par correspondiente en el otro Centro de Costo (revisá con el filtro de Categoría = TEC).</div>'
      : '')+
    (categoriasSospechosas.length > 0 ? ''+
      '<div style="font-size:12px;color:var(--ink-soft);margin-top:'+(Math.abs(difTec)>0.005?'10px':'0')+'">'+
        'La(s) categoría(s) '+categoriasSospechosas.map(function(c){return '"'+esc(c.nombre)+'"';}).join(', ')+' parece(n) ser de transferencias pero no tiene(n) el Tipo "TEC" asignado en ABM → Categorías — por eso se están contando como ingreso/egreso real en el Resumen.'+
      '</div>'
      : '')+
  '</div>' : '';

  var hayFiltrosActivosMov = f.centro.length || f.categoria.length || f.subcategoria.length || f.mes.length || f.texto || f.soloIncompletos || f.soloTarjeta;
  var filtersHtml = ''+
  '<div class="card card-filtros">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">'+
      '<h3 style="margin-bottom:0">Filtros</h3>'+
      (hayFiltrosActivosMov ? '<button class="secondary" data-action="limpiar-filtros-mov" style="font-size:12px;padding:6px 12px">✕ Limpiar filtros</button>' : '')+
    '</div>'+
    '<div class="filters">'+
      '<div class="field"><label>Centro de Costo</label>'+renderMultiSelect('ff-centro', centroOptions, f.centro)+'</div>'+
      '<div class="field"><label>Categoría</label>'+renderMultiSelect('ff-categoria', categoriaOptions, f.categoria)+'</div>'+
      '<div class="field"><label>Mes</label>'+renderMultiSelect('ff-mes', mesOptions, f.mes)+'</div>'+
      '<div class="field"><label>Subcategoría</label>'+renderMultiSelect('ff-subcategoria', subcategoriaOptions, f.subcategoria)+'</div>'+
      '<div class="field"><label>Buscar</label><input type="text" id="ff-texto" placeholder="proveedor o detalle" value="'+esc(f.texto)+'" style="width:180px"></div>'+
      '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
        '<input type="checkbox" id="ff-solo-incompletos" '+(f.soloIncompletos?'checked':'')+' style="width:auto"> Solo incompletos ('+cantidadIncompletos+')'+
      '</label></div>'+
      '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
        '<input type="checkbox" id="ff-solo-tarjeta" '+(f.soloTarjeta?'checked':'')+' style="width:auto"> 💳 Solo tarjeta'+
      '</label></div>'+
      (f.soloIncompletos ? '<div class="field"><label>&nbsp;</label><button class="secondary" data-action="refrescar-incompletos" style="font-size:12px;padding:6px 12px">🔄 Actualizar lista</button></div>' : '')+
    '</div>'+
  '</div>';

  var barraSeleccionHtml = seleccionados.length ? ''+
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">'+
      '<span>'+seleccionados.length+' seleccionado(s)</span>'+
      '<button data-action="abrir-bulk-edit-mov" style="font-size:12px;padding:6px 12px">✏️ Editar seleccionados</button>'+
      '<button class="secondary" data-action="deseleccionar-mov" style="font-size:12px;padding:6px 12px">Deseleccionar todo</button>'+
    '</div>' : '';

  var paginacionHtml = vista.length ? ''+
    '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:12px;font-size:13px">'+
      '<button class="secondary" data-action="mov-pagina-anterior" style="font-size:12px;padding:6px 12px"'+(STATE.movPaginaActual<=1?' disabled':'')+'>« Anterior</button>'+
      '<span>Página '+STATE.movPaginaActual+' de '+totalPaginasMov+'</span>'+
      '<button class="secondary" data-action="mov-pagina-siguiente" style="font-size:12px;padding:6px 12px"'+(STATE.movPaginaActual>=totalPaginasMov?' disabled':'')+'>Siguiente »</button>'+
    '</div>' : '';

  var tableHtml = ''+
  '<div class="card">'+
    '<h3>Movimientos ('+lista.length+')</h3>'+
    barraSeleccionHtml+
    (lista.length ? ''+
    '<table id="tabla-movimientos" class="tabla-movil"><thead><tr><th><input type="checkbox" id="chk-select-all-mov" '+(todosVisiblesSeleccionados?'checked':'')+'></th><th>Fecha</th><th>CC</th><th>Categoría</th><th>Subcategoría</th><th>Proveedor</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead>'+
    '<tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td colspan="7" data-label="">Totales (sin TEC)</td><td class="num ingreso" data-label="Total Ingreso">'+fmtMonto(totalIngreso)+'</td><td class="num egreso" data-label="Total Egreso">'+fmtMonto(totalEgreso)+'</td><td class="num '+(totalIngreso-totalEgreso>=0?'ingreso':'egreso')+'" data-label="Ingresos - Egresos">'+fmtMonto(totalIngreso-totalEgreso)+'</td></tr></tfoot>'+
    '</table>' : '<div class="empty">No hay movimientos que coincidan con los filtros.</div>')+
    paginacionHtml+
  '</div>';

  return controlTecHtml + filtersHtml + tableHtml;
}

// ===================== IMPORTAR =====================
function renderImportar(){
  var e = STATE.importEntidad || 'mp';
  var msgHtml = STATE.importMsg ? '<div class="msg '+(STATE.importMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.importMsg.text)+'</div>' : '';

  var subFieldsHtml = '';
  if(e === 'mp'){
    subFieldsHtml = '<div class="field"><label>Año</label><input type="text" id="imp-anio" value="'+esc(STATE.importAnio||'26')+'" style="width:60px"></div>';
  } else if(e === 'tarjeta'){
    subFieldsHtml = ''+
      '<div class="field"><label>Banco</label><select id="imp-banco">'+
        '<option value="nacion" '+(STATE.importBanco==='nacion'?'selected':'')+'>Nación</option>'+
        '<option value="santander" '+(STATE.importBanco==='santander'?'selected':'')+'>Santander</option>'+
        '<option value="provincia" '+(STATE.importBanco==='provincia'?'selected':'')+'>Provincia</option>'+
        '<option value="mercadopago" '+(STATE.importBanco==='mercadopago'?'selected':'')+'>Mercado Pago</option>'+
      '</select></div>'+
      '<div class="field"><label>Vencimiento</label><input type="date" id="imp-vencimiento" value="'+esc(STATE.importVencimiento||'')+'"></div>'+
      '<div class="field"><label>Marca de tarjeta (opcional)</label><input type="text" id="imp-tarjeta-marca" autocomplete="off" placeholder="Visa, Mastercard, Amex..." value="'+esc(STATE.importTarjetaMarca||'')+'" style="width:150px"></div>';
  }

  var excelHint = e==='excel' ? '<div class="msg ok" style="margin-top:8px">Pegá las filas copiadas de tu Excel, en este orden de columnas (separadas por tab): Periodo, Cuenta, Categoría, Subcategoría, CC, Fecha, Proveedor, Detalle, Ingresos, Egresos. Si falta un Centro de Costo, Categoría o Subcategoría, se crea automáticamente al importar.</div>' : '';

  var formHtml = ''+
  '<div class="card">'+
    '<h2>Importar movimientos</h2>'+
    msgHtml+
    '<div class="row">'+
      '<div class="field"><label>Entidad</label><select id="imp-entidad">'+
        '<option value="mp" '+(e==='mp'?'selected':'')+'>Mercado Pago</option>'+
        '<option value="santander" '+(e==='santander'?'selected':'')+'>Santander</option>'+
        '<option value="nacion" '+(e==='nacion'?'selected':'')+'>Banco Nación</option>'+
        '<option value="provincia" '+(e==='provincia'?'selected':'')+'>Banco Provincia</option>'+
        '<option value="tarjeta" '+(e==='tarjeta'?'selected':'')+'>Tarjeta de Crédito</option>'+
        '<option value="excel" '+(e==='excel'?'selected':'')+'>Excel histórico (ya categorizado)</option>'+
      '</select></div>'+
      subFieldsHtml+
    '</div>'+
    excelHint+
    '<div class="field" style="margin-top:10px"><label>Texto del resumen</label>'+
    '<textarea id="imp-raw" rows="8" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Pegá acá el texto copiado del resumen...">'+esc(STATE.importRaw||'')+'</textarea></div>'+
    '<div class="row" style="margin-top:10px"><button data-action="preview-import">Previsualizar</button></div>'+
  '</div>';

  var previewHtml = '';
  if(STATE.importPreview){
    var centroOpts = centrosOrdenados().map(function(c){ return '<option value="'+c.id+'">'+esc(c.codigo)+'</option>'; }).join('');
    var catOpts = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');

    var dupIds = calcularDuplicados(STATE.importPreview.map(function(r){
      return { id:r.id, fecha:r.fecha, centroId:r.centroId, proveedor:r.proveedor, monto:r.monto };
    }));

    var rows = STATE.importPreview.map(function(r){
      var esDup = !!dupIds[r.id];
      var centroSel = '<select data-rowid="'+r.id+'" data-field="centroId"><option value="">—</option>'+
        centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(r.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+'</option>'; }).join('')+'</select>';
      var catSel = '<select data-rowid="'+r.id+'" data-field="categoriaId"><option value="">Sin categoría</option>'+
        categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(r.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+'</select>';
      var subOpts = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){return s.categoriaId===r.categoriaId;}))
        .map(function(s){ return '<option value="'+s.id+'" '+(r.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
      var subSel = '<select data-rowid="'+r.id+'" data-field="subcategoriaId"><option value="">—</option>'+subOpts+'</select>';
      var dupTag = esDup ? ' <span title="Posible duplicado: mismo Centro, fecha, proveedor y monto que otro movimiento. Revisá antes de importar." style="color:var(--danger)">⚠️</span>' : '';
      var provInput = '<input type="text" id="imp-prov-'+r.id+'" data-rowid="'+r.id+'" data-field="proveedor" value="'+esc(r.proveedor)+'" style="width:100%;min-width:110px;box-sizing:border-box">';
      var detInput = '<input type="text" id="imp-det-'+r.id+'" data-rowid="'+r.id+'" data-field="detalle" value="'+esc(r.detalle)+'" style="width:100%;min-width:110px;box-sizing:border-box">';
      return '<tr'+(esDup?' class="fila-duplicada"':'')+'>'+
        '<td><input type="checkbox" data-rowid="'+r.id+'" data-field="incluir" '+(r.incluir?'checked':'')+'></td>'+
        '<td class="mono">'+esc(fechaISOaDDMMAAAA(r.fecha)||r.fecha)+dupTag+'</td>'+
        '<td>'+centroSel+'</td>'+
        '<td>'+catSel+'</td>'+
        '<td>'+subSel+'</td>'+
        '<td>'+provInput+'</td>'+
        '<td>'+detInput+'</td>'+
        '<td class="num ingreso">'+(r.monto>0?fmtMonto(r.monto):'')+'</td>'+
        '<td class="num egreso">'+(r.monto<0?fmtMonto(-r.monto):'')+'</td>'+
        '<td style="text-align:center"><input type="checkbox" data-rowid="'+r.id+'" data-field="guardarRegla" '+(r.guardarRegla?'checked':'')+' title="Guardar esta relación proveedor → categoría como regla para futuras importaciones"></td>'+
      '</tr>';
    }).join('');

    var incluidos = STATE.importPreview.filter(function(r){return r.incluir;}).length;
    var duplicados = STATE.importPreview.filter(function(r){return dupIds[r.id];}).length;

    previewHtml = ''+
    '<div class="card">'+
      '<h3>Aplicar a todas las filas</h3>'+
      '<div class="row">'+
        '<div class="field"><label>Centro de Costo</label><select id="imp-centro-all"><option value="">(sin cambio)</option>'+centroOpts+'</select></div>'+
        '<div class="field"><label>Categoría</label><select id="imp-cat-all"><option value="">(sin cambio)</option>'+catOpts+'</select></div>'+
        '<button class="secondary" data-action="apply-all">Aplicar a todas</button>'+
      '</div>'+
    '</div>'+
    '<div class="card">'+
      '<h3>Previsualización ('+STATE.importPreview.length+' movimiento(s), '+incluidos+' seleccionado(s))</h3>'+
      (duplicados>0 ? '<div class="msg err">⚠️ '+duplicados+' fila(s) marcada(s) como posible duplicado (mismo Centro, fecha, proveedor y monto que otro movimiento). Revisalas antes de confirmar.</div>' : '')+
      '<table id="import-preview-table"><thead><tr><th></th><th>Fecha</th><th>Centro</th><th>Categoría</th><th>Subcategoría</th><th>Proveedor</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th title="Guardar la relación proveedor → categoría como regla para futuras importaciones">Regla</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="confirm-import">Importar '+incluidos+' movimiento(s)</button>'+
        '<button class="secondary" data-action="cancel-import">Cancelar</button>'+
      '</div>'+
    '</div>';
  }

  var previewExcelHtml = '';
  if(STATE.importPreviewExcel){
    var dupIdsExcel = calcularDuplicados(STATE.importPreviewExcel.map(function(r){
      var centro = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === (r.ccText||'').toUpperCase(); });
      return { id:r.id, fecha:r.fecha, centroId: centro?centro.id:('__nuevo__'+(r.ccText||'').toUpperCase()), proveedor:r.proveedor, monto: r.ingreso>0?r.ingreso:-r.egreso };
    }));

    var rowsExcel = STATE.importPreviewExcel.map(function(r){
      var esDup = !!dupIdsExcel[r.id];
      var tagCC = r.ccExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>';
      var tagCat = r.catExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>';
      var tagSub = (!r.subcategoriaText) ? '' : (r.subExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>');
      var dupTag = esDup ? ' <span title="Posible duplicado: mismo Centro, fecha, proveedor y monto que otro movimiento. Revisá antes de importar." style="color:var(--danger)">⚠️</span>' : '';
      return '<tr'+(esDup?' class="fila-duplicada"':'')+'>'+
        '<td><input type="checkbox" data-rowid="'+r.id+'" data-field="incluir" '+(r.incluir?'checked':'')+'></td>'+
        '<td class="mono">'+esc(fechaISOaDDMMAAAA(r.fecha)||r.fecha)+dupTag+'</td>'+
        '<td class="mono">'+esc(r.ccText)+tagCC+'</td>'+
        '<td>'+esc(r.categoriaText)+tagCat+'</td>'+
        '<td>'+esc(r.subcategoriaText)+tagSub+'</td>'+
        '<td>'+esc(r.proveedor)+'</td>'+
        '<td>'+esc(r.detalle)+'</td>'+
        '<td class="num ingreso">'+(r.ingreso>0?fmtMonto(r.ingreso):'')+'</td>'+
        '<td class="num egreso">'+(r.egreso>0?fmtMonto(r.egreso):'')+'</td>'+
      '</tr>';
    }).join('');
    var incluidosExcel = STATE.importPreviewExcel.filter(function(r){return r.incluir;}).length;
    var nuevosCC = STATE.importPreviewExcel.filter(function(r){return !r.ccExists;}).length;
    var nuevasCat = STATE.importPreviewExcel.filter(function(r){return !r.catExists;}).length;
    var duplicadosExcel = STATE.importPreviewExcel.filter(function(r){return dupIdsExcel[r.id];}).length;

    previewExcelHtml = ''+
    '<div class="card">'+
      '<h3>Previsualización ('+STATE.importPreviewExcel.length+' movimiento(s), '+incluidosExcel+' seleccionado(s))</h3>'+
      (nuevosCC>0||nuevasCat>0 ? '<div class="msg ok">Se van a crear automáticamente: '+nuevosCC+' Centro(s) de Costo nuevo(s), '+nuevasCat+' Categoría(s) nueva(s) (marcados en rojo abajo). Revisá que no sean errores de tipeo antes de confirmar.</div>' : '')+
      (duplicadosExcel>0 ? '<div class="msg err">⚠️ '+duplicadosExcel+' fila(s) marcada(s) como posible duplicado (mismo Centro, fecha, proveedor y monto que otro movimiento). Revisalas antes de confirmar.</div>' : '')+
      '<table id="import-preview-excel-table"><thead><tr><th></th><th>Fecha</th><th>CC</th><th>Categoría</th><th>Subcategoría</th><th>Proveedor</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th></tr></thead>'+
      '<tbody>'+rowsExcel+'</tbody></table>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="confirm-import-excel">Importar '+incluidosExcel+' movimiento(s)</button>'+
        '<button class="secondary" data-action="cancel-import">Cancelar</button>'+
      '</div>'+
    '</div>';
  }

  var reglasOrdenadas = (STATE.reglas||[]).slice().sort(function(a,b){ return (a.proveedor||'').localeCompare(b.proveedor||'', 'es', {sensitivity:'base'}); });
  var filasReglas = reglasOrdenadas.map(function(r){
    return '<tr><td>'+esc(r.proveedor)+'</td><td>'+esc(r.categoria)+'</td><td>'+esc(r.subcategoria||'—')+'</td>'+
      '<td><button class="secondary" data-action="borrar-regla" data-id="'+r.id+'" title="Borrar regla" style="padding:2px 8px">✕</button></td></tr>';
  }).join('');
  var categoriaOptsRegla = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');

  var reglasHtml = ''+
  '<div class="card">'+
    '<h3>Reglas de categorización</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Al previsualizar una importación, si el proveedor de una fila coincide (parcialmente, sin importar mayúsculas) con el texto de una regla, se precargan su Categoría y Subcategoría. Se guardan en este navegador, no en la base de datos compartida.</div>'+
    (STATE.reglaFormMsg ? '<div class="msg err">'+esc(STATE.reglaFormMsg)+'</div>' : '')+
    '<div class="row" style="margin-bottom:10px">'+
      '<div class="field"><label>Proveedor (texto parcial)</label><input type="text" id="regla-proveedor" placeholder="Ej: Barrientos"></div>'+
      '<div class="field"><label>Categoría</label><select id="regla-categoria"><option value="">Elegir...</option>'+categoriaOptsRegla+'</select></div>'+
      '<div class="field"><label>Subcategoría (opcional)</label><input type="text" id="regla-subcategoria" placeholder="Ej: Limpieza"></div>'+
      '<div class="field" style="justify-content:flex-end"><button data-action="agregar-regla">Agregar regla</button></div>'+
    '</div>'+
    (reglasOrdenadas.length ? ''+
      '<div style="overflow-x:auto"><table><thead><tr><th>Proveedor</th><th>Categoría</th><th>Subcategoría</th><th></th></tr></thead>'+
      '<tbody>'+filasReglas+'</tbody></table></div>'
      : '<div class="empty">Todavía no hay reglas guardadas.</div>')+
  '</div>';

  return formHtml + previewHtml + previewExcelHtml + reglasHtml;
}

// ===================== VENCIMIENTOS =====================
function fechaVencCortaAISO(s){
  var m = (s||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return '';
  var dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0');
  var yy = m[3].length===2 ? '20'+m[3] : m[3];
  return yy+'-'+mm+'-'+dd;
}
function fechaISOaDDMMAAAA(iso){
  var m = (iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3]+'/'+m[2]+'/'+m[1] : '';
}
function diasHasta(iso){
  if(!iso) return null;
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var partes = iso.split('-').map(Number);
  var f = new Date(partes[0], partes[1]-1, partes[2]);
  return Math.round((f-hoy)/86400000);
}

function campoVenc(e){
  return '<div class="field"><label>Concepto</label><input type="text" id="f-venc-concepto" value="'+esc(e.concepto)+'" style="width:220px" placeholder="Ej: Tarjeta Visa Santander"></div>'+
    '<div class="field"><label>Fecha de vencimiento</label><input type="date" id="f-venc-fecha" value="'+esc(e.fecha)+'"></div>'+
    '<div class="field"><label>Monto</label><input type="number" step="0.01" id="f-venc-monto" value="'+esc(e.monto)+'" style="width:130px"></div>'+
    '<div class="field"><label>Centro de Costo</label><select id="f-venc-centro"><option value="">(sin asignar)</option>'+
      centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(e.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('') +
    '</select></div>';
}
function renderVencimientos(){
  var editing = STATE.editing && STATE.editing.type==='venc' ? STATE.vencimientos.find(function(x){return x.id===STATE.editing.id;}) : null;

  var bulkMsgHtml = STATE.bulkVencMsg ? '<div class="msg '+(STATE.bulkVencMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkVencMsg.text)+'</div>' : '';

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar vencimiento</h2>'+
      (STATE.vencFormMsg ? '<div class="msg err">'+esc(STATE.vencFormMsg)+'</div>' : '')+
      '<div class="row">'+ campoVenc(editing) +'</div>'+
      '<div class="row" style="margin-top:14px">'+
        '<button data-action="save-venc" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevoVenc = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nuevo vencimiento</h2>'+
    (STATE.vencFormMsg ? '<div class="msg err">'+esc(STATE.vencFormMsg)+'</div>' : '')+
    '<div class="row">'+ campoVenc({concepto:'', fecha:'', monto:'', centroId:''}) +
      '<button data-action="save-venc" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  var formHtml = formNuevoVenc +
  '<div class="card">'+
    '<h3>Carga masiva</h3>'+
    bulkMsgHtml+
    '<div class="field"><label>Pegá "Concepto" + tab + "Fecha (dd/mm/aaaa)" + tab + "Monto" por línea. Opcional: un cuarto valor con el código de Centro de Costo.</label>'+
    '<textarea id="bulk-vencimientos" rows="5" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Tarjeta Visa Santander\t13/07/2026\t216759.02\tBSF"></textarea></div>'+
    '<div class="row" style="margin-top:10px"><button data-action="bulk-add-vencimientos">Cargar todos</button></div>'+
  '</div>';

  var lista = STATE.vencimientos.slice().sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
  var rows = lista.map(function(v){
    var dias = diasHasta(v.fecha);
    var diasTxt = dias===null ? '' : (dias<0 ? Math.abs(dias)+' día(s) vencido' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)'));
    var colorDias = dias!==null && dias<=3 ? 'egreso' : (dias!==null && dias<=7 ? '' : 'ingreso');
    return '<tr>'+
      '<td data-label="Concepto">'+esc(v.concepto)+'</td>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(v.fecha))+'</td>'+
      '<td class="mono '+(v.estado==='pagado'?'':colorDias)+'" data-label="Estado">'+(v.estado==='pagado'?'Pagado':diasTxt)+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(v.centroId?nombreCentro(v.centroId).split(' · ')[0]:'—')+'</td>'+
      '<td class="num mono" data-label="Monto">'+fmtMonto(v.monto)+'</td>'+
      '<td class="actions-cell">'+
        '<button class="link" data-action="toggle-venc-estado" data-id="'+v.id+'">'+(v.estado==='pagado'?'marcar pendiente':'marcar pagado')+'</button>'+
        (v.estado!=='pagado' ? '<button class="link" data-action="venc-a-movimiento" data-id="'+v.id+'">cargar como movimiento</button>' : '')+
        '<button class="link" data-action="edit-venc" data-id="'+v.id+'">editar</button>'+
        '<button class="link" data-action="del-venc" data-id="'+v.id+'">borrar</button>'+
      '</td>'+
    '</tr>';
  }).join('');

  var tableHtml = '<div class="card"><h3>Vencimientos ('+lista.length+')</h3>'+
    (lista.length ? '<table class="tabla-movil"><thead><tr><th>Concepto</th><th>Fecha</th><th>Estado</th><th>Centro</th><th class="num">Monto</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún vencimiento.</div>')+
  '</div>';

  // Movimientos ya cargados con fecha futura (p. ej. cuotas de tarjeta): no aparecen en Movimientos
  // hasta que llega su fecha, pero se pueden revisar/editar/borrar acá mientras tanto.
  var pendientesMov = STATE.movimientos.filter(esMovimientoPendiente).sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
  function filaMovPendiente(m){
    var dias = diasHasta(m.fecha);
    var diasTxt = dias===null ? '' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)');
    return '<tr>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(m.fecha)||m.fecha||'')+'</td>'+
      '<td class="mono" data-label="Vence">'+diasTxt+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(nombreCentro(m.centroId)).split(' · ')[0]+'</td>'+
      '<td data-label="Categoría">'+esc(nombreCategoria(m.categoriaId))+'</td>'+
      '<td data-label="Proveedor">'+(m.tarjeta?'<span title="Pagado con tarjeta de crédito">💳</span> ':'')+esc(m.proveedor||'')+'</td>'+
      '<td data-label="Detalle">'+esc(m.detalle||'')+'</td>'+
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-mov" data-id="'+m.id+'">editar</button>'+
      '<button class="link" data-action="del-mov" data-id="'+m.id+'">borrar</button></td>'+
    '</tr>';
  }

  // De los pendientes con tarjeta, agrupar por Fecha + Centro (la cuenta desde la que se paga esa tarjeta)
  // para ver de un vistazo el total a pagar de cada resumen, con el detalle desplegable.
  var pendientesTarjeta = pendientesMov.filter(function(m){ return !!m.tarjeta; });
  var pendientesOtros = pendientesMov.filter(function(m){ return !m.tarjeta; });
  var gruposTarjetaMap = {}, gruposTarjetaOrden = [];
  pendientesTarjeta.forEach(function(m){
    var clave = m.fecha+'|'+(m.centroId||'');
    if(!gruposTarjetaMap[clave]){
      gruposTarjetaMap[clave] = { fecha:m.fecha, centroId:m.centroId||'', movs:[], total:0 };
      gruposTarjetaOrden.push(clave);
    }
    gruposTarjetaMap[clave].movs.push(m);
    gruposTarjetaMap[clave].total += (Number(m.egreso)||0) - (Number(m.ingreso)||0);
  });
  var gruposTarjetaHtml = gruposTarjetaOrden.map(function(clave){
    var g = gruposTarjetaMap[clave];
    var dias = diasHasta(g.fecha);
    var diasTxt = dias===null ? '' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)');
    var nombreCC = g.centroId ? nombreCentro(g.centroId) : '(sin centro asignado)';
    var filasGrupo = g.movs.map(filaMovPendiente).join('');
    var claveAbierto = 'venc-tarjeta|'+clave;
    return '<details class="resumen-tarjeta" data-grupo-key="'+esc(claveAbierto)+'"'+(STATE.gruposAbiertos[claveAbierto]?' open':'')+'>'+
      '<summary>'+
        '<span class="mono">'+esc(fechaISOaDDMMAAAA(g.fecha)||g.fecha)+'</span>'+
        '<span style="color:var(--ink-soft);font-size:12px">'+diasTxt+'</span>'+
        '<span>💳 '+esc(nombreCC)+'</span>'+
        '<span style="font-size:12px;color:var(--ink-soft)">'+g.movs.length+' movimiento(s)</span>'+
        '<span class="mono egreso" style="margin-left:auto;font-weight:600">'+fmtMonto(g.total)+'</span>'+
      '</summary>'+
      '<div style="overflow-x:auto;margin-top:10px"><table class="tabla-movil"><thead><tr><th>Fecha</th><th>Vence</th><th>Centro</th><th>Categoría</th><th>Proveedor</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead><tbody>'+filasGrupo+'</tbody></table></div>'+
    '</details>';
  }).join('');

  var rowsPendientesOtros = pendientesOtros.map(filaMovPendiente).join('');
  var tablePendientesMovHtml = '<div class="card"><h3>Movimientos con fecha futura ('+pendientesMov.length+')</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Movimientos ya cargados (por ejemplo, cuotas de tarjeta) con fecha posterior a hoy. No se cuentan en Saldos todavía; al llegar su fecha van a pasar a verse en Movimientos automáticamente.</div>'+
    (gruposTarjetaHtml ? gruposTarjetaHtml : '')+
    (pendientesOtros.length ? ''+
      (gruposTarjetaHtml ? '<div style="font-size:11px;color:var(--ink-soft);margin:14px 0 8px;text-transform:uppercase;letter-spacing:.04em">Otros movimientos pendientes</div>' : '')+
      '<table class="tabla-movil"><thead><tr><th>Fecha</th><th>Vence</th><th>Centro</th><th>Categoría</th><th>Proveedor</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead><tbody>'+rowsPendientesOtros+'</tbody></table>'
      : '')+
    (!pendientesMov.length ? '<div class="empty">No hay movimientos con fecha futura.</div>' : '')+
  '</div>';

  return formHtml + tablePendientesMovHtml + tableHtml;
}

// ===================== SALDOS =====================
function titularDeCentro(codigo){
  var c = (codigo||'').trim().toUpperCase();
  if(c.slice(-1) === 'A') return 'Ana';
  if(c.slice(-1) === 'F') return 'Franco';
  return 'Otros';
}
function calcularSaldos(){
  var saldoPorCentro = {};
  STATE.centros.forEach(function(c){ saldoPorCentro[c.id] = 0; });
  var saldoSinCentro = 0;

  STATE.movimientos.forEach(function(m){
    if(esMovimientoPendiente(m)) return; // los movimientos con fecha futura no se consideran para el saldo todavía
    var delta = (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    if(m.centroId && saldoPorCentro.hasOwnProperty(m.centroId)){
      saldoPorCentro[m.centroId] += delta;
    } else {
      saldoSinCentro += delta;
    }
  });

  var filas = STATE.centros.map(function(c){
    return { id:c.id, codigo:c.codigo, nombre:c.nombre, titular: titularDeCentro(c.codigo), saldo: saldoPorCentro[c.id]||0 };
  }).sort(function(a,b){ return a.titular.localeCompare(b.titular) || a.codigo.localeCompare(b.codigo); });

  var totalAna = filas.filter(function(f){return f.titular==='Ana';}).reduce(function(s,f){return s+f.saldo;},0);
  var totalFranco = filas.filter(function(f){return f.titular==='Franco';}).reduce(function(s,f){return s+f.saldo;},0);
  var hayOtros = filas.some(function(f){return f.titular==='Otros';}) || saldoSinCentro !== 0;
  var totalOtros = filas.filter(function(f){return f.titular==='Otros';}).reduce(function(s,f){return s+f.saldo;},0) + saldoSinCentro;
  var totalGeneral = totalAna + totalFranco + totalOtros;

  return { filas:filas, saldoSinCentro:saldoSinCentro, totalAna:totalAna, totalFranco:totalFranco, hayOtros:hayOtros, totalOtros:totalOtros, totalGeneral:totalGeneral, calculadoEn: new Date() };
}
function obtenerSaldos(){
  if(STATE.saldosDirty || !STATE.saldosCache){
    STATE.saldosCache = calcularSaldos();
    STATE.saldosDirty = false;
  }
  return STATE.saldosCache;
}
function renderSaldos(){
  var s = obtenerSaldos();
  var filas = s.filas, saldoSinCentro = s.saldoSinCentro;

  var horaCalculo = s.calculadoEn.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  var cards = ''+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Saldo total</div><div class="value">'+fmtMonto(s.totalGeneral)+'</div></div>'+
    '<div class="summary-card"><div class="label">Ana</div><div class="value">'+fmtMonto(s.totalAna)+'</div></div>'+
    '<div class="summary-card"><div class="label">Franco</div><div class="value">'+fmtMonto(s.totalFranco)+'</div></div>'+
    (s.hayOtros ? '<div class="summary-card"><div class="label">Otros</div><div class="value">'+fmtMonto(s.totalOtros)+'</div></div>' : '')+
  '</div>';

  var rows = filas.map(function(f){
    return '<tr><td class="mono" data-label="Código">'+esc(f.codigo)+'</td><td data-label="Nombre">'+esc(f.nombre)+'</td><td data-label="Titular">'+esc(f.titular)+'</td><td class="num mono" data-label="Saldo">'+fmtMonto(f.saldo)+'</td></tr>';
  }).join('');
  var filaSinCentro = saldoSinCentro !== 0 ? '<tr><td class="mono" data-label="Código">—</td><td data-label="Nombre">Movimientos sin Centro de Costo asignado</td><td data-label="Titular">—</td><td class="num mono" data-label="Saldo">'+fmtMonto(saldoSinCentro)+'</td></tr>' : '';

  var tabla = '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Saldo por Centro de Costo</h3>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:var(--ink-soft)">Calculado a las '+horaCalculo+'</span>'+
        '<button class="secondary" data-action="recalcular-saldos" style="font-size:12px;padding:6px 12px">↻ Recalcular</button>'+
      '</div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Parte del saldo inicial cargado en la categoría "Saldo Inicial" (0 si no tiene) y suma/resta todos los ingresos y egresos, sin excluir TEC ni Obra, para reflejar el saldo real de cada cuenta. Se recalcula solo con cada movimiento nuevo; usá "Recalcular" para traer también cambios hechos desde otra sesión. Los movimientos con fecha posterior a hoy se ven en Vencimientos (no en Movimientos) y no se incluyen en este cálculo.</div>'+
    (filas.length ? '<table class="tabla-movil"><thead><tr><th>Código</th><th>Nombre</th><th>Titular</th><th class="num">Saldo</th></tr></thead><tbody>'+rows+filaSinCentro+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún Centro de Costo.</div>')+
  '</div>';

  return cards + tabla;
}

// ===================== RESUMEN =====================
function esTipoCategoria(categoriaId, tipo){
  var cat = STATE.categorias.find(function(c){ return c.id === categoriaId; });
  return !!cat && cat.tipo === tipo;
}
function esCategoriaObra(categoriaId){
  var cat = STATE.categorias.find(function(c){ return c.id === categoriaId; });
  return !!cat && cat.nombre.trim().toLowerCase() === 'obra';
}
function esCategoriaSueldo(categoriaId){
  var cat = STATE.categorias.find(function(c){ return c.id === categoriaId; });
  return !!cat && cat.nombre.trim().toLowerCase() === 'sueldo';
}

var PALETA_DONUT = ['#4E9D77','#A8D8BE','#D97B6C','#F0C48A','#8FBFE0','#C3AEDB','#E3C08D','#7FC4B8','#F2A6A6','#B7D89A'];

// ===================== CHIPS (Centro de Costo / Categoría) =====================
// El color se elige a mano desde el ABM (campo "Color") y se guarda en centros.color /
// categorias.color. Mientras alguno no tenga color asignado (o para los creados por carga
// masiva/importación), se usa un color determinístico según su id como respaldo, para que
// nunca se vea un chip gris/roto y siempre sea "fijo" para ese mismo registro.
function colorAutoPorId(id){
  var hash = 0;
  var s = id || '';
  for(var i=0;i<s.length;i++){ hash = (hash*31 + s.charCodeAt(i)) | 0; }
  return PALETA_DONUT[Math.abs(hash) % PALETA_DONUT.length];
}
function colorCentro(centroId){
  var c = STATE.centros.find(function(x){ return x.id===centroId; });
  return (c && c.color) || colorAutoPorId(centroId||'');
}
// Color de texto explícito del centro (columna centros.color_texto), si se cargó a mano/por SQL.
// Si no hay uno guardado, renderChip calcula el contraste automáticamente.
function colorTextoCentro(centroId){
  var c = STATE.centros.find(function(x){ return x.id===centroId; });
  return (c && c.colorTexto) || '';
}
function colorCategoria(categoriaId){
  var c = STATE.categorias.find(function(x){ return x.id===categoriaId; });
  return (c && c.color) || colorAutoPorId(categoriaId||'');
}
// Color de texto explícito de la categoría (columna categorias.color_texto), si se cargó a mano/por SQL.
// Si no hay uno guardado, renderChip calcula el contraste automáticamente.
function colorTextoCategoria(categoriaId){
  var c = STATE.categorias.find(function(x){ return x.id===categoriaId; });
  return (c && c.colorTexto) || '';
}
function colorTextoParaFondo(hex){
  var c = (hex||'').replace('#','');
  if(c.length===3) c = c.split('').map(function(ch){ return ch+ch; }).join('');
  if(c.length!==6 || /[^0-9a-fA-F]/.test(c)) return '#1A1A1A';
  var r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
  var luminancia = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminancia > 0.6 ? '#1A1A1A' : '#FFFFFF';
}
function renderChip(texto, color, colorTexto){
  if(!texto) return '—';
  var bg = color || '#E3ECE6';
  return '<span class="chip" style="background:'+esc(bg)+';color:'+esc(colorTexto||colorTextoParaFondo(bg))+'">'+esc(texto)+'</span>';
}

var NOMBRES_MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function mesLabelCorto(mesStr){
  var m = (mesStr||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return mesStr||'';
  var idx = parseInt(m[2],10)-1;
  return (NOMBRES_MES_CORTO[idx]||m[2])+' '+m[1].slice(2);
}

function donutChart(segments, size){
  var strokeWidth = Math.round(size*0.16);
  var total = segments.reduce(function(s,x){return s+x.value;},0);
  if(total<=0) return '<div class="empty">Sin datos para graficar.</div>';
  var r = (size - strokeWidth)/2;
  var cx = size/2, cy = size/2;
  var circumference = 2*Math.PI*r;
  var offsetAcc = 0;
  var circles = segments.filter(function(s){return s.value>0;}).map(function(s){
    var pct = s.value/total;
    var dash = pct*circumference;
    var gap = circumference - dash;
    var circle = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="'+strokeWidth+'" '+
      'stroke-dasharray="'+dash.toFixed(2)+' '+gap.toFixed(2)+'" stroke-dashoffset="'+(-offsetAcc).toFixed(2)+'" transform="rotate(-90 '+cx+' '+cy+')"></circle>';
    offsetAcc += dash;
    return circle;
  }).join('');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+circles+'</svg>';
}

function trendChart(meses, dataPorMes, width, height){
  if(!meses.length) return '<div class="empty">No hay suficientes datos para la tendencia mensual.</div>';
  var padding = 34;
  var chartW = width - padding*2;
  var chartH = height - padding*2;
  var max = 1;
  meses.forEach(function(m){ var d=dataPorMes[m]||{ingreso:0,egreso:0}; max=Math.max(max,d.ingreso,d.egreso); });
  var n = meses.length;
  var groupW = chartW/n;
  var barW = Math.max(4, Math.min(16, groupW/3));
  var svg = '<line x1="'+padding+'" y1="'+(padding+chartH)+'" x2="'+(width-padding)+'" y2="'+(padding+chartH)+'" stroke="#C7D6CD" stroke-width="1"></line>';
  meses.forEach(function(m,i){
    var d = dataPorMes[m]||{ingreso:0,egreso:0};
    var xBase = padding + i*groupW + groupW/2;
    var hIngreso = (d.ingreso/max)*chartH;
    var hEgreso = (d.egreso/max)*chartH;
    svg += '<rect x="'+(xBase-barW-1.5)+'" y="'+(padding+chartH-hIngreso)+'" width="'+barW+'" height="'+hIngreso+'" fill="#4E9D77" rx="3"></rect>';
    svg += '<rect x="'+(xBase+1.5)+'" y="'+(padding+chartH-hEgreso)+'" width="'+barW+'" height="'+hEgreso+'" fill="#D97B6C" rx="3"></rect>';
    svg += '<text x="'+xBase+'" y="'+(height-12)+'" font-size="10" text-anchor="middle" fill="#7A8B83">'+esc(mesLabelCorto(m))+'</text>';
  });
  return '<svg viewBox="0 0 '+width+' '+height+'" width="100%" height="'+height+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
}

function pad2(n){ return String(n).padStart(2,'0'); }
function mesesTrimestreActual(hoy){
  var qStart = Math.floor(hoy.getMonth()/3)*3;
  var out = [];
  for(var i=0;i<3;i++) out.push(hoy.getFullYear()+'-'+pad2(qStart+i+1));
  return out;
}
function mesesSemestreActual(hoy){
  var sStart = hoy.getMonth()<6 ? 0 : 6;
  var out = [];
  for(var i=0;i<6;i++) out.push(hoy.getFullYear()+'-'+pad2(sStart+i+1));
  return out;
}
function mesesAnioActual(hoy){
  var out = [];
  for(var i=0;i<12;i++) out.push(hoy.getFullYear()+'-'+pad2(i+1));
  return out;
}
function mesOffset(hoy, offset){
  var d = new Date(hoy.getFullYear(), hoy.getMonth()+offset, 1);
  return d.getFullYear()+'-'+pad2(d.getMonth()+1);
}
function mesesUltimos(hoy, n){ // últimos n meses terminando en el actual (lo incluye), sin importar si hay datos cargados
  var out = [];
  for(var i=n-1;i>=0;i--) out.push(mesOffset(hoy, -i));
  return out;
}
function mesesProximos(hoy, n){ // próximos n meses, sin incluir el actual (para ver cuotas/vencimientos futuros)
  var out = [];
  for(var i=1;i<=n;i++) out.push(mesOffset(hoy, i));
  return out;
}
function mesesParaRango(mesesDisponibles, rango){
  var hoy = new Date();
  if(rango==='3m') return mesesUltimos(hoy, 3);
  if(rango==='6m') return mesesUltimos(hoy, 6);
  if(rango==='12m') return mesesUltimos(hoy, 12);
  if(rango==='trimestre') return mesesTrimestreActual(hoy);
  if(rango==='semestre') return mesesSemestreActual(hoy);
  if(rango==='anio') return mesesAnioActual(hoy);
  if(rango==='prox1m') return mesesProximos(hoy, 1);
  if(rango==='prox3m') return mesesProximos(hoy, 3);
  if(rango==='prox6m') return mesesProximos(hoy, 6);
  return mesesDisponibles; // 'todo'
}

function renderGrillaMensual(movs, rango){
  var todosMeses = getMeses().slice().sort();
  if(!todosMeses.length) return '<div class="empty">Todavía no hay movimientos cargados.</div>';

  var meses = mesesParaRango(todosMeses, rango);
  if(!meses.length) return '<div class="empty">No hay meses para mostrar en este rango.</div>';
  var mesesSet = {};
  meses.forEach(function(m){ mesesSet[m] = true; });

  var datos = {}, totalesPorMes = {}, totalesPorMesSinObra = {}, totalesPorCategoria = {}, granTotal = 0, granTotalSinObra = 0;

  movs.forEach(function(m){
    if(esTipoCategoria(m.categoriaId,'tec')) return;
    if(esCategoriaSueldo(m.categoriaId)) return;
    var neto = (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    if(neto===0) return;
    var mes = (m.fecha||'').slice(0,7);
    if(!mes || !mesesSet[mes]) return;
    var cid = m.categoriaId || '';
    if(!datos[cid]) datos[cid] = {};
    datos[cid][mes] = (datos[cid][mes]||0) + neto;
    totalesPorMes[mes] = (totalesPorMes[mes]||0) + neto;
    totalesPorCategoria[cid] = (totalesPorCategoria[cid]||0) + neto;
    granTotal += neto;
    if(!esCategoriaObra(cid)){
      totalesPorMesSinObra[mes] = (totalesPorMesSinObra[mes]||0) + neto;
      granTotalSinObra += neto;
    }
  });

  var categoriaIds = Object.keys(datos).sort(function(a,b){ return Math.abs(totalesPorCategoria[b]||0) - Math.abs(totalesPorCategoria[a]||0); });
  if(!categoriaIds.length) return '<div class="empty">No hay movimientos en el rango seleccionado.</div>';

  var maxCelda = 0;
  categoriaIds.forEach(function(cid){ meses.forEach(function(m){ maxCelda = Math.max(maxCelda, Math.abs(datos[cid][m]||0)); }); });

  var headerCols = meses.map(function(m){ return '<th class="num">'+esc(mesLabelCorto(m))+'</th>'; }).join('');
  var rows = categoriaIds.map(function(cid){
    var celdas = meses.map(function(m){
      var v = datos[cid][m]||0;
      var intensidad = maxCelda ? (Math.abs(v)/maxCelda) : 0;
      var colorRgb = v<0 ? '217,123,108' : '78,157,119';
      var estilo = v!==0 ? ' style="background:rgba('+colorRgb+','+(0.08+intensidad*0.32).toFixed(2)+')"' : '';
      return '<td class="num mono"'+estilo+'>'+(v!==0?fmtMonto(v):'—')+'</td>';
    }).join('');
    var totalCat = totalesPorCategoria[cid]||0;
    return '<tr><td>'+esc(cid ? nombreCategoria(cid) : 'Sin categoría')+'</td>'+celdas+'<td class="num mono '+(totalCat>=0?'ingreso':'egreso')+'" style="font-weight:600">'+fmtMonto(totalCat)+'</td></tr>';
  }).join('');

  var filaTotalSinObra = '<tr style="font-weight:600"><td>Total (sin Obra)</td>'+
    meses.map(function(m){ var v=totalesPorMesSinObra[m]||0; return '<td class="num mono '+(v>=0?'ingreso':'egreso')+'">'+fmtMonto(v)+'</td>'; }).join('')+
    '<td class="num mono '+(granTotalSinObra>=0?'ingreso':'egreso')+'">'+fmtMonto(granTotalSinObra)+'</td></tr>';

  var filaTotales = '<tr style="font-weight:600"><td>Total</td>'+
    meses.map(function(m){ var v=totalesPorMes[m]||0; return '<td class="num mono '+(v>=0?'ingreso':'egreso')+'">'+fmtMonto(v)+'</td>'; }).join('')+
    '<td class="num mono '+(granTotal>=0?'ingreso':'egreso')+'">'+fmtMonto(granTotal)+'</td></tr>';

  return '<div style="overflow-x:auto">'+
    '<table><thead><tr><th>Categoría</th>'+headerCols+'<th class="num">Total</th></tr></thead>'+
    '<tbody>'+rows+'</tbody>'+
    '<tfoot>'+filaTotalSinObra+filaTotales+'</tfoot>'+
    '</table></div>';
}

function renderResumen(){
  var f = STATE.resumenFiltros || {centro:[], categoria:[], mes:[], vista:'categoria'};

  var centroOptions = centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo}; });
  var categoriaOptions = categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; });
  var meses = getMeses();
  var mesOptions = meses.map(function(m){ return {value:m, label:mesLabelCorto(m)}; });

  var filtrados = STATE.movimientos.filter(function(m){
    if(f.centro.length && f.centro.indexOf(m.centroId)===-1) return false;
    if(f.categoria.length && f.categoria.indexOf(m.categoriaId)===-1) return false;
    if(f.mes.length && f.mes.indexOf((m.fecha||'').slice(0,7))===-1) return false;
    return true;
  });

  var movsCentro = STATE.movimientos.filter(function(m){ return !f.centro.length || f.centro.indexOf(m.centroId)!==-1; });

  var movsReales = filtrados.filter(function(m){ return !esTipoCategoria(m.categoriaId, 'tec'); });
  var movsObra = movsReales.filter(function(m){ return esCategoriaObra(m.categoriaId); });
  var movsSinObra = movsReales.filter(function(m){ return !esCategoriaObra(m.categoriaId); });

  var totalIngreso = movsSinObra.reduce(function(s,m){ return s + (Number(m.ingreso)||0); },0);
  var totalEgreso = movsSinObra.reduce(function(s,m){ return s + (Number(m.egreso)||0); },0);
  var totalObra = movsObra.reduce(function(s,m){ return s + (Number(m.egreso)||0) - (Number(m.ingreso)||0); },0);
  var saldo = totalIngreso - totalEgreso - totalObra;

  // Desglose por categoría o por centro de costo, según STATE.resumenFiltros.vista: total neto (ingresos - egresos). No incluye Sueldo (queda afuera de esta comparación, como Obra).
  var porGrupo = {};
  movsSinObra.filter(function(m){ return !esCategoriaSueldo(m.categoriaId); }).forEach(function(m){
    var key = f.vista === 'centro' ? (m.centroId||'') : (m.categoriaId||'');
    porGrupo[key] = (porGrupo[key]||0) + (Number(m.ingreso)||0) - (Number(m.egreso)||0);
  });
  var lista = Object.keys(porGrupo).map(function(k){
    var nombre = f.vista === 'centro' ? (k ? nombreCentro(k).split(' · ')[0] : 'Sin centro') : (k ? nombreCategoria(k) : 'Sin categoría');
    return { nombre: nombre, monto: porGrupo[k] };
  }).filter(function(x){return x.monto!==0;}).sort(function(a,b){ return Math.abs(b.monto)-Math.abs(a.monto); });
  var maxBar = lista.length ? Math.abs(lista[0].monto) : 1;

  var bars = lista.map(function(x){
    var pct = maxBar ? Math.round((Math.abs(x.monto)/maxBar)*100) : 0;
    var claseColor = x.monto >= 0 ? 'ingreso' : 'egreso';
    return '<div class="bar-row"><div class="name">'+esc(x.nombre)+'</div>'+
      '<div class="bar-track"><div class="bar-fill '+claseColor+'-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="amt '+claseColor+'">'+fmtMonto(x.monto)+'</div></div>';
  }).join('');
  var totalLista = lista.reduce(function(s,x){ return s+x.monto; },0);
  var claseColorTotalLista = totalLista >= 0 ? 'ingreso' : 'egreso';
  var totalListaHtml = lista.length ? ''+
    '<div class="bar-row" style="border-top:2px solid var(--accent);border-bottom:none;margin-top:4px;padding-top:10px;font-weight:600">'+
      '<div class="name">Total</div><div class="bar-track"></div>'+
      '<div class="amt '+claseColorTotalLista+'">'+fmtMonto(totalLista)+'</div>'+
    '</div>' : '';

  // Donut: top 8 + "Otros" (no incluye Obra, que ya tiene su propia tarjeta aparte). Usa el valor absoluto para el tamaño de cada porción (una torta no puede tener porciones negativas), pero muestra el monto real (con signo) en la leyenda.
  var segmentos = lista.slice(0,8).map(function(x,i){ return {label:x.nombre, value:Math.abs(x.monto), montoReal:x.monto, color:PALETA_DONUT[i%PALETA_DONUT.length]}; });
  var restoMonto = lista.slice(8).reduce(function(s,x){return s+x.monto;},0);
  if(restoMonto!==0) segmentos.push({label:'Otros', value:Math.abs(restoMonto), montoReal:restoMonto, color:'#E3ECE6'});
  var donutSvg = donutChart(segmentos, 160);
  var leyenda = segmentos.filter(function(s){return s.value>0;}).map(function(s){
    return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px">'+
      '<span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block;flex-shrink:0"></span>'+
      '<span style="flex:1">'+esc(s.label)+'</span><span class="mono '+(s.montoReal>=0?'ingreso':'egreso')+'">'+fmtMonto(s.montoReal)+'</span></div>';
  }).join('');

  // Tendencia mensual (Ingreso vs Egreso), respetando filtro de Centro/Categoría pero mostrando todos los meses disponibles
  var mesesTrend = meses.slice().sort();
  var dataPorMes = {};
  movsSinObra.concat(movsObra).forEach(function(m){
    var mes = (m.fecha||'').slice(0,7);
    if(!mes) return;
    if(!dataPorMes[mes]) dataPorMes[mes] = {ingreso:0, egreso:0};
    dataPorMes[mes].ingreso += Number(m.ingreso)||0;
    dataPorMes[mes].egreso += Number(m.egreso)||0;
  });
  var trendSvg = trendChart(mesesTrend, dataPorMes, 640, 220);

  return ''+
  '<div class="card card-filtros">'+
    '<h3>Filtros</h3>'+
    '<div class="filters">'+
      '<div class="field"><label>Centro de Costo</label>'+renderMultiSelect('rf-centro', centroOptions, f.centro)+'</div>'+
      '<div class="field"><label>Categoría</label>'+renderMultiSelect('rf-categoria', categoriaOptions, f.categoria)+'</div>'+
      '<div class="field"><label>Mes</label>'+renderMultiSelect('rf-mes', mesOptions, f.mes)+'</div>'+
      '<div class="field"><label>Desglose por</label><select id="rf-vista">'+
        '<option value="categoria" '+(f.vista==='categoria'?'selected':'')+'>Categoría</option>'+
        '<option value="centro" '+(f.vista==='centro'?'selected':'')+'>Centro de Costo</option>'+
      '</select></div>'+
    '</div>'+
  '</div>'+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Total ingresos</div><div class="value ingreso">'+fmtMonto(totalIngreso)+'</div></div>'+
    '<div class="summary-card"><div class="label">Total egresos</div><div class="value egreso">'+fmtMonto(totalEgreso)+'</div></div>'+
    '<div class="summary-card"><div class="label">Obra</div><div class="value egreso">'+fmtMonto(totalObra)+'</div></div>'+
    '<div class="summary-card"><div class="label">Saldo</div><div class="value">'+fmtMonto(saldo)+'</div></div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Tendencia mensual (Ingresos vs Egresos)</h3>'+
    trendSvg+
  '</div>'+
  '<div class="card">'+
    '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">'+
      '<div style="flex-shrink:0">'+donutSvg+'</div>'+
      '<div style="flex:1;min-width:180px">'+(leyenda||'<div class="empty">Sin datos para graficar.</div>')+'</div>'+
    '</div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Total por '+(f.vista==='centro'?'Centro de Costo':'Categoría')+'</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Ingresos menos egresos de cada '+(f.vista==='centro'?'centro':'categoría')+'. Verde = neto a favor (ingreso), coral = neto en contra (egreso). No incluye TEC (transferencias entre cuentas), Obra ni Sueldo (quedan afuera de esta comparación).</div>'+
    (lista.length ? bars+totalListaHtml : '<div class="empty">Todavía no hay movimientos cargados.</div>')+
  '</div>'+
  '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Comparativa mensual por categoría</h3>'+
      '<div class="field" style="min-width:160px"><select id="rf-grilla-rango">'+
        '<option value="todo" '+(STATE.grillaRango==='todo'?'selected':'')+'>Todo el histórico</option>'+
        '<option value="3m" '+(STATE.grillaRango==='3m'?'selected':'')+'>Últimos 3 meses</option>'+
        '<option value="6m" '+(STATE.grillaRango==='6m'?'selected':'')+'>Últimos 6 meses</option>'+
        '<option value="12m" '+(STATE.grillaRango==='12m'?'selected':'')+'>Últimos 12 meses</option>'+
        '<option value="prox1m" '+(STATE.grillaRango==='prox1m'?'selected':'')+'>Próximo mes</option>'+
        '<option value="prox3m" '+(STATE.grillaRango==='prox3m'?'selected':'')+'>Próximos 3 meses</option>'+
        '<option value="prox6m" '+(STATE.grillaRango==='prox6m'?'selected':'')+'>Próximos 6 meses</option>'+
        '<option value="trimestre" '+(STATE.grillaRango==='trimestre'?'selected':'')+'>Este trimestre</option>'+
        '<option value="semestre" '+(STATE.grillaRango==='semestre'?'selected':'')+'>Este semestre</option>'+
        '<option value="anio" '+(STATE.grillaRango==='anio'?'selected':'')+'>Este año</option>'+
      '</select></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Ingresos menos egresos por categoría, mes a mes'+(f.centro.length?' (Centro de Costo: '+f.centro.map(function(cid){ return esc(nombreCentro(cid).split(' · ')[0]); }).join(', ')+')':'')+'. Verde = neto a favor, coral = neto en contra. No incluye TEC ni Sueldo. "Total (sin Obra)" excluye la categoría Obra del total; "Total" la incluye. Ignora el filtro de Mes/Categoría de arriba (usa el selector de rango de acá al lado).</div>'+
    renderGrillaMensual(movsCentro, STATE.grillaRango)+
  '</div>';
}

// ===================== GIMNASIO (BONUS TRACK: ANA VS FRANCO) =====================
var GYM_COLOR = { ana:'#D6336C', franco:'#2563EB' };
var GYM_META_SEMANAL = 2;
var GYM_TOPE_WOW = 3;
var GYM_FRASES = [
  'El sillón no cuenta como aparato de gimnasio, aunque tenga resortes. 🛋️',
  'Recordá: Rocky no se hizo grande mirando la tele. 🥊',
  '2 veces por semana no es una sugerencia, es un mandato del hogar. 📜',
  'El "mañana arranco" ya cumplió años en este matrimonio. 🎂',
  '¿Fuiste al gimnasio y no lo cargaste? Para las estadísticas, no fuiste. 📉',
  'Un movimiento por semana, un peso menos... de excusa. 🏋️',
  'Hoy no hay plan C. El plan es: gimnasio. ✅',
  'Ojo: el que se relaja pierde el trono. 👑',
  'Las pesas no se levantan solas, pero las excusas sí vuelan solas. 🪶',
  '3 veces por semana = leyenda. 2 = prolijo/a. 1 = "lo voy a pensar". 🤔',
  'El streak no se rompe ni por lluvia, ni por partido un domingo. ☔',
  'Cargá el punto y sentí el poder. Es gratis y es tuyo. ⚡',
  'En esta casa, el sofá se enfría un poco más si vas al gimnasio. ❄️',
  'Perder esta semana no tiene revancha hasta la semana que viene. Aguantá. ⏳',
  'El que no carga la visita, no la hizo. Así de simple. 🧾',
  'Ir al gimnasio: la única discusión de pareja que termina en abdominales. 😏'
];
function fraseGimnasioDelDia(){
  var hoy = fechaHoyISO();
  var hash = 0;
  for(var i=0;i<hoy.length;i++) hash = (hash*31 + hoy.charCodeAt(i)) >>> 0;
  return GYM_FRASES[hash % GYM_FRASES.length];
}
function fraseGimnasioEstadoSemana(s){
  var a = s.ana, f = s.franco;
  if(a===0 && f===0) return 'Esta semana el gimnasio los extraña a los dos. Alguien tiene que romper el hielo. 🕸️';
  if(a>=GYM_TOPE_WOW && f>=GYM_TOPE_WOW) return '¡Wow total! Los dos ya se ganaron el asado sin culpa esta semana. 🔥';
  if(a>=GYM_TOPE_WOW && a>f) return 'Ana ya está en modo WOW ('+a+'). Franco, la bici fija te mira con desprecio. 🚴';
  if(f>=GYM_TOPE_WOW && f>a) return 'Franco ya está en modo WOW ('+f+'). Ana, las zapatillas están juntando polvo. 👟';
  if(a>f) return 'Ana va ganando esta semana '+a+' a '+f+'. Franco, se te escapa el trofeo. 🏆';
  if(f>a) return 'Franco va ganando esta semana '+f+' a '+a+'. Ana, no dejes que se agrande. 💪';
  if(a===f && a>0) return 'Empatados '+a+' a '+a+'. Esto se define en el próximo entrenamiento. ⚖️';
  return '¡Arranquen la semana! El que va dos veces gana, el que va tres es leyenda.';
}
function gimnasioLunesDeSemana(iso){
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1]-1, p[2]);
  var dow = d.getDay();
  d.setDate(d.getDate() + (dow===0 ? -6 : 1-dow));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function gimnasioDomingoDeSemana(lunesIso){
  var p = lunesIso.split('-').map(Number);
  var d = new Date(p[0], p[1]-1, p[2]);
  d.setDate(d.getDate()+6);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function gimnasioRangoSemanaLabel(lunesIso){
  return fechaISOaDDMMAAAA(lunesIso).slice(0,5)+' al '+fechaISOaDDMMAAAA(gimnasioDomingoDeSemana(lunesIso)).slice(0,5);
}
function gimnasioStatsPorSemana(){
  var mapa = {};
  STATE.gimnasioVisitas.forEach(function(v){
    if(v.persona!=='ana' && v.persona!=='franco') return;
    var lunes = gimnasioLunesDeSemana(v.fecha);
    if(!mapa[lunes]) mapa[lunes] = {ana:0, franco:0};
    mapa[lunes][v.persona]++;
  });
  var lunesActual = gimnasioLunesDeSemana(fechaHoyISO());
  if(!mapa[lunesActual]) mapa[lunesActual] = {ana:0, franco:0};
  return Object.keys(mapa).sort().reverse().map(function(lunes){
    var s = mapa[lunes];
    var ganador = s.ana>s.franco ? 'ana' : (s.franco>s.ana ? 'franco' : (s.ana>0 ? 'empate' : null));
    return {lunes:lunes, ana:s.ana, franco:s.franco, ganador:ganador};
  });
}
function gimnasioBarraPersona(persona, puntos){
  var color = GYM_COLOR[persona];
  var pct = Math.min(100, Math.round((puntos/GYM_TOPE_WOW)*100));
  var badge = puntos>=GYM_TOPE_WOW ? '<div style="font-size:11px;color:'+color+';font-weight:600;margin:2px 0 8px 190px">🌟 ¡WOW, se pasó de la meta!</div>'
    : (puntos>=GYM_META_SEMANAL ? '<div style="font-size:11px;color:var(--ink-soft);margin:2px 0 8px 190px">✅ meta cumplida</div>' : '<div style="margin-bottom:8px"></div>');
  return '<div class="bar-row">'+
      '<div class="name" style="color:'+color+';font-weight:600">'+nombrePersona(persona)+'</div>'+
      '<div class="bar-track"><div class="bar-fill" style="background:'+color+';width:'+pct+'%"></div></div>'+
      '<div class="amt">'+puntos+' pto'+(puntos===1?'':'s')+'</div>'+
    '</div>'+badge;
}
function gimnasioBotonMarcar(persona, yaMarcoHoy){
  if(!persona) return '<div style="font-size:12px;color:var(--ink-soft);margin-top:6px">Iniciá sesión con tu usuario para poder cargar tu visita de hoy.</div>';
  if(yaMarcoHoy) return '<button disabled style="margin-top:6px;width:100%">✅ Ya fichaste hoy, '+nombrePersona(persona)+'. ¡Grande!</button>';
  return '<button data-action="gym-marcar-visita" style="margin-top:6px;width:100%;font-size:15px;padding:12px">💪 Marcar mi visita de hoy ('+nombrePersona(persona)+')</button>';
}
function gimnasioSummaryCard(persona, semanasGanadas, vaGanando){
  var color = GYM_COLOR[persona];
  return '<div class="summary-card" style="border-color:'+(vaGanando?color:'var(--rule)')+'">'+
    '<div class="label" style="color:'+color+'">'+nombrePersona(persona)+(vaGanando?' 👑':'')+'</div>'+
    '<div class="value">'+semanasGanadas+' semana'+(semanasGanadas===1?'':'s')+'</div>'+
  '</div>';
}
function gimnasioTablaHistorial(semanas){
  if(!semanas.length) return '<div class="empty">Todavía no hay semanas registradas.</div>';
  var filas = semanas.map(function(s){
    var ganadorLabel = s.ganador==='ana' ? '🏆 Ana' : (s.ganador==='franco' ? '🏆 Franco' : (s.ganador==='empate' ? '🤝 Empate' : '—'));
    return '<tr>'+
      '<td data-label="Semana">'+gimnasioRangoSemanaLabel(s.lunes)+'</td>'+
      '<td class="num" data-label="Ana">'+s.ana+'</td>'+
      '<td class="num" data-label="Franco">'+s.franco+'</td>'+
      '<td data-label="Ganador">'+ganadorLabel+'</td>'+
    '</tr>';
  }).join('');
  return '<table class="tabla-movil"><thead><tr><th>Semana</th><th class="num">Ana</th><th class="num">Franco</th><th>Ganador</th></tr></thead><tbody>'+filas+'</tbody></table>';
}
function gimnasioListaUltimasVisitas(){
  var lista = STATE.gimnasioVisitas.slice().sort(function(a,b){ return b.fecha.localeCompare(a.fecha); }).slice(0,10);
  if(!lista.length) return '<div class="empty">Todavía no cargaron ninguna visita. ¡Arranquen! 🚀</div>';
  return lista.map(function(v){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--rule)">'+
      '<span><strong style="color:'+GYM_COLOR[v.persona]+'">'+nombrePersona(v.persona)+'</strong> — '+fechaISOaDDMMAAAA(v.fecha)+'</span>'+
      '<button class="icon-btn icon-btn-danger" data-action="gym-borrar-visita" data-id="'+v.id+'" title="Borrar (fue un error)">🗑️</button>'+
    '</div>';
  }).join('');
}
function renderGimnasio(){
  var persona = personaPorUsuario();
  var hoy = fechaHoyISO();
  var lunesActual = gimnasioLunesDeSemana(hoy);
  var semanas = gimnasioStatsPorSemana();
  var semanaActual = semanas.filter(function(s){ return s.lunes===lunesActual; })[0] || {lunes:lunesActual, ana:0, franco:0};
  var yaMarcoHoy = !!(persona && STATE.gimnasioVisitas.some(function(v){ return v.persona===persona && v.fecha===hoy; }));
  var semanasGanadasAna = semanas.filter(function(s){ return s.ganador==='ana'; }).length;
  var semanasGanadasFranco = semanas.filter(function(s){ return s.ganador==='franco'; }).length;

  var html = '';
  if(STATE.gimnasioMsg){ html += '<div class="msg err">'+esc(STATE.gimnasioMsg)+'</div>'; }

  html += '<div class="card" style="background:linear-gradient(135deg, var(--accent-soft), #fff)">'+
    '<h2 style="font-size:19px">🏋️ Bonus Track: Ana vs Franco</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Cada visita al gimnasio suma un punto. Meta: '+GYM_META_SEMANAL+' por semana. '+GYM_TOPE_WOW+' es WOW. El que más suma en la semana, se la lleva — y algo de orgullo.</div>'+
  '</div>';

  html += '<div class="card" style="text-align:center;font-weight:600;color:var(--accent)">'+esc(fraseGimnasioDelDia())+'</div>';

  html += '<div class="card">'+
    '<h3>Semana actual ('+gimnasioRangoSemanaLabel(lunesActual)+')</h3>'+
    '<div style="font-size:13px;margin-bottom:14px">'+esc(fraseGimnasioEstadoSemana(semanaActual))+'</div>'+
    gimnasioBarraPersona('ana', semanaActual.ana)+
    gimnasioBarraPersona('franco', semanaActual.franco)+
    gimnasioBotonMarcar(persona, yaMarcoHoy)+
  '</div>';

  html += '<div class="card">'+
    '<h3>Marcador general (semanas ganadas)</h3>'+
    '<div class="summary-cards">'+
      gimnasioSummaryCard('ana', semanasGanadasAna, semanasGanadasAna>semanasGanadasFranco)+
      gimnasioSummaryCard('franco', semanasGanadasFranco, semanasGanadasFranco>semanasGanadasAna)+
    '</div>'+
  '</div>';

  html += '<div class="card"><h3>Historial semanal</h3>'+gimnasioTablaHistorial(semanas)+'</div>';

  html += '<div class="card"><h3>Últimas visitas (por si te equivocaste)</h3>'+gimnasioListaUltimasVisitas()+'</div>';

  return html;
}

// ===================== EVENTOS =====================
function bindEvents(){
  document.querySelectorAll('[data-modal-backdrop]').forEach(function(overlay){
    overlay.addEventListener('click', function(ev){
      if(ev.target !== overlay) return; // sólo si el click fue directo en el fondo, no en el contenido del modal
      var tipo = overlay.getAttribute('data-modal-backdrop');
      var accion = tipo==='confirm' ? 'confirm-no' : (tipo==='subdelete' ? 'sub-delete-cancel' : (tipo==='efectivo' ? 'cerrar-efectivo' : 'cancel-edit'));
      handleAction(accion);
    });
  });

  // El evento "toggle" de <details> no burbujea: hay que escucharlo en cada uno para recordar
  // qué resúmenes de tarjeta quedaron abiertos y que no se cierren solos en el próximo render().
  document.querySelectorAll('details.resumen-tarjeta[data-grupo-key]').forEach(function(det){
    det.addEventListener('toggle', function(){
      STATE.gruposAbiertos[det.getAttribute('data-grupo-key')] = det.open;
    });
  });

  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){ STATE.activeTab = t.getAttribute('data-tab'); STATE.editing = null; STATE.movDraft = null; STATE.nuevoMovAbierto = false; STATE.menuMovilAbierto = false; STATE.multiSelectAbierto = null; STATE.bulkEditMovAbierto = false; STATE.movSeleccionados = []; render(); });
  });

  document.querySelectorAll('.subtab').forEach(function(t){
    t.addEventListener('click', function(){ STATE.abmSubTab = t.getAttribute('data-subtab'); STATE.editing = null; render(); });
  });

  // Restaurar select de categoría en edición de subcategoría
  if(STATE.activeTab==='abm' && STATE.abmSubTab==='subcategorias' && STATE.editing && STATE.editing.type==='subcategoria'){
    var s = STATE.subcategorias.find(function(x){return x.id===STATE.editing.id;});
    var sel = document.getElementById('f-sub-categoria');
    if(s && sel) sel.value = s.categoriaId;
  }

  // Filtros de movimientos (Centro/Categoría/Subcategoría/Mes son multiselect, ver checkboxes más abajo)
  var ffTexto = document.getElementById('ff-texto');
  if(ffTexto){ ffTexto.addEventListener('input', function(){ STATE.filtros.texto = ffTexto.value; STATE.movPaginaActual = 1; render(); }); }
  var ffSoloIncompletos = document.getElementById('ff-solo-incompletos');
  if(ffSoloIncompletos){
    ffSoloIncompletos.addEventListener('change', function(){
      STATE.filtros.soloIncompletos = ffSoloIncompletos.checked;
      STATE.movPaginaActual = 1;
      if(ffSoloIncompletos.checked){
        STATE.incompletosSnapshotIds = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).map(function(m){ return m.id; });
      } else {
        STATE.incompletosSnapshotIds = null;
      }
      render();
    });
  }
  var ffSoloTarjeta = document.getElementById('ff-solo-tarjeta');
  if(ffSoloTarjeta){ ffSoloTarjeta.addEventListener('change', function(){ STATE.filtros.soloTarjeta = ffSoloTarjeta.checked; STATE.movPaginaActual = 1; render(); }); }

  // Filtros del Resumen (Centro/Categoría/Mes son multiselect, ver checkboxes más abajo)
  var rfVista = document.getElementById('rf-vista');
  if(rfVista){ rfVista.addEventListener('change', function(){ STATE.resumenFiltros.vista = rfVista.value; render(); }); }

  // Checkboxes de los filtros multiselect (Centro/Categoría/Subcategoría/Mes en Movimientos y Resumen)
  document.querySelectorAll('[data-multiselect]').forEach(function(cb){
    cb.addEventListener('change', function(){
      toggleMultiSelectValor(cb.getAttribute('data-multiselect'), cb.value, cb.checked);
      render();
    });
  });

  // Buscador dentro del panel del filtro multiselect abierto
  if(STATE.multiSelectAbierto){
    var msBuscar = document.getElementById('ms-buscar-'+STATE.multiSelectAbierto);
    if(msBuscar){
      msBuscar.addEventListener('input', function(){
        STATE.multiSelectBusqueda = msBuscar.value;
        render();
      });
    }
  }

  var rfGrillaRango = document.getElementById('rf-grilla-rango');
  if(rfGrillaRango){
    rfGrillaRango.addEventListener('change', function(){
      STATE.grillaRango = rfGrillaRango.value;
      render();
    });
  }

  // Combobox del formulario de Movimiento (Centro/Categoría/Subcategoría/Centro Destino):
  // tipear filtra la lista; Enter o Tab confirman la opción resaltada (la primera por defecto).
  document.querySelectorAll('.combo-input').forEach(function(inp){
    var comboId = inp.getAttribute('data-combo-id');
    inp.addEventListener('focus', function(){
      // Ignorar el focus "sintético" que dispara el propio render() al restaurar el foco después
      // de reemplazar el DOM (ver comentario en RENDER_EN_CURSO) — si no, pisa STATE.comboBusqueda
      // justo después de haberlo tipeado, aunque ya no cause una recursión infinita.
      if(RENDER_EN_CURSO) return;
      if(STATE.comboAbierto !== comboId){
        // getMovFormValues() ANTES de tocar nada: Fecha/Proveedor/Detalle/Monto no tienen listener
        // propio, así que sin este snapshot el render de abajo los dejaría en blanco (ver aplicarSeleccionCombo).
        STATE.movDraft = getMovFormValues();
        STATE.comboAbierto = comboId; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
        render();
      }
    });
    inp.addEventListener('input', function(){
      var draft = getMovFormValues();
      STATE.movDraft = draft;
      STATE.comboAbierto = comboId; STATE.comboBusqueda = inp.value; STATE.comboHighlight = 0;
      render();
    });
    inp.addEventListener('keydown', function(ev){
      if(STATE.comboAbierto !== comboId) return;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); moverResaltadoCombo(comboId, 1); }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); moverResaltadoCombo(comboId, -1); }
      else if(ev.key==='Enter'){ ev.preventDefault(); finalizarCombo(comboId, true); }
      else if(ev.key==='Escape'){ STATE.movDraft = getMovFormValues(); STATE.comboAbierto = null; STATE.comboBusqueda = ''; render(); }
      else if(ev.key==='Tab'){
        // Tomamos el control manualmente: el re-render que dispara finalizarCombo reemplaza todo
        // el DOM, y si dejáramos que el navegador mueva el foco de forma nativa en el mismo tick,
        // el elemento al que iba a enfocar puede quedar reemplazado y el foco termina perdiéndose.
        // Por eso: prevenimos el Tab, resolvemos "cuál es el siguiente campo" ANTES de re-renderizar,
        // confirmamos la selección, y enfocamos ese id nosotros mismos ya con el DOM nuevo.
        ev.preventDefault();
        var siguienteId = idSiguienteFocuseable(inp);
        Promise.resolve(finalizarCombo(comboId, false)).then(function(){
          if(siguienteId){
            var el = document.getElementById(siguienteId);
            if(el) el.focus();
          }
        });
      }
    });
    inp.addEventListener('blur', function(){
      // Idem el focus de arriba: el propio reemplazo del DOM dispara un blur sintético sobre el
      // nodo que tenía el foco justo antes de removerlo — ignorarlo para no confirmar (o perder)
      // la selección por un efecto colateral del render, no por una acción real del usuario.
      if(RENDER_EN_CURSO) return;
      // Diferido al próximo tick: si el blur es porque el usuario clickeó otro botón (p. ej.
      // "Cancelar"), reemplazar el DOM ahora mismo (de forma síncrona, dentro del mismo mousedown)
      // haría que ese click se pierda porque el botón que iba a recibirlo ya no sería el mismo nodo.
      // Esperar un tick deja que el click termine de procesarse sobre el DOM actual antes de redibujar.
      setTimeout(function(){ finalizarCombo(comboId, false); }, 0);
    });
  });
  document.querySelectorAll('.combo-item').forEach(function(item){
    // preventDefault en mousedown evita que el input pierda el foco antes de que llegue el click
    item.addEventListener('mousedown', function(ev){ ev.preventDefault(); });
    item.addEventListener('click', function(){
      var comboId = item.closest('[data-combo-wrap]').getAttribute('data-combo-wrap');
      aplicarSeleccionCombo(comboId, item.getAttribute('data-value'));
      STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
      render();
    });
  });


  // Refrescar subcategorías disponibles al cambiar la categoría en el modal de Efectivo
  var efCategoriaSel = document.getElementById('ef-categoria');
  if(efCategoriaSel){
    efCategoriaSel.addEventListener('change', function(){
      STATE.efectivoCategoriaId = efCategoriaSel.value;
      render();
    });
  }

  // Mostrar/ocultar los campos de cuotas al tildar "Pagado con tarjeta de crédito",
  // y refrescar la ayuda ("se van a crear N movimientos...") al cambiar la cantidad de cuotas.
  var movTarjetaChk = document.getElementById('f-mov-tarjeta');
  if(movTarjetaChk){
    movTarjetaChk.addEventListener('change', function(){
      var draft = getMovFormValues();
      draft.tarjeta = movTarjetaChk.checked;
      STATE.movDraft = draft;
      render();
    });
  }
  var movCuotasInput = document.getElementById('f-mov-cuotas');
  if(movCuotasInput){
    movCuotasInput.addEventListener('input', function(){
      var draft = getMovFormValues();
      draft.cuotas = movCuotasInput.value;
      STATE.movDraft = draft;
      render();
    });
  }

  // Formulario de Importar
  var impEntidad = document.getElementById('imp-entidad');
  if(impEntidad){ impEntidad.addEventListener('change', function(){ STATE.importEntidad = impEntidad.value; STATE.importPreview = null; STATE.importPreviewExcel = null; STATE.importMsg = null; render(); }); }
  var impAnio = document.getElementById('imp-anio');
  if(impAnio){ impAnio.addEventListener('input', function(){ STATE.importAnio = impAnio.value; }); }
  var impBanco = document.getElementById('imp-banco');
  if(impBanco){ impBanco.addEventListener('change', function(){ STATE.importBanco = impBanco.value; }); }
  var impVenc = document.getElementById('imp-vencimiento');
  if(impVenc){ impVenc.addEventListener('input', function(){ STATE.importVencimiento = impVenc.value; }); }
  var impTarjetaMarca = document.getElementById('imp-tarjeta-marca');
  if(impTarjetaMarca){ impTarjetaMarca.addEventListener('input', function(){ STATE.importTarjetaMarca = impTarjetaMarca.value; }); }
  var impRaw = document.getElementById('imp-raw');
  if(impRaw){ impRaw.addEventListener('input', function(){ STATE.importRaw = impRaw.value; }); }

  var previewTable = document.getElementById('import-preview-table');
  if(previewTable){
    previewTable.addEventListener('change', function(ev){
      var t = ev.target;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreview.find(function(r){return r.id===rowId;});
      if(!row) return;
      if(field==='incluir' || field==='guardarRegla') row[field] = t.checked;
      else if(field==='categoriaId'){ row.categoriaId = t.value; row.subcategoriaId=''; }
      else row[field] = t.value;
      render();
    });
    previewTable.addEventListener('input', function(ev){
      var t = ev.target;
      if(t.tagName !== 'INPUT' || t.type !== 'text') return;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreview.find(function(r){return r.id===rowId;});
      if(!row) return;
      row[field] = t.value;
      render();
    });
  }

  var tablaMovimientos = document.getElementById('tabla-movimientos');
  if(tablaMovimientos){
    tablaMovimientos.addEventListener('change', async function(ev){
      var t = ev.target;
      if(t.classList.contains('chk-select-mov')){
        var midSel = t.getAttribute('data-mov-id');
        var sel = STATE.movSeleccionados || (STATE.movSeleccionados = []);
        var iSel = sel.indexOf(midSel);
        if(t.checked && iSel===-1) sel.push(midSel);
        else if(!t.checked && iSel!==-1) sel.splice(iSel,1);
        render(); return;
      }
      if(t.id==='chk-select-all-mov'){
        var idsVisibles = Array.prototype.map.call(tablaMovimientos.querySelectorAll('.chk-select-mov'), function(c){ return c.getAttribute('data-mov-id'); });
        if(t.checked){
          idsVisibles.forEach(function(mid){ if(STATE.movSeleccionados.indexOf(mid)===-1) STATE.movSeleccionados.push(mid); });
        } else {
          STATE.movSeleccionados = STATE.movSeleccionados.filter(function(mid){ return idsVisibles.indexOf(mid)===-1; });
        }
        render(); return;
      }
      var movId = t.getAttribute('data-mov-id');
      var campo = t.getAttribute('data-field');
      if(!movId || !campo) return;
      var mov = STATE.movimientos.find(function(m){ return m.id===movId; });
      if(!mov) return;
      var valor = t.value;
      var camposDb = {};
      if(campo==='categoriaId'){
        mov.categoriaId = valor; mov.subcategoriaId = '';
        camposDb = { categoria_id: valor||null, subcategoria_id: null };
      } else if(campo==='centroId'){
        mov.centroId = valor;
        camposDb = { centro_id: valor||null };
      } else if(campo==='subcategoriaId'){
        mov.subcategoriaId = valor;
        camposDb = { subcategoria_id: valor||null };
      } else if(campo==='proveedor' || campo==='detalle'){
        mov[campo] = valor;
        camposDb[campo] = valor||null;
      } else { return; }
      try{
        await dbUpdate('movimientos', movId, camposDb);
      }catch(e){ STATE.dbError = 'No se pudo guardar el cambio: '+(e.message||e); }
      render();
    });

    // Clic sobre Fecha/Centro/Categoría/Subcategoría/Proveedor -> filtra la tabla por ese valor
    tablaMovimientos.addEventListener('click', function(ev){
      var celda = ev.target.closest('[data-filter-field]');
      if(!celda) return;
      var campoFiltro = celda.getAttribute('data-filter-field');
      var valorFiltro = celda.getAttribute('data-filter-value');
      if(!valorFiltro) return;
      if(campoFiltro === 'texto') STATE.filtros.texto = valorFiltro;
      else STATE.filtros[campoFiltro] = [valorFiltro];
      STATE.movPaginaActual = 1;
      render();
    });
  }

  var previewExcelTable = document.getElementById('import-preview-excel-table');
  if(previewExcelTable){
    previewExcelTable.addEventListener('change', function(ev){
      var t = ev.target;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreviewExcel.find(function(r){return r.id===rowId;});
      if(!row) return;
      if(field==='incluir') row.incluir = t.checked;
      render();
    });
  }

  document.querySelectorAll('[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){ handleAction(btn.getAttribute('data-action'), btn.getAttribute('data-id')); });
  });
}

function getMovFormValues(){
  return {
    fecha: (document.getElementById('f-mov-fecha')||{}).value || '',
    centroId: (document.getElementById('f-mov-centro')||{}).value || '',
    categoriaId: (document.getElementById('f-mov-categoria')||{}).value || '',
    subcategoriaId: (document.getElementById('f-mov-subcategoria')||{}).value || '',
    proveedor: (document.getElementById('f-mov-proveedor')||{}).value || '',
    detalle: (document.getElementById('f-mov-detalle')||{}).value || '',
    tipo: (document.getElementById('f-mov-tipo')||{}).value || 'egreso',
    monto: (document.getElementById('f-mov-monto')||{}).value || '',
    tarjeta: (document.getElementById('f-mov-tarjeta')||{}).checked || false,
    fechaConsumo: (document.getElementById('f-mov-fecha-consumo')||{}).value || '',
    tarjetaMarca: (document.getElementById('f-mov-tarjeta-marca')||{}).value || '',
    cuotas: (document.getElementById('f-mov-cuotas')||{}).value || 1
  };
}

async function handleAction(action, id){
  STATE.movDraft = null;

  if(action==='mov-pagina-anterior'){ STATE.movPaginaActual = Math.max(1, STATE.movPaginaActual-1); render(); return; }
  if(action==='mov-pagina-siguiente'){ STATE.movPaginaActual = STATE.movPaginaActual+1; render(); return; }
  if(action==='cancel-edit'){
    STATE.editing = null; STATE.nuevoMovAbierto = false; STATE.movDraftCentroDestinoId = '';
    STATE.comboAbierto = null; STATE.comboBusqueda = '';
    STATE.bulkEditMovAbierto = false; STATE.bulkEditMovMsg = null;
    render(); return;
  }
  if(action==='abrir-nuevo-mov'){
    STATE.nuevoMovAbierto = true; STATE.movFormMsg = null; STATE.movDraftCentroDestinoId = '';
    STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.menuMovilAbierto = false;
    STATE.bulkEditMovAbierto = false;
    render(); return;
  }
  if(action==='deseleccionar-mov'){ STATE.movSeleccionados = []; render(); return; }
  if(action==='abrir-bulk-edit-mov'){
    if(!STATE.movSeleccionados || !STATE.movSeleccionados.length) return;
    STATE.editing = null; STATE.nuevoMovAbierto = false;
    STATE.bulkEditMovAbierto = true; STATE.bulkEditMovMsg = null;
    render(); return;
  }
  if(action==='guardar-bulk-edit-mov'){
    var idsSel = (STATE.movSeleccionados||[]).slice();
    if(!idsSel.length){ STATE.bulkEditMovAbierto = false; render(); return; }
    var valBem = function(elId){ return (document.getElementById(elId)||{}).value || ''; };
    var fechaV = valBem('bem-fecha');
    var centroV = valBem('bem-centro');
    var categoriaV = valBem('bem-categoria');
    var subcategoriaV = valBem('bem-subcategoria');
    var proveedorV = valBem('bem-proveedor');
    var proveedorVaciar = !!(document.getElementById('bem-proveedor-vaciar')||{}).checked;
    var detalleV = valBem('bem-detalle');
    var detalleVaciar = !!(document.getElementById('bem-detalle-vaciar')||{}).checked;
    var tipoV = valBem('bem-tipo');
    var montoV = valBem('bem-monto');
    var tarjetaV = valBem('bem-tarjeta');

    var tocaFecha = !!fechaV;
    var tocaCentro = !!centroV;
    var tocaCategoria = !!categoriaV;
    var tocaSubcategoria = !!subcategoriaV;
    var tocaProveedor = proveedorVaciar || !!proveedorV;
    var tocaDetalle = detalleVaciar || !!detalleV;
    var tocaTipo = !!tipoV;
    var tocaMonto = montoV !== '';
    var tocaTarjeta = !!tarjetaV;

    if(!tocaFecha && !tocaCentro && !tocaCategoria && !tocaSubcategoria && !tocaProveedor && !tocaDetalle && !tocaTipo && !tocaMonto && !tocaTarjeta){
      STATE.bulkEditMovMsg = { type:'err', text:'Elegí al menos un campo para modificar.' };
      render(); return;
    }

    var montoNum = tocaMonto ? (Math.abs(parseFloat(montoV))||0) : 0;
    try{
      for(var bi=0; bi<idsSel.length; bi++){
        var mov = STATE.movimientos.find(function(m){ return m.id===idsSel[bi]; });
        if(!mov) continue;
        var camposDb = {};
        if(tocaFecha){ mov.fecha = fechaV; camposDb.fecha = fechaV; }
        if(tocaCentro){ mov.centroId = centroV==='__vaciar__' ? '' : centroV; camposDb.centro_id = mov.centroId||null; }
        if(tocaCategoria){
          mov.categoriaId = categoriaV==='__vaciar__' ? '' : categoriaV;
          camposDb.categoria_id = mov.categoriaId||null;
          if(!tocaSubcategoria){ mov.subcategoriaId = ''; camposDb.subcategoria_id = null; }
        }
        if(tocaSubcategoria){ mov.subcategoriaId = subcategoriaV==='__vaciar__' ? '' : subcategoriaV; camposDb.subcategoria_id = mov.subcategoriaId||null; }
        if(tocaProveedor){ mov.proveedor = proveedorVaciar ? '' : proveedorV; camposDb.proveedor = mov.proveedor||null; }
        if(tocaDetalle){ mov.detalle = detalleVaciar ? '' : detalleV; camposDb.detalle = mov.detalle||null; }
        if(tocaTipo || tocaMonto){
          var tipoActual = Number(mov.ingreso)>0 ? 'ingreso' : 'egreso';
          var tipoFinal = tocaTipo ? tipoV : tipoActual;
          var montoActual = tipoActual==='ingreso' ? Number(mov.ingreso)||0 : Number(mov.egreso)||0;
          var montoFinal = tocaMonto ? montoNum : montoActual;
          mov.ingreso = tipoFinal==='ingreso' ? montoFinal : 0;
          mov.egreso = tipoFinal==='egreso' ? montoFinal : 0;
          camposDb.ingreso = mov.ingreso; camposDb.egreso = mov.egreso;
        }
        if(tocaTarjeta){ mov.tarjeta = tarjetaV==='si'; camposDb.tarjeta = mov.tarjeta; }
        await dbUpdate('movimientos', mov.id, camposDb);
      }
      STATE.saldosDirty = true;
      STATE.bulkEditMovAbierto = false;
      STATE.bulkEditMovMsg = null;
      STATE.movSeleccionados = [];
    }catch(e){ STATE.dbError = 'No se pudo aplicar la edición masiva: '+(e.message||e); }
    render(); return;
  }

  if(action==='confirm-yes'){
    var pending = STATE.confirmState; STATE.confirmState = null;
    if(pending) await handleAction(pending.action, pending.id);
    return;
  }
  if(action==='confirm-no'){ STATE.confirmState = null; STATE.backupPendiente = null; render(); return; }

  // ---- CENTROS ----
  if(action==='edit-centro'){ STATE.editing = {type:'centro', id:id}; render(); return; }
  if(action==='del-centro'){
    STATE.confirmState = { message:'¿Borrar este centro de costo?', action:'del-centro-do', id:id };
    render(); return;
  }
  if(action==='del-centro-do'){
    try{
      await dbDelete('centros', id);
      STATE.centros = STATE.centros.filter(function(c){return c.id!==id;});
      STATE.saldosDirty = true;
    }catch(e){ STATE.dbError = 'No se pudo borrar el centro de costo: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-centro'){
    var codigo = document.getElementById('f-centro-codigo').value.trim().toUpperCase();
    var nombre = document.getElementById('f-centro-nombre').value.trim();
    var colorCentroInput = document.getElementById('f-centro-color').value;
    if(!codigo || !nombre) return;
    STATE.dbError = null;
    try{
      if(id){
        await dbUpdate('centros', id, {codigo:codigo, nombre:nombre, color:colorCentroInput});
        var c = STATE.centros.find(function(x){return x.id===id;});
        c.codigo = codigo; c.nombre = nombre; c.color = colorCentroInput;
      } else {
        var nuevoC = {id:uid(), codigo:codigo, nombre:nombre, color:colorCentroInput};
        await dbInsert('centros', toDbCentro(nuevoC));
        STATE.centros.push(nuevoC);
      }
      STATE.saldosDirty = true;
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar el centro de costo: '+(e.message||e); }
    render(); return;
  }

  // ---- CATEGORÍAS ----
  if(action==='edit-categoria'){ STATE.editing = {type:'categoria', id:id}; render(); return; }
  if(action==='del-categoria'){
    STATE.confirmState = { message:'¿Borrar esta categoría? También se borrarán sus subcategorías.', action:'del-categoria-do', id:id };
    render(); return;
  }
  if(action==='del-categoria-do'){
    try{
      await dbDelete('categorias', id); // ON DELETE CASCADE en la base borra las subcategorías asociadas
      STATE.categorias = STATE.categorias.filter(function(c){return c.id!==id;});
      STATE.subcategorias = STATE.subcategorias.filter(function(s){return s.categoriaId!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar la categoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-categoria'){
    var nombre = document.getElementById('f-categoria-nombre').value.trim();
    var tipo = document.getElementById('f-categoria-es-tec').checked ? 'tec' : '';
    var colorCategoriaInput = document.getElementById('f-categoria-color').value;
    if(!nombre) return;
    STATE.dbError = null;
    try{
      if(id){
        await dbUpdate('categorias', id, {nombre:nombre, tipo:tipo||null, color:colorCategoriaInput});
        var c = STATE.categorias.find(function(x){return x.id===id;});
        c.nombre = nombre; c.tipo = tipo; c.color = colorCategoriaInput;
      } else {
        var nuevaC = {id:uid(), nombre:nombre, tipo:tipo, color:colorCategoriaInput};
        await dbInsert('categorias', toDbCategoria(nuevaC));
        STATE.categorias.push(nuevaC);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar la categoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='bulk-add-categorias'){
    var raw = document.getElementById('bulk-categorias').value;
    var lineas = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
    var agregadas = 0, actualizadas = 0, sinCambios = 0;
    var paraUpsert = [];
    lineas.forEach(function(linea){
      var partes = linea.split('\t');
      if(partes.length < 2) partes = linea.split(/\s{2,}/);
      var col0 = (partes[0]||'').trim();
      var col1 = (partes[1]||'').trim();

      // fila de encabezado: "CUENTA / CATEGORÍA" o similar, en cualquier orden
      if(/^categor[ií]a$/i.test(col0) || /^categor[ií]a$/i.test(col1) || /^cuenta$/i.test(col0) || /^cuenta$/i.test(col1)) return;

      // detectar automáticamente si el orden es (Nombre, Tipo) o (Tipo, Nombre)
      var t0 = esPalabraDeTipo(col0);
      var t1 = col1 ? esPalabraDeTipo(col1) : false;
      var nombreLinea, colTipoTexto;
      if(t0 && !t1){ colTipoTexto = col0; nombreLinea = col1; }         // ej: "Ingresos  Aguinaldo"
      else if(t1 || (!t0 && partes.length>1)){ nombreLinea = col0; colTipoTexto = col1; } // ej: "Aguinaldo  Ingreso" (o sin tipo reconocible)
      else { nombreLinea = col0; colTipoTexto = col0; }                  // una sola columna, o ambas parecen tipo (ej "TeC  TeC")
      var tipoLinea = normalizarTipo(colTipoTexto);

      if(!nombreLinea) return;
      var existente = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === nombreLinea.toLowerCase(); });
      if(existente){
        if(tipoLinea && existente.tipo !== tipoLinea){
          existente.tipo = tipoLinea;
          paraUpsert.push(toDbCategoria(existente));
          actualizadas++;
        } else { sinCambios++; }
      } else {
        if(partes.length < 2 && /^(ingresos?|egresos?|ahorros?|tec)$/i.test(nombreLinea)){
          return; // probablemente una columna de "tipo" que quedó suelta por un pegado sin tabs; no la creamos como categoría
        }
        var nueva = {id:uid(), nombre:nombreLinea, tipo:tipoLinea};
        STATE.categorias.push(nueva);
        paraUpsert.push(toDbCategoria(nueva));
        agregadas++;
      }
    });
    try{
      await dbUpsert('categorias', paraUpsert);
      STATE.bulkCatMsg = { type:(agregadas>0||actualizadas>0)?'ok':'err',
        text: agregadas+' agregada(s), '+actualizadas+' actualizada(s) con nuevo tipo, '+sinCambios+' sin cambios.' };
    }catch(e){ STATE.dbError = 'No se pudo guardar la carga masiva: '+(e.message||e); }
    render(); return;
  }
  if(action==='bulk-actualizar-colores-categorias'){
    var rawColores = document.getElementById('bulk-colores-categorias').value;
    var lineasColor = rawColores.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
    var actualizadasColor = 0, noEncontradas = [], invalidas = [];
    var paraUpsertColor = [];
    var reHex = /^#?[0-9a-fA-F]{6}$/;
    lineasColor.forEach(function(linea){
      var partes = linea.split('\t').map(function(p){ return p.trim(); });
      if(partes.length < 2) return;
      var nombreLinea = partes[0];
      var hexLinea = partes[partes.length-1]; // soporta pegar "Nombre / Color sugerido / Hex" tal cual: usa la última columna
      if(/^categor[ií]a$/i.test(nombreLinea)) return; // fila de encabezado
      if(!nombreLinea || !reHex.test(hexLinea)){ if(nombreLinea) invalidas.push(nombreLinea); return; }
      var hexNormalizado = '#'+hexLinea.replace('#','').toUpperCase();
      var existente = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === nombreLinea.toLowerCase(); });
      if(!existente){ noEncontradas.push(nombreLinea); return; }
      existente.color = hexNormalizado;
      paraUpsertColor.push(toDbCategoria(existente));
      actualizadasColor++;
    });
    try{
      if(paraUpsertColor.length) await dbUpsert('categorias', paraUpsertColor);
      var detalle = [];
      if(noEncontradas.length) detalle.push(noEncontradas.length+' sin coincidencia: '+noEncontradas.join(', '));
      if(invalidas.length) detalle.push(invalidas.length+' con color inválido: '+invalidas.join(', '));
      STATE.bulkColorCatMsg = { type: actualizadasColor>0 ? 'ok' : 'err',
        text: actualizadasColor+' categoría(s) actualizada(s).'+(detalle.length?' '+detalle.join('. ')+'.':'') };
    }catch(e){ STATE.dbError = 'No se pudo actualizar los colores: '+(e.message||e); }
    render(); return;
  }

  // ---- BACKUP ----
  if(action==='descargar-backup'){
    var backupObj = {
      version: 1,
      exportadoEn: new Date().toISOString(),
      centros: STATE.centros,
      categorias: STATE.categorias,
      subcategorias: STATE.subcategorias,
      movimientos: STATE.movimientos,
      vencimientos: STATE.vencimientos
    };
    var blob = new Blob([JSON.stringify(backupObj, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var fecha = fechaHoyISO();
    a.href = url;
    a.download = 'backup-control-economico-'+fecha+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    STATE.backupMsg = { type:'ok', text:'Backup descargado.' };
    render(); return;
  }
  if(action==='restaurar-backup-preview'){
    var archivo = document.getElementById('backup-file').files[0];
    if(!archivo){ STATE.backupMsg = {type:'err', text:'Elegí primero un archivo .json.'}; render(); return; }
    try{
      var texto = await archivo.text();
      var datos = JSON.parse(texto);
      if(!datos || typeof datos !== 'object'){ throw new Error('El archivo no tiene el formato esperado.'); }
      var nCentros = (datos.centros||[]).length;
      var nCategorias = (datos.categorias||[]).length;
      var nSubcategorias = (datos.subcategorias||[]).length;
      var nMovimientos = (datos.movimientos||[]).length;
      var nVencimientos = (datos.vencimientos||[]).length;
      STATE.backupPendiente = datos;
      STATE.confirmState = {
        message: '¿Restaurar este backup (del '+(datos.exportadoEn ? new Date(datos.exportadoEn).toLocaleString('es-AR') : 'fecha desconocida')+')? Se van a agregar o actualizar: '+nCentros+' centro(s), '+nCategorias+' categoría(s), '+nSubcategorias+' subcategoría(s), '+nMovimientos+' movimiento(s) y '+nVencimientos+' vencimiento(s). No se borra nada de lo que ya tenés.',
        action: 'restaurar-backup-confirmado'
      };
    }catch(e){ STATE.backupMsg = {type:'err', text:'No se pudo leer el archivo: '+(e.message||e)}; }
    render(); return;
  }
  if(action==='restaurar-backup-confirmado'){
    var datosR = STATE.backupPendiente;
    STATE.backupPendiente = null;
    if(!datosR){ render(); return; }
    try{
      if((datosR.centros||[]).length) await dbUpsert('centros', datosR.centros.map(toDbCentro));
      if((datosR.categorias||[]).length) await dbUpsert('categorias', datosR.categorias.map(toDbCategoria));
      if((datosR.subcategorias||[]).length) await dbUpsert('subcategorias', datosR.subcategorias.map(toDbSubcategoria));
      if((datosR.movimientos||[]).length) await dbUpsert('movimientos', datosR.movimientos.map(toDbMovimiento));
      if((datosR.vencimientos||[]).length) await dbUpsert('vencimientos', datosR.vencimientos.map(toDbVencimiento));
      await cargarTodo();
      STATE.saldosDirty = true;
      STATE.backupMsg = { type:'ok', text:'Backup restaurado correctamente.' };
    }catch(e){ STATE.dbError = 'No se pudo restaurar el backup: '+(e.message||e); }
    render(); return;
  }

  if(action==='refrescar-incompletos'){
    STATE.incompletosSnapshotIds = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).map(function(m){ return m.id; });
    render(); return;
  }
  if(action==='limpiar-filtros-mov'){
    STATE.filtros = {centro:[], categoria:[], subcategoria:[], mes:[], texto:'', soloIncompletos:false, soloTarjeta:false};
    STATE.incompletosSnapshotIds = null;
    STATE.movPaginaActual = 1;
    render(); return;
  }

  // ---- MENÚ MÓVIL ----
  if(action==='toggle-menu-movil'){ STATE.menuMovilAbierto = !STATE.menuMovilAbierto; render(); return; }
  if(action==='cerrar-menu-movil'){ STATE.menuMovilAbierto = false; render(); return; }

  // ---- TEMA (claro/oscuro) ----
  if(action==='toggle-tema'){
    STATE.tema = STATE.tema==='oscuro' ? 'claro' : 'oscuro';
    if(STATE.tema==='oscuro') document.documentElement.setAttribute('data-theme', 'oscuro');
    else document.documentElement.removeAttribute('data-theme');
    try{ localStorage.setItem('controlTema', STATE.tema); }catch(e){}
    STATE.menuUsuarioAbierto = false;
    render(); return;
  }

  // ---- MENÚ DE USUARIO (avatar) ----
  if(action==='toggle-menu-usuario'){ STATE.menuUsuarioAbierto = !STATE.menuUsuarioAbierto; render(); return; }
  if(action==='cerrar-sesion'){ await cerrarSesion(); return; }

  // ---- FILTROS MULTISELECT ----
  if(action==='toggle-multiselect'){
    var abriendo = STATE.multiSelectAbierto !== id;
    STATE.multiSelectAbierto = abriendo ? id : null;
    STATE.multiSelectBusqueda = '';
    render();
    if(abriendo){
      var msInput = document.getElementById('ms-buscar-'+id);
      if(msInput) msInput.focus();
    }
    return;
  }
  if(action==='multiselect-limpiar'){ arrayFiltro(id).length = 0; render(); return; }

  // ---- EFECTIVO (carga rápida) ----
  if(action==='abrir-efectivo'){
    STATE.efectivoMsg = null;
    STATE.efectivoAbierto = true;
    STATE.efectivoCategoriaId = '';
    STATE.menuMovilAbierto = false;
    render(); return;
  }
  if(action==='cerrar-efectivo'){
    STATE.efectivoAbierto = false;
    STATE.efectivoMsg = null;
    STATE.efectivoCategoriaId = '';
    render(); return;
  }
  if(action==='guardar-efectivo'){
    var efFecha = document.getElementById('ef-fecha').value;
    var efCentro = document.getElementById('ef-centro').value;
    var efTipo = document.getElementById('ef-tipo').value;
    var efMonto = Math.abs(parseFloat(document.getElementById('ef-monto').value))||0;
    var efProveedor = document.getElementById('ef-proveedor').value.trim();
    var efDetalle = document.getElementById('ef-detalle').value.trim();
    var efCategoria = document.getElementById('ef-categoria').value;
    var efSubcategoria = document.getElementById('ef-subcategoria').value;

    if(!efFecha || !efMonto){
      STATE.efectivoMsg = 'Completá al menos la fecha y el monto.';
      render(); return;
    }
    STATE.efectivoMsg = null; STATE.dbError = null;
    var nuevoEf = {
      id: uid(), fecha: efFecha, centroId: efCentro, categoriaId: efCategoria, subcategoriaId: efSubcategoria,
      proveedor: efProveedor, detalle: efDetalle,
      ingreso: efTipo==='ingreso' ? efMonto : 0,
      egreso: efTipo==='egreso' ? efMonto : 0
    };
    try{
      await dbInsert('movimientos', toDbMovimiento(nuevoEf));
      STATE.movimientos.push(nuevoEf);
      STATE.saldosDirty = true;
      STATE.efectivoAbierto = false;
      STATE.efectivoCategoriaId = '';
    }catch(e){ STATE.dbError = 'No se pudo guardar el movimiento: '+(e.message||e); }
    render(); return;
  }

  // ---- SALDOS ----
  if(action==='recalcular-saldos'){
    STATE.dbError = null;
    try{
      await cargarTodo(); // trae datos frescos, por si hubo cambios desde otra sesión
    }catch(e){ STATE.dbError = 'No se pudo actualizar desde la base de datos: '+(e.message||e); }
    STATE.saldosDirty = true;
    render(); return;
  }

  // ---- SUBCATEGORÍAS ----
  if(action==='edit-subcategoria'){ STATE.editing = {type:'subcategoria', id:id}; render(); return; }
  if(action==='del-subcategoria'){
    var subABorrar = STATE.subcategorias.find(function(s){return s.id===id;});
    if(!subABorrar) return;
    var afectados = STATE.movimientos.filter(function(m){return m.subcategoriaId===id;}).length;
    STATE.subDeleteState = { id:id, nombre:subABorrar.nombre, categoriaId:subABorrar.categoriaId, afectados:afectados, reasignarA:'' };
    render(); return;
  }
  if(action==='sub-delete-cancel'){ STATE.subDeleteState = null; render(); return; }
  if(action==='sub-delete-confirmar'){
    var sds = STATE.subDeleteState;
    if(!sds) return;
    var reasignarA = document.getElementById('sub-delete-reasignar') ? document.getElementById('sub-delete-reasignar').value : '';
    try{
      if(sds.afectados > 0 && reasignarA){
        await sb.from('movimientos').update({subcategoria_id: reasignarA}).eq('subcategoria_id', sds.id);
        STATE.movimientos.forEach(function(m){ if(m.subcategoriaId===sds.id) m.subcategoriaId = reasignarA; });
      } else if(sds.afectados > 0){
        STATE.movimientos.forEach(function(m){ if(m.subcategoriaId===sds.id) m.subcategoriaId = ''; });
      }
      await dbDelete('subcategorias', sds.id);
      STATE.subcategorias = STATE.subcategorias.filter(function(s){return s.id!==sds.id;});
      STATE.subDeleteState = null;
    }catch(e){ STATE.dbError = 'No se pudo borrar la subcategoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-subcategoria'){
    var categoriaId = document.getElementById('f-sub-categoria').value;
    var nombre = document.getElementById('f-sub-nombre').value.trim();
    if(!categoriaId || !nombre) return;
    STATE.dbError = null;
    try{
      if(id){
        await dbUpdate('subcategorias', id, {categoria_id:categoriaId, nombre:nombre});
        var s = STATE.subcategorias.find(function(x){return x.id===id;});
        s.categoriaId = categoriaId; s.nombre = nombre;
      } else {
        var nuevaS = {id:uid(), categoriaId:categoriaId, nombre:nombre};
        await dbInsert('subcategorias', toDbSubcategoria(nuevaS));
        STATE.subcategorias.push(nuevaS);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar la subcategoría: '+(e.message||e); }
    render(); return;
  }

  // ---- MOVIMIENTOS ----
  if(action==='toggle-grupo-tarjeta-mov'){
    STATE.gruposAbiertos[id] = !STATE.gruposAbiertos[id];
    render(); return;
  }
  if(action==='edit-mov'){
    STATE.editing = {type:'mov', id:id}; STATE.movFormMsg = null; STATE.movDraftCentroDestinoId = '';
    STATE.bulkEditMovAbierto = false;
    render(); return;
  }
  if(action==='del-mov'){
    STATE.confirmState = { message:'¿Borrar este movimiento?', action:'del-mov-do', id:id };
    render(); return;
  }
  if(action==='del-mov-do'){
    try{
      await dbDelete('movimientos', id);
      STATE.movimientos = STATE.movimientos.filter(function(m){return m.id!==id;});
      if(STATE.movSeleccionados) STATE.movSeleccionados = STATE.movSeleccionados.filter(function(mid){return mid!==id;});
      STATE.saldosDirty = true;
    }catch(e){ STATE.dbError = 'No se pudo borrar el movimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-mov'){
    var v = getMovFormValues();
    STATE.movDraft = v; // conservar lo tipeado si la validación falla más abajo
    var esFechaFutura = !!v.fecha && v.fecha > fechaHoyISO();
    if(!v.fecha || (!v.centroId && !esFechaFutura) || !v.categoriaId || !v.proveedor || !v.monto){
      STATE.movFormMsg = esFechaFutura
        ? 'Completá al menos: fecha, categoría, proveedor y monto.'
        : 'Completá al menos: fecha, centro de costo, categoría, proveedor y monto.';
      render(); return;
    }
    var catElegida = STATE.categorias.find(function(c){return c.id===v.categoriaId;});
    var esTecMov = catElegida && catElegida.tipo === 'tec';
    var centroDestinoEl = document.getElementById('f-mov-centro-destino');
    var centroDestino = centroDestinoEl ? centroDestinoEl.value : '';

    if(esTecMov && centroDestino && centroDestino === v.centroId){
      STATE.movFormMsg = 'El Centro de Costo Destino tiene que ser distinto al de origen.';
      render(); return;
    }

    STATE.movFormMsg = null; STATE.dbError = null;
    var monto = Math.abs(parseFloat(v.monto))||0;
    var mov = {
      fecha: v.fecha, centroId: v.centroId, categoriaId: v.categoriaId, subcategoriaId: v.subcategoriaId,
      proveedor: v.proveedor, detalle: v.detalle,
      ingreso: v.tipo==='ingreso' ? monto : 0,
      egreso: v.tipo==='egreso' ? monto : 0,
      tarjeta: !!v.tarjeta,
      fechaConsumo: v.tarjeta ? (v.fechaConsumo||'') : '',
      tarjetaMarca: v.tarjeta ? (v.tarjetaMarca||'').trim() : ''
    };
    // Compra en cuotas con tarjeta: la Fecha cargada es el vencimiento de la 1ª cuota;
    // las siguientes caen un mes después cada una, con el mismo monto (no se divide).
    // La Fecha de consumo (si se cargó) es la misma para todas las cuotas: la compra se hizo una sola vez.
    // Al editar un movimiento ya cargado también se puede sumar cuotas: el movimiento editado
    // queda como la 1ª cuota y se crean nuevos movimientos para las cuotas restantes.
    var cuotasTotal = v.tarjeta ? Math.max(1, parseInt(v.cuotas,10)||1) : 1;
    var detalleBase = v.detalle||'';
    function detalleConSufijo(numeroCuota){
      if(cuotasTotal<=1) return detalleBase;
      return detalleBase + ' ('+numeroCuota+'/'+cuotasTotal+')';
    }
    try{
      if(id){
        var movEditado = Object.assign({}, mov, { detalle: detalleConSufijo(1) });
        await dbUpdate('movimientos', id, toDbMovimiento(Object.assign({id:id}, movEditado)));
        var idx = STATE.movimientos.findIndex(function(m){return m.id===id;});
        if(idx>-1) STATE.movimientos[idx] = Object.assign({id:id}, movEditado);

        if(esTecMov && centroDestino){
          // faltaba la línea espejo (típico de movimientos importados): crearla ahora, sin tocar ninguna otra existente
          var nuevoEspejo = {
            id: uid(), fecha: movEditado.fecha, centroId: centroDestino, categoriaId: movEditado.categoriaId, subcategoriaId: movEditado.subcategoriaId,
            proveedor: movEditado.proveedor, detalle: (movEditado.detalle ? movEditado.detalle+' ' : '')+'(transferencia automática)',
            ingreso: v.tipo==='ingreso' ? 0 : monto,
            egreso: v.tipo==='ingreso' ? monto : 0,
            tarjeta: !!v.tarjeta
          };
          await dbInsert('movimientos', [toDbMovimiento(nuevoEspejo)]);
          STATE.movimientos.push(nuevoEspejo);
        }

        if(cuotasTotal>1){
          var loteRestante = [];
          for(var cj=1; cj<cuotasTotal; cj++){
            var fechaCuotaJ = sumarMeses(v.fecha, cj);
            loteRestante.push(Object.assign({id:uid()}, mov, { fecha: fechaCuotaJ, detalle: detalleConSufijo(cj+1) }));
          }
          await dbInsert('movimientos', loteRestante.map(toDbMovimiento));
          STATE.movimientos.push.apply(STATE.movimientos, loteRestante);
        }
      } else {
        var fechasCuotas = [];
        for(var ci=0; ci<cuotasTotal; ci++){ fechasCuotas.push(ci===0 ? v.fecha : sumarMeses(v.fecha, ci)); }
        var nuevosLote = [];
        fechasCuotas.forEach(function(fechaCuota, i){
          var base = Object.assign({}, mov, { fecha: fechaCuota, detalle: detalleConSufijo(i+1) });
          if(esTecMov && centroDestino){
            // crear el movimiento de origen + el espejo automático en el centro destino, con tipo contrario
            var nuevoM = Object.assign({id:uid()}, base);
            var espejo = {
              id: uid(), fecha: fechaCuota, centroId: centroDestino, categoriaId: v.categoriaId, subcategoriaId: v.subcategoriaId,
              proveedor: v.proveedor, detalle: (base.detalle ? base.detalle+' ' : '')+'(transferencia automática)',
              ingreso: v.tipo==='ingreso' ? 0 : monto,
              egreso: v.tipo==='ingreso' ? monto : 0,
              tarjeta: !!v.tarjeta
            };
            nuevosLote.push(nuevoM, espejo);
          } else {
            nuevosLote.push(Object.assign({id:uid()}, base));
          }
        });
        await dbInsert('movimientos', nuevosLote.map(toDbMovimiento));
        STATE.movimientos.push.apply(STATE.movimientos, nuevosLote);
      }
      STATE.saldosDirty = true;
      STATE.editing = null;
      STATE.movDraft = null;
      STATE.nuevoMovAbierto = false;
      STATE.movDraftCentroDestinoId = '';
    }catch(e){ STATE.dbError = 'No se pudo guardar el movimiento: '+(e.message||e); }
    render(); return;
  }

  // ---- VENCIMIENTOS ----
  if(action==='edit-venc'){ STATE.editing = {type:'venc', id:id}; STATE.vencFormMsg = null; render(); return; }
  if(action==='del-venc'){
    STATE.confirmState = { message:'¿Borrar este vencimiento?', action:'del-venc-do', id:id };
    render(); return;
  }
  if(action==='del-venc-do'){
    try{
      await dbDelete('vencimientos', id);
      STATE.vencimientos = STATE.vencimientos.filter(function(v){return v.id!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar el vencimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-venc'){
    var concepto = document.getElementById('f-venc-concepto').value.trim();
    var fecha = document.getElementById('f-venc-fecha').value;
    var monto = parseFloat(document.getElementById('f-venc-monto').value) || 0;
    var centroId = document.getElementById('f-venc-centro').value;
    if(!concepto || !fecha){
      STATE.vencFormMsg = 'Completá al menos concepto y fecha de vencimiento.';
      render(); return;
    }
    STATE.vencFormMsg = null; STATE.dbError = null;
    try{
      if(id){
        var v = STATE.vencimientos.find(function(x){return x.id===id;});
        v.concepto = concepto; v.fecha = fecha; v.monto = monto; v.centroId = centroId;
        await dbUpdate('vencimientos', id, toDbVencimiento(v));
      } else {
        var nuevoV = {id:uid(), concepto:concepto, fecha:fecha, monto:monto, centroId:centroId, estado:'pendiente'};
        await dbInsert('vencimientos', toDbVencimiento(nuevoV));
        STATE.vencimientos.push(nuevoV);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar el vencimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='toggle-venc-estado'){
    var vt = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vt) return;
    var nuevoEstado = (vt.estado==='pagado') ? 'pendiente' : 'pagado';
    try{
      await dbUpdate('vencimientos', id, {estado:nuevoEstado});
      vt.estado = nuevoEstado;
    }catch(e){ STATE.dbError = 'No se pudo actualizar el estado: '+(e.message||e); }
    render(); return;
  }
  if(action==='venc-a-movimiento'){
    var vm = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vm) return;
    var nuevoMov = {
      id: uid(), fecha: vm.fecha, centroId: vm.centroId||'', categoriaId:'', subcategoriaId:'',
      proveedor: vm.concepto, detalle:'', ingreso:0, egreso: Number(vm.monto)||0
    };
    try{
      await dbInsert('movimientos', toDbMovimiento(nuevoMov));
      await dbUpdate('vencimientos', id, {estado:'pagado'});
      STATE.movimientos.push(nuevoMov);
      STATE.saldosDirty = true;
      vm.estado = 'pagado';
      STATE.activeTab = 'movimientos'; STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo convertir el vencimiento en movimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='bulk-add-vencimientos'){
    var rawV = document.getElementById('bulk-vencimientos').value;
    var lineasV = rawV.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
    var agregadosV = 0;
    var nuevosVenc = [];
    lineasV.forEach(function(linea){
      var partes = linea.split('\t');
      if(partes.length < 3) partes = linea.split(/\s{2,}/);
      if(partes.length < 3) return;
      var concepto = (partes[0]||'').trim();
      var fecha = fechaVencCortaAISO(partes[1]);
      var monto = parseNumeroFlexible(partes[2]);
      var ccTexto = (partes[3]||'').trim();
      var centroId = '';
      if(ccTexto){
        var cc = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase()===ccTexto.toUpperCase(); });
        if(cc) centroId = cc.id;
      }
      if(!concepto || !fecha) return;
      var nv = {id:uid(), concepto:concepto, fecha:fecha, monto:monto, centroId:centroId, estado:'pendiente'};
      nuevosVenc.push(nv);
      agregadosV++;
    });
    try{
      if(nuevosVenc.length) await dbInsert('vencimientos', nuevosVenc.map(toDbVencimiento));
      STATE.vencimientos = STATE.vencimientos.concat(nuevosVenc);
      STATE.bulkVencMsg = { type: agregadosV>0?'ok':'err', text: agregadosV+' vencimiento(s) agregado(s).' };
    }catch(e){ STATE.dbError = 'No se pudo guardar la carga masiva de vencimientos: '+(e.message||e); }
    render(); return;
  }

  // ---- IMPORTAR ----
  if(action==='preview-import'){
    var entidadImp = document.getElementById('imp-entidad') ? document.getElementById('imp-entidad').value : STATE.importEntidad;

    if(entidadImp === 'excel'){
      var filasExcel = parseExcelHistorico(STATE.importRaw||'');
      if(!filasExcel.length){
        STATE.importMsg = {type:'err', text:'No se encontraron filas con el formato esperado (10 columnas separadas por tab: Periodo, Cuenta, Categoría, Subcategoría, CC, Fecha, Proveedor, Detalle, Ingresos, Egresos).'};
        STATE.importPreviewExcel = null; render(); return;
      }
      STATE.importPreviewExcel = filasExcel.map(function(r){
        var ccMatch = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === (r.cc||'').toUpperCase(); });
        var catMatch = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === (r.categoria||'').toLowerCase(); });
        var subMatch = r.subcategoria ? STATE.subcategorias.find(function(s){ return s.nombre.toLowerCase() === r.subcategoria.toLowerCase() && (!catMatch || s.categoriaId===catMatch.id); }) : null;
        return {
          id: uid(), fecha: r.fecha, ccText: r.cc, categoriaText: r.categoria, subcategoriaText: r.subcategoria,
          proveedor: r.proveedor, detalle: r.detalle, ingreso: r.ingreso, egreso: r.egreso, incluir: true,
          ccExists: !!ccMatch, catExists: !!catMatch, subExists: !!subMatch
        };
      });
      STATE.importPreview = null;
      STATE.importMsg = null;
      render(); return;
    }

    var res = runParser();
    if(res.error){ STATE.importMsg = {type:'err', text: res.error}; STATE.importPreview = null; render(); return; }
    if(!res.rows.length){
      var textoVacio = res.omitidas ? 'Todas las filas encontradas ('+res.omitidas+') están en dólares; esta entidad solo importa montos en pesos.' : 'No se encontró ningún movimiento en el texto pegado.';
      STATE.importMsg = {type:'err', text: textoVacio}; STATE.importPreview = null; render(); return;
    }
    var defaultCentroId = findDefaultCentroId();
    var tarjetaMarcaLote = (STATE.importEntidad==='tarjeta') ? (STATE.importTarjetaMarca||'').trim() : '';
    STATE.importPreview = res.rows.map(function(r){
      var sugerido = aplicarReglaAFila(r.proveedor);
      return { id:uid(), fecha: fechaCortaAISO(r.fecha), fechaConsumo: r.fechaConsumo ? fechaCortaAISO(r.fechaConsumo) : '', tarjetaMarca: tarjetaMarcaLote, proveedor: r.proveedor||'', detalle: r.tipo||'', monto: r.monto,
        centroId: defaultCentroId||'', categoriaId: sugerido.categoriaId, subcategoriaId: sugerido.subcategoriaId, incluir:true, guardarRegla:false };
    });
    STATE.importMsg = defaultCentroId ? null : {type:'err', text:'No encontré un Centro de Costo con el código esperado para esta entidad. Asigná uno por fila abajo, o cargalo primero en ABM → Centros de Costo.'};
    if(res.omitidas){
      var omitTexto = res.omitidas+' fila(s) en dólares no se importaron (esta entidad solo carga montos en pesos); cargalas manualmente si corresponde.';
      STATE.importMsg = STATE.importMsg ? {type: STATE.importMsg.type, text: STATE.importMsg.text+' '+omitTexto} : {type:'ok', text: omitTexto};
    }
    render(); return;
  }
  if(action==='cancel-import'){ STATE.importPreview = null; STATE.importPreviewExcel = null; STATE.importMsg = null; render(); return; }
  if(action==='confirm-import-excel'){
    var seleccionadasExcel = STATE.importPreviewExcel.filter(function(r){return r.incluir;});
    if(!seleccionadasExcel.length){ STATE.importMsg = {type:'err', text:'No hay movimientos seleccionados para importar.'}; render(); return; }

    var nuevosCentros = [], nuevasCategorias = [], nuevasSubcategorias = [];

    function resolverCentro(ccText){
      if(!ccText) return '';
      var found = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === ccText.toUpperCase(); });
      if(found) return found.id;
      var nuevo = {id:uid(), codigo: ccText.toUpperCase(), nombre: ccText};
      STATE.centros.push(nuevo); nuevosCentros.push(nuevo); STATE.saldosDirty = true;
      return nuevo.id;
    }
    function resolverCategoria(nombreText){
      if(!nombreText) return '';
      var found = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === nombreText.toLowerCase(); });
      if(found) return found.id;
      var nuevo = {id:uid(), nombre: nombreText, tipo:''};
      STATE.categorias.push(nuevo); nuevasCategorias.push(nuevo);
      return nuevo.id;
    }
    function resolverSubcategoria(nombreText, categoriaId){
      if(!nombreText || !categoriaId) return '';
      var found = STATE.subcategorias.find(function(s){ return s.nombre.toLowerCase() === nombreText.toLowerCase() && s.categoriaId === categoriaId; });
      if(found) return found.id;
      var nuevo = {id:uid(), categoriaId: categoriaId, nombre: nombreText};
      STATE.subcategorias.push(nuevo); nuevasSubcategorias.push(nuevo);
      return nuevo.id;
    }

    var nuevosMovimientos = [];
    seleccionadasExcel.forEach(function(r){
      var centroId = resolverCentro(r.ccText);
      var categoriaId = resolverCategoria(r.categoriaText);
      var subcategoriaId = resolverSubcategoria(r.subcategoriaText, categoriaId);
      var nm = {
        id: uid(), fecha: r.fecha, centroId: centroId, categoriaId: categoriaId, subcategoriaId: subcategoriaId,
        proveedor: r.proveedor, detalle: r.detalle, ingreso: r.ingreso||0, egreso: r.egreso||0
      };
      nuevosMovimientos.push(nm);
      STATE.movimientos.push(nm);
      STATE.saldosDirty = true;
    });

    try{
      if(nuevosCentros.length) await dbInsert('centros', nuevosCentros.map(toDbCentro));
      if(nuevasCategorias.length) await dbInsert('categorias', nuevasCategorias.map(toDbCategoria));
      if(nuevasSubcategorias.length) await dbInsert('subcategorias', nuevasSubcategorias.map(toDbSubcategoria));
      await dbInsert('movimientos', nuevosMovimientos.map(toDbMovimiento));

      STATE.importPreviewExcel = null; STATE.importRaw = '';
      STATE.importMsg = { type:'ok', text: seleccionadasExcel.length+' movimiento(s) importado(s). Se crearon '+nuevosCentros.length+' centro(s) de costo, '+nuevasCategorias.length+' categoría(s) y '+nuevasSubcategorias.length+' subcategoría(s) nuevas.' };
      STATE.activeTab = 'movimientos'; STATE.editing = null;
    }catch(e){
      // revertir los agregados en memoria si la base de datos falló, para no mostrar datos que no se guardaron
      STATE.centros = STATE.centros.filter(function(c){ return nuevosCentros.indexOf(c)===-1; });
      STATE.categorias = STATE.categorias.filter(function(c){ return nuevasCategorias.indexOf(c)===-1; });
      STATE.subcategorias = STATE.subcategorias.filter(function(s){ return nuevasSubcategorias.indexOf(s)===-1; });
      STATE.movimientos = STATE.movimientos.filter(function(m){ return nuevosMovimientos.indexOf(m)===-1; });
      STATE.dbError = 'No se pudo completar la importación: '+(e.message||e);
    }
    render(); return;
  }
  if(action==='apply-all'){
    var catAllSel = document.getElementById('imp-cat-all');
    var centroAllSel = document.getElementById('imp-centro-all');
    var catVal = catAllSel ? catAllSel.value : '';
    var centroVal = centroAllSel ? centroAllSel.value : '';
    STATE.importPreview.forEach(function(row){
      if(catVal){ row.categoriaId = catVal; row.subcategoriaId=''; }
      if(centroVal){ row.centroId = centroVal; }
    });
    render(); return;
  }
  if(action==='confirm-import'){
    var seleccionadas = STATE.importPreview.filter(function(r){return r.incluir;});
    if(!seleccionadas.length){ STATE.importMsg = {type:'err', text:'No hay movimientos seleccionados para importar.'}; render(); return; }
    var faltaCentro = seleccionadas.some(function(r){return !r.centroId;});
    if(faltaCentro){ STATE.importMsg = {type:'err', text:'Hay movimientos sin Centro de Costo asignado. Asignalo antes de importar.'}; render(); return; }
    var esTarjeta = STATE.importEntidad === 'tarjeta';
    var nuevosMov = seleccionadas.map(function(r){
      return {
        id: uid(), fecha: r.fecha, centroId: r.centroId, categoriaId: r.categoriaId, subcategoriaId: r.subcategoriaId,
        proveedor: r.proveedor, detalle: r.detalle,
        ingreso: r.monto>0 ? r.monto : 0,
        egreso: r.monto<0 ? -r.monto : 0,
        tarjeta: esTarjeta,
        fechaConsumo: r.fechaConsumo || '',
        tarjetaMarca: r.tarjetaMarca || ''
      };
    });
    try{
      await dbInsert('movimientos', nuevosMov.map(toDbMovimiento));
      STATE.movimientos = STATE.movimientos.concat(nuevosMov);
      STATE.saldosDirty = true;
      var nuevasReglas = 0;
      seleccionadas.forEach(function(r){
        if(r.guardarRegla && r.categoriaId){
          agregarOActualizarRegla(r.proveedor, nombreCategoria(r.categoriaId), r.subcategoriaId ? nombreSubcategoria(r.subcategoriaId) : '');
          nuevasReglas++;
        }
      });
      STATE.importPreview = null; STATE.importRaw = '';
      STATE.importMsg = {type:'ok', text: seleccionadas.length+' movimiento(s) importado(s) correctamente.'+(nuevasReglas ? ' Se guardaron '+nuevasReglas+' regla(s) de categorización nueva(s).' : '')};
      STATE.activeTab = 'movimientos'; STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo completar la importación: '+(e.message||e); }
    render(); return;
  }

  // ---- REGLAS DE CATEGORIZACIÓN (localStorage) ----
  if(action==='agregar-regla'){
    var rProv = document.getElementById('regla-proveedor').value.trim();
    var rCatId = document.getElementById('regla-categoria').value;
    var rSub = document.getElementById('regla-subcategoria').value.trim();
    if(!rProv || !rCatId){
      STATE.reglaFormMsg = 'Completá al menos el proveedor y la categoría.';
      render(); return;
    }
    agregarOActualizarRegla(rProv, nombreCategoria(rCatId), rSub);
    STATE.reglaFormMsg = null;
    render(); return;
  }
  if(action==='borrar-regla'){
    STATE.reglas = STATE.reglas.filter(function(r){ return r.id !== id; });
    guardarReglas(STATE.reglas);
    render(); return;
  }

  // ---- GIMNASIO (bonus track Ana vs Franco) ----
  if(action==='gym-marcar-visita'){
    STATE.gimnasioMsg = null;
    var personaGym = personaPorUsuario();
    if(!personaGym){ STATE.gimnasioMsg = 'No pudimos identificar tu usuario para cargar la visita.'; render(); return; }
    var hoyGym = fechaHoyISO();
    var yaExiste = STATE.gimnasioVisitas.some(function(v){ return v.persona===personaGym && v.fecha===hoyGym; });
    if(yaExiste){ render(); return; }
    try{
      var filasGym = await dbInsert('gimnasio_visitas', [{persona:personaGym, fecha:hoyGym}]);
      STATE.gimnasioVisitas = STATE.gimnasioVisitas.concat(filasGym.map(fromDbGimnasioVisita));
    }catch(e){
      STATE.gimnasioMsg = 'No se pudo guardar la visita: '+(e.message||e);
    }
    render(); return;
  }
  if(action==='gym-borrar-visita'){
    STATE.gimnasioMsg = null;
    try{
      await dbDelete('gimnasio_visitas', id);
      STATE.gimnasioVisitas = STATE.gimnasioVisitas.filter(function(v){ return v.id!==id; });
    }catch(e){
      STATE.gimnasioMsg = 'No se pudo borrar la visita: '+(e.message||e);
    }
    render(); return;
  }
}

document.getElementById('btnLogin').addEventListener('click', intentarLogin);
document.getElementById('login-password').addEventListener('keydown', function(ev){ if(ev.key==='Enter') intentarLogin(); });
initAuth();

// Cerrar cualquier filtro multiselect abierto al hacer clic fuera de él (listener único, no se repite en cada render).
// No filtra por el id puntual abierto: alcanza con que el clic haya sido dentro de CUALQUIER multiselect
// (el propio toggle, un checkbox o "Limpiar" ya actualizan STATE.multiSelectAbierto en su propio handler).
document.addEventListener('click', function(ev){
  if(!STATE.multiSelectAbierto) return;
  if(ev.target.closest && ev.target.closest('[data-multiselect-wrap]')) return;
  STATE.multiSelectAbierto = null;
  STATE.multiSelectBusqueda = '';
  render();
});

// Cerrar el menú de usuario (avatar) al hacer clic fuera de él, mismo patrón que el multiselect de arriba.
document.addEventListener('click', function(ev){
  if(!STATE.menuUsuarioAbierto) return;
  if(ev.target.closest && ev.target.closest('[data-user-menu-wrap]')) return;
  STATE.menuUsuarioAbierto = false;
  render();
});
