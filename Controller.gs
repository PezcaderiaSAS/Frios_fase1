// ======================================================
// CONFIGURACIÓN Y UTILIDADES BÁSICAS
// ======================================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('WMS ColdChain Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Función auxiliar para servir las vistas parciales (Router SPA)
function getHtmlContent(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ======================================================
// 1. API: DASHBOARD Y ESTADÍSTICAS (INTELIGENCIA DE NEGOCIO)
// ======================================================

/**
 * Obtiene los datos del Dashboard (KPIs, Ocupación, Historial)
 */
function apiGetDashboardData(idCliente) {
  try {
    // CACHE CHECK
    const cacheKey = 'DASH_DATA_' + idCliente;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Lectura en bloque para minimizar I/O
    const sheetContratos = ss.getSheetByName('DIM_CONTRATOS');
    const sheetHeader = ss.getSheetByName('MOV_HEADER');
    const sheetDetail = ss.getSheetByName('MOV_DETAIL');
    
    const [dataContratos, dataHeader, dataDetail] = [
      sheetContratos ? sheetContratos.getDataRange().getValues() : [],
      sheetHeader ? sheetHeader.getDataRange().getValues() : [],
      sheetDetail ? sheetDetail.getDataRange().getValues() : []
    ];

    // A. Obtener Contrato Activo
    let contrato = { posiciones: 0, factor: 800 }; 
    if (dataContratos.length > 1) {
      // dataContratos es [ID, ID_CLI, POS, FACTOR, PRECIO, EXC, FECHA, ESTADO, TIPO, PRECIO_DIA]
      const contratoEncontrado = dataContratos.slice(1).find(r => 
        String(r[1]) === String(idCliente) && r[7] === 'ACTIVO'
      );
      if (contratoEncontrado) {
        contrato = { 
          posiciones: Number(contratoEncontrado[2]) || 0, 
          factor: Number(contratoEncontrado[3]) || 800 
        };
      }
    }

    // B. Calcular Ocupación Actual (Optimizado: Suma Directa)
    // 1. Identificar IDs de movimientos del cliente
    const movsCliente = new Set();
    const headersCliente = [];
    
    // Empezamos desde 1 para saltar header
    for (let i = 1; i < dataHeader.length; i++) {
        const r = dataHeader[i];
        if (String(r[3]) === String(idCliente)) {
            movsCliente.add(r[0]); // ID Movimiento
            headersCliente.push(r); // Guardar para historial
        }
    }

    // 2. Sumar detalles asociados
    let pesoTotal = 0;
    // Empezamos desde 1 para saltar header
    for (let i = 1; i < dataDetail.length; i++) {
        const r = dataDetail[i];
        // r[1] es ID Movimiento, r[7] es Peso
        if (movsCliente.has(r[1])) {
            pesoTotal += (Number(r[7]) || 0);
        }
    }
    
    // C. Obtener Historial (Usando los headers ya filtrados)
    // Ordenar por ID inverso o Fecha inversa (Asumimos ID incremental o fecha similar)
    // headersCliente es [ID, TIPO, FECHA, CLI, REF, CAJAS, PESO, URL]
    const ultimosMovimientos = headersCliente
        .reverse()
        .slice(0, 10)
        .map(r => ({
          id: String(r[0]),
          tipo: String(r[1]),
          fecha: r[2] instanceof Date ? r[2].toISOString() : String(r[2]),
          ref: String(r[4]),
          totalPeso: Number(r[6]).toFixed(2),
          url: String(r[7])
        }));

    const result = {
      success: true,
      contrato: contrato,
      ocupacion: {
        pesoTotal: pesoTotal,
        posicionesUsadas: (pesoTotal / contrato.factor),
        porcentaje: contrato.posiciones > 0 ? ((pesoTotal / contrato.factor) / contrato.posiciones) * 100 : 0
      },
      historial: ultimosMovimientos
    };

    saveToCache(cacheKey, result, 1800); // 30 min cache
    return result;

  } catch (e) {
    Logger.log("Error Dashboard: " + e);
    return { success: false, error: e.toString() };
  }
}

// ======================================================
// 2. API: CÁLCULO DE INVENTARIO (LA FUNCIÓN QUE FALTABA)
// ======================================================

/**
 * Calcula el inventario actual de un cliente específico
 */
function apiGetInventarioCliente(idCliente) {
  try {
    // CACHE CHECK
    const cacheKey = 'INV_DATA_' + idCliente;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  const products = ss.getSheetByName('DIM_PRODUCTOS').getDataRange().getValues();
  
  // Mapa de productos para nombres rápidos
  // Esquema: [ID_PRODUCTO, ID_CLIENTE, NOMBRE, PESO_NOMINAL, EMPAQUE]
  const mapProductos = {};
  products.slice(1).forEach(r => mapProductos[r[0]] = { nombre: r[2], empaque: r[4] });
  
  // Identificar movimientos del cliente
  const movimientosCliente = new Set();
  headers.slice(1).forEach(r => {
    if (String(r[3]) === String(idCliente)) movimientosCliente.add(r[0]);
  });

  // Agrupar saldos
  const inventario = {};
  
  details.slice(1).forEach(r => {
    if (movimientosCliente.has(r[1])) { 
      const key = r[2] + '|' + r[3]; // ID_PROD + LOTE
      
      if (!inventario[key]) {
        inventario[key] = {
          idProducto: r[2],
          nombreProducto: mapProductos[r[2]]?.nombre || 'Producto ' + r[2],
          empaque: mapProductos[r[2]]?.empaque || 'Und',
          lote: r[3] instanceof Date ? r[3].toISOString().split('T')[0] : r[3],
          cajas: 0,
          peso: 0
        };
      }
      
      // Detectar signo basado en el ID del movimiento (MOV-IN es positivo, MOV-OUT negativo)
      // Ojo: Si ya guardas en negativo en la BD, sumamos directo. 
      // Asumiremos que en BD se guarda: Entrada(+), Salida(-) en las columnas numéricas.
      // Si en tu BD Salida es positivo, descomenta la linea de abajo:
      // const factor = r[1].includes('OUT') ? -1 : 1; 
      const valCajas = parseFloat(r[6] || 0);
      const valPeso = parseFloat(r[7] || 0);

      inventario[key].cajas += valCajas;
      inventario[key].peso += valPeso;
    }
  });

  // Filtrar solo lo que tiene existencia positiva (> 0.01) y ordenar FIFO
  
  const result = Object.values(inventario)
    .filter(item => item.peso > 0.01)
    .sort((a, b) => {
        if (a.nombreProducto < b.nombreProducto) return -1;
        if (a.nombreProducto > b.nombreProducto) return 1;
        
        const loteA = parseInt(a.lote, 10);
        const loteB = parseInt(b.lote, 10);
        
        if (!isNaN(loteA) && !isNaN(loteB)) return loteA - loteB;
        if (String(a.lote) < String(b.lote)) return -1;
        if (String(a.lote) > String(b.lote)) return 1;
        return 0;
    });

  saveToCache(cacheKey, result, 3600); // 1 hora
  return result;

  } catch (e) {
    Logger.log("Error apiGetInventarioCliente: " + e);
    return []; // Retornar array vacio en error para no romper frontend
  }
}

// ======================================================
// 3. API: PRODUCTOS Y STOCK GLOBAL
// ======================================================

function apiGetProductosConStock(idCliente) {
  try {
    // CACHE CHECK
    const cacheKey = 'STOCK_DATA_' + (idCliente || 'ALL');
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const productosBase = apiGetProductos(idCliente); 
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  
  const stockMap = {};

  details.slice(1).forEach(r => {
    const idProd = r[2];
    const cajas = parseFloat(r[6] || 0);
    const peso = parseFloat(r[7] || 0);
    
    // Suma directa (asumiendo que salidas se guardan como negativo en BD)
    if (!stockMap[idProd]) stockMap[idProd] = { cajas: 0, peso: 0 };
    stockMap[idProd].cajas += cajas;
    stockMap[idProd].peso += peso;
  });

  const result = productosBase.map(p => ({
    ...p,
    stockCajas: (stockMap[p.id]?.cajas || 0).toFixed(1),
    stockPeso: (stockMap[p.id]?.peso || 0).toFixed(2)
  }));
  
  saveToCache(cacheKey, result, 1800); // 30 min
  return result;

  } catch (e) {
    Logger.log("Error apiGetProductosConStock: " + e);
    return [];
  }
}

// ======================================================
// 4. API: BÚSQUEDA Y EDICIÓN DE MOVIMIENTOS
// ======================================================

function apiGetMovimientoDetalle(idMovimiento) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  
  const headerRow = headers.find(r => String(r[0]) === String(idMovimiento));
  if (!headerRow) throw new Error("Movimiento no encontrado");
  
  const items = details
    .filter(r => String(r[1]) === String(idMovimiento))
    .map(r => ({
      idDetalle: r[0],
      idProducto: r[2],
      lote: r[3],
      fechaVencimiento: r[5] ? new Date(r[5]).toISOString().split('T')[0] : '',
      cantidadCajas: Math.abs(r[6]), // Convertir a absoluto para el formulario
      pesoKg: Math.abs(r[7])        
    }));

  return {
    header: {
      id: headerRow[0],
      tipo: headerRow[1],
      fecha: new Date(headerRow[2]).toISOString().split('T')[0],
      idCliente: headerRow[3],
      docReferencia: headerRow[4]
    },
    items: items
  };
  } catch (e) {
    throw e; // Relanzar para que el frontend lo maneje via withFailureHandler si se usa, o el caller lo capture
  }
}

/**
 * API: Obtiene historial completo (limitado a últimos 100 para rendimiento)
 */
function apiGetHistorialCompleto() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('MOV_HEADER');
  const sheetCli = ss.getSheetByName('DIM_CLIENTES');
  
  if (!sheet || sheet.getLastRow() < 2) return [];

  // 1. Obtener Mapa de Clientes (ID -> Nombre)
  const clientesData = sheetCli.getDataRange().getValues();
  const mapClientes = {};
  clientesData.slice(1).forEach(r => mapClientes[r[0]] = r[1]);

  // 2. Obtener Movimientos (Últimos 100)
  const lastRow = sheet.getLastRow();
  const startRow = Math.max(2, lastRow - 99); 
  // Cols: [ID, TIPO, FECHA, ID_CLIENTE, REF, CAJAS, PESO, URL]
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 9).getValues().reverse();

  return data.map(r => ({
    id: r[0],
    tipo: r[1],
    fecha: r[2] instanceof Date ? r[2].toISOString() : r[2],
    idCliente: r[3],
    nombreCliente: mapClientes[r[3]] || r[3],
    ref: r[4],
    totalPeso: Number(r[6] || 0).toFixed(2),
    url: r[7]
  }));
}

// Alias para compatibilidad con frontend
function apiGetUltimosMovimientos() {
  return apiGetHistorialCompleto();
}

// ======================================================
// SCHEMAS DE VALIDACIÓN
// ======================================================
const SCHEMAS = {
    MOVIMIENTO: {
        tipo: (v) => ['ENTRADA', 'SALIDA'].includes(v),
        idCliente: (v) => typeof v === 'string' && v.length > 0,
        fecha: (v) => !isNaN(new Date(v).getTime()),
        totalCajas: (v) => typeof v === 'number' && v >= 0,
        totalPeso: (v) => typeof v === 'number' && v >= 0,
        productos: (v) => Array.isArray(v) && v.length > 0 && v.every(p => p.idProducto && p.cantidadCajas !== undefined && p.pesoKg !== undefined)
    },
    CLIENTE: {
        nombre: (v) => typeof v === 'string' && v.length > 2,
        nit: (v) => typeof v === 'string' && v.length > 4,
        tipoPago: (v) => ['PREPAGO', 'POSTPAGO'].includes(v)
    }
};

function validateSchema(data, schemaName) {
    const schema = SCHEMAS[schemaName];
    if (!schema) throw new Error("Schema no definido: " + schemaName);
    
    const errors = [];
    for (const [field, validator] of Object.entries(schema)) {
        if (!validator(data[field])) {
            errors.push(`Campo inválido o faltante: ${field}`);
        }
    }
    
    if (errors.length > 0) throw new Error("Error de Validación: " + errors.join(', '));
}

function apiActualizarMovimiento(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  // VALIDACIÓN
  validateSchema(data, 'MOVIMIENTO');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetHeader = ss.getSheetByName('MOV_HEADER');
    const sheetDetail = ss.getSheetByName('MOV_DETAIL');
    
    // 1. Actualizar Header
    const headers = sheetHeader.getDataRange().getValues();
    const rowIndex = headers.findIndex(r => String(r[0]) === String(data.id));
    
    if (rowIndex === -1) throw new Error("ID no existe");
    
    // Actualizar columnas: FECHA(3), ID_CLIENTE(4), REF(5), CAJAS(6), PESO(7) (Base 1)
    // En array base 0: Fecha=2, Cliente=3, Ref=4, Cajas=5, Peso=6
    // Actualizar columnas: FECHA(3), ID_CLIENTE(4), REF(5), CAJAS(6), PESO(7) (Base 1)
    // En array base 0: Fecha=2, Cliente=3, Ref=4, Cajas=5, Peso=6
    // OPTIMIZACION: Escribir en una sola linea
    sheetHeader.getRange(rowIndex + 1, 3, 1, 5).setValues([[
      new Date(data.fecha),
      data.idCliente,
      data.docReferencia,
      data.totalCajas,
      data.totalPeso
    ]]);
    
    // 2. Borrar detalles viejos
    const details = sheetDetail.getDataRange().getValues();
    // Borrar de abajo hacia arriba para mantener indices
    for (let i = details.length - 1; i >= 1; i--) {
      if (String(details[i][1]) === String(data.id)) {
        sheetDetail.deleteRow(i + 1);
      }
    }
    
    // 3. Insertar nuevos detalles
    const multiplicador = data.tipo === 'SALIDA' ? -1 : 1;
    const nuevosDetalles = data.productos.map(p => [
        Utilities.getUuid(),
        data.id,
        p.idProducto,
        p.lote,
        '', 
        p.fechaVencimiento || '', 
        Math.abs(p.cantidadCajas) * multiplicador, 
        Math.abs(p.pesoKg) * multiplicador
    ]);
    
    if (nuevosDetalles.length > 0) {
      sheetDetail.getRange(sheetDetail.getLastRow() + 1, 1, nuevosDetalles.length, nuevosDetalles[0].length).setValues(nuevosDetalles);
    }
    
    // INVALIDAR CACHÉ
    clearCache('DASH_DATA_' + data.idCliente);
    clearCache('INV_DATA_' + data.idCliente);
    clearCache('STOCK_DATA_' + data.idCliente);

    return { success: true, message: "Movimiento actualizado." };
    
  } catch(e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ======================================================
// 5. HELPERS Y FUNCIONES DE SOPORTE (MAESTROS)
// ======================================================

function apiGetProductos(idCliente) {
  try {
  // CACHE CHECK
  const cacheKey = 'PRODUCTOS_DATA_' + (idCliente || 'ALL');
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const data = ss.getSheetByName('DIM_PRODUCTOS').getDataRange().getValues();
  data.shift();
  
  let productos = data.map(row => ({ 
    id: row[0], 
    idCliente: row[1],
    nombre: row[2], 
    pesoNominal: row[3], 
    empaque: row[4] 
  }));
  
  // Filtrar por cliente si se proporciona
  if (idCliente) {
    productos = productos.filter(p => p.idCliente === idCliente);
  }
  
  saveToCache(cacheKey, productos);
  return productos;
  } catch (e) {
    Logger.log("Error apiGetProductos: " + e);
    return [];
  }
}

/**
 * Obtiene clientes con su información de contrato activa
 */
function apiGetClientes() {
  try {
    // CACHE CHECK
    const cached = getFromCache('CLIENTES_DATA');
    if (cached) return cached;
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // 1. Leer Clientes
  const dataCli = ss.getSheetByName('DIM_CLIENTES').getDataRange().getValues();
  dataCli.shift(); // Quitar header
  
  // 2. Leer Contratos
  const dataCon = ss.getSheetByName('DIM_CONTRATOS').getDataRange().getValues();
  // Crear mapa: ID_CLIENTE -> { posiciones, precio, exceso, tipoPago, precioDiaPosicion }
  const mapaContratos = {};
  dataCon.forEach(r => {
    if(r[7] === 'ACTIVO') { // Solo contratos activos
       mapaContratos[r[1]] = { 
         posiciones: r[2], 
         precio: r[4], 
         exceso: r[5],
         tipoPago: r[8] || 'PREPAGO',              // NUEVO: Default PREPAGO si no existe
         precioDiaPosicion: r[9] || 0               // NUEVO: Precio por posición/día
       };
    }
  });

  // 3. Fusionar
  const resultado = dataCli.map(row => ({
    id: row[0],
    nombre: row[1],
    nit: row[2],
    email: row[3] || '',
    telefono: row[4] || '',
    contratoInfo: mapaContratos[row[0]] || null
  }));

  saveToCache('CLIENTES_DATA', resultado);
  return resultado;

  } catch (e) {
    Logger.log("Error apiGetClientes: " + e);
    return [];
  }
}
// ======================================================
// CACHE HELPERS
// ======================================================
function clearCache(key) {
   try { CacheService.getScriptCache().remove(key); } catch(e) {}
}

function getFromCache(key) {
   try {
     const cached = CacheService.getScriptCache().get(key);
     if (cached) return JSON.parse(cached);
   } catch(e) {}
   return null;
}

function saveToCache(key, data, seconds = 21600) { // 6 horas default
   try { CacheService.getScriptCache().put(key, JSON.stringify(data), seconds); } catch(e) {}
}

function apiGetDataInicial() {
  return { clientes: apiGetClientes(), productos: apiGetProductos() };
}

function apiGuardarMovimiento(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  validateSchema(data, 'MOVIMIENTO');
  const res = registrarMovimiento(data);
  
  if (res.success && data.idCliente) {
     clearCache('DASH_DATA_' + data.idCliente);
     clearCache('INV_DATA_' + data.idCliente);
     clearCache('STOCK_DATA_' + data.idCliente);
     
     // CRÍTICO: Invalidar caché global también
     clearCache('STOCK_DATA_ALL');
  }
  return res;
}

function apiGuardarCliente(form) { 
   validateSchema(form, 'CLIENTE');
   const res = registrarCliente(form);
   if (res.success) clearCache('CLIENTES_DATA');
   return res;
}
function apiGuardarProducto(form) { 
   const res = registrarProducto(form);
   if (res.success) {
     clearCache('PRODUCTOS_DATA_ALL');
     clearCache('STOCK_DATA_ALL'); // Nueva caché global de stock
     if (form.idCliente) {
       clearCache('PRODUCTOS_DATA_' + form.idCliente);
       clearCache('STOCK_DATA_' + form.idCliente);
     }
   }
   return res;
}
function apiGuardarProductosBatch(lista, idCliente) { 
   const res = registrarProductosMasivo(lista, idCliente);
   if (res.success) {
      clearCache('PRODUCTOS_DATA_ALL');
      clearCache('STOCK_DATA_ALL'); // Nueva caché global de stock
      if (idCliente) {
         clearCache('PRODUCTOS_DATA_' + idCliente);
         clearCache('STOCK_DATA_' + idCliente);
      }
   }
   return res;
}

function apiActualizarProducto(form) {
    // Validaciones básicas
    if (!form.id || !form.idCliente) return { success: false, error: "Datos incompletos" };
    
    const res = actualizarProductoDB(form);
    
    if (res.success) {
        clearCache('PRODUCTOS_DATA_ALL'); 
        clearCache('STOCK_DATA_ALL');
        clearCache('PRODUCTOS_DATA_' + form.idCliente);
        clearCache('STOCK_DATA_' + form.idCliente);
    }
    return res;
}

/**
 * Guarda Cliente + Contrato Inicial
 */
// (Función registrarCliente eliminada para usar la versión de Database.gs)


function apiActualizarCliente(data) {
  validateSchema(data, 'CLIENTE');
  // Asegurar que los números sean números y no texto "10"
  data.posiciones = Number(data.posiciones);
  data.precioPosicion = Number(data.precioPosicion);
  data.precioExceso = Number(data.precioExceso);
  
  const res = actualizarClienteDB(data);
  if (res.success) clearCache('CLIENTES_DATA');
  return res;
}

// ======================================================
// 6. MÓDULO DE FACTURACIÓN
// ======================================================

function apiCalcularFacturacion(idCliente, fechaInicio, fechaFin) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // 1. Obtener Contrato
  const clientes = apiGetClientes();
  const cliente = clientes.find(c => String(c.id) === String(idCliente));
  if (!cliente || !cliente.contratoInfo) throw new Error("Cliente no tiene contrato activo.");
  
  const contrato = cliente.contratoInfo;
  
  // 2. Obtener Historial Completo para reconstruir saldos
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  
  // MAPA DE CAMBIOS POR FECHA PARA O(1) LOOKUP
  // mapCambios[timestamp_midnight] = delta_peso
  const mapCambios = new Map();
  
  // Pre-procesar movimientos (Header)
  const mapMovFecha = {};
  headers.slice(1).forEach(r => {
    if (String(r[3]) === String(idCliente)) {
      const d = new Date(r[2]);
      d.setHours(0,0,0,0);
      mapMovFecha[r[0]] = d.getTime();
    }
  });
  
  // Pre-procesar detalles para llenar Mapa
  details.slice(1).forEach(r => {
    const idMov = r[1];
    const fechaMs = mapMovFecha[idMov];
    
    if (fechaMs !== undefined) { // Solo si es del cliente
      const peso = Number(r[7] || 0); 
      // Acumular cambio en esa fecha
      const actual = mapCambios.get(fechaMs) || 0;
      mapCambios.set(fechaMs, actual + peso);
    }
  });

  // 3. Simulación Día a Día (Optimizada)
  const start = new Date(fechaInicio); start.setHours(0,0,0,0);
  const end = new Date(fechaFin); end.setHours(0,0,0,0);
  const startMs = start.getTime();
  const endMs = end.getTime();
  
  // A. Calcular saldo inicial (Todo lo anterior al inicio)
  let saldoKg = 0;
  for (const [fechaMs, deltaPeso] of mapCambios) {
    if (fechaMs < startMs) {
      saldoKg += deltaPeso;
    }
  }

  const detalle = [];
  let costoBaseTotal = 0;
  let costoExcedenteTotal = 0;
  let diasConExcedente = 0;

  // B. Bucle principal (Solo itera los días del rango)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const todayMs = d.getTime();
    
    // Aplicar cambios del día (O(1))
    if (mapCambios.has(todayMs)) {
      saldoKg += mapCambios.get(todayMs);
    }
    
    // Evitar saldos negativos por errores de datos
    const stockDia = Math.max(0, saldoKg);
    
    // Cálculos de Negocio
    const posUsadas = stockDia / 800; // Factor 800
    const excedentePos = Math.max(0, posUsadas - contrato.posiciones);
    
    // Excedente en Kilogramos
    const excedenteKg = Math.max(0, stockDia - (contrato.posiciones * 800));
    
    let costoBaseDia = 0;
    let costoExcDia = 0;
    
    if (contrato.tipoPago === 'PREPAGO') {
      costoBaseDia = (contrato.precio / 30);
      costoExcDia = excedenteKg * contrato.exceso;
    } else {
      // POSTPAGO
      costoBaseDia = posUsadas * contrato.precioDiaPosicion;
      costoExcDia = 0; 
    }
    
    const totalDia = costoBaseDia + costoExcDia;
    
    costoBaseTotal += costoBaseDia;
    costoExcedenteTotal += costoExcDia;
    if (excedentePos > 0 && contrato.tipoPago === 'PREPAGO') diasConExcedente++;

    detalle.push({
      fecha: new Date(d).toISOString(),
      stockKg: stockDia,
      posUsadas: posUsadas,
      posContratadas: contrato.posiciones,
      excedente: contrato.tipoPago === 'PREPAGO' ? excedentePos : 0,
      excedenteKg: contrato.tipoPago === 'PREPAGO' ? excedenteKg : 0,
      costoDia: totalDia,
      costoBaseDia: costoBaseDia,
      costoExcDia: costoExcDia,
      tipoCobro: contrato.tipoPago
    });
  }

  return {
    success: true,
    dias: detalle.length,
    costoBase: costoBaseTotal,
    costoExcedente: costoExcedenteTotal,
    diasConExcedente: diasConExcedente,
    totalPagar: costoBaseTotal + costoExcedenteTotal,
    detalleDiario: detalle,
    tipoPago: contrato.tipoPago,
    contrato: contrato
  };
  } catch (e) {
     Logger.log("Error apiCalcularFacturacion: " + e);
     return { success: false, error: e.toString() };
  }
}

// ======================================================
// 7. GENERACIÓN DE PDFs DE FACTURACIÓN
// ======================================================

/**
 * API: Genera PDF de facturación en formato RESUMEN EJECUTIVO
 * 
 * @param {Object} payload - Datos de facturación desde el frontend
 * @returns {Object} Objeto con success y URL del PDF generado
 */
function apiGenerarPDFFacturaResumen(payload) {
  try {
    Logger.log("Generando PDF de Factura Resumen...");
    
    // Validar datos requeridos
    if (!payload.cliente || !payload.periodo || !payload.metricas) {
      throw new Error("Datos incompletos para generar factura");
    }
    
    // Generar ID único para la factura
    const timestamp = new Date().getTime();
    const idFactura = `FACT-RES-${payload.cliente.id}-${timestamp}`;
    
    // Generar PDF usando el servicio
    const urlPdf = generarFacturaResumenPDF(idFactura, payload);
    
    // Verificar si hubo error
    if (urlPdf.startsWith('Error')) {
      return { success: false, error: urlPdf };
    }
    
    Logger.log(`PDF Resumen generado exitosamente: ${urlPdf}`);
    
    return {
      success: true,
      message: "PDF de Resumen Ejecutivo generado correctamente",
      pdfUrl: urlPdf,
      idFactura: idFactura
    };
    
  } catch (e) {
    Logger.log("Error en apiGenerarPDFFacturaResumen: " + e.toString());
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * API: Genera PDF de facturación en formato DETALLADO
 * 
 * @param {Object} payload - Datos completos de facturación con tabla día a día
 * @returns {Object} Objeto con success y URL del PDF generado
 */
function apiGenerarPDFFacturaDetallada(payload) {
  try {
    Logger.log("Generando PDF de Factura Detallada...");
    
    // Validar datos requeridos
    if (!payload.cliente || !payload.periodo || !payload.metricas || !payload.detalleDiario) {
      throw new Error("Datos incompletos para generar factura detallada");
    }
    
    // Generar ID único para la factura
    const timestamp = new Date().getTime();
    const idFactura = `FACT-DET-${payload.cliente.id}-${timestamp}`;
    
    // Generar PDF usando el servicio
    const urlPdf = generarFacturaDetalladaPDF(idFactura, payload);
    
    // Verificar si hubo error
    if (urlPdf.startsWith('Error')) {
      return { success: false, error: urlPdf };
    }
    
    Logger.log(`PDF Detallado generado exitosamente: ${urlPdf}`);
    
    return {
      success: true,
      message: "PDF Detallado generado correctamente",
      pdfUrl: urlPdf,
      idFactura: idFactura
    };
    
  } catch (e) {
    Logger.log("Error en apiGenerarPDFFacturaDetallada: " + e.toString());
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * API: Genera Reporte de Stock Actual por Cliente
 */
function apiGenerarReporteStock(idCliente) {
  try {
     // 1. Obtener Datos
     const productos = apiGetProductosConStock(idCliente);
     const clientes = apiGetClientes();
     const cliente = clientes.find(c => String(c.id) === String(idCliente));
     
     if (!cliente) throw new Error("Cliente no encontrado");
     
     // 2. Ordenar Descendente por PESO (Mayor stock a menor)
     productos.sort((a, b) => (parseFloat(b.stockPeso) || 0) - (parseFloat(a.stockPeso) || 0));
     
     // 3. Generar PDF
     // Como no existe aún la funcion generarReporteStockPDF, la asumiremos en Service_PDF
     const urlPdf = generarReporteStockPDF(cliente, productos);
     
     if (urlPdf.startsWith('Error')) throw new Error(urlPdf);
     
     return { success: true, pdfUrl: urlPdf };
     
  } catch (e) {
    Logger.log("Error apiGenerarReporteStock: " + e);
    return { success: false, error: e.toString() }; 
  }
}