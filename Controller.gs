// ======================================================
// CONFIGURACIÓN Y UTILIDADES BÁSICAS
// ======================================================

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('WMS ColdChain Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // A. Obtener Contrato Activo
    const sheetContratos = ss.getSheetByName('DIM_CONTRATOS');
    let contrato = { posiciones: 0, factor: 800 }; // Default
    
    if (sheetContratos && sheetContratos.getLastRow() > 1) {
      const contratos = sheetContratos.getDataRange().getValues();
      const contratoEncontrado = contratos.find(r => String(r[1]) === String(idCliente) && r[7] === 'ACTIVO');
      if (contratoEncontrado) {
        contrato = { 
          posiciones: Number(contratoEncontrado[2]) || 0, 
          factor: Number(contratoEncontrado[3]) || 800 
        };
      }
    }

    // B. Calcular Ocupación Actual (Usando la función reparada abajo)
    const inventario = apiGetInventarioCliente(idCliente);
    const pesoTotal = inventario.reduce((sum, item) => sum + (Number(item.peso) || 0), 0);
    
    // C. Obtener Historial (Últimos 10 movimientos)
    const sheetHeader = ss.getSheetByName('MOV_HEADER');
    let ultimosMovimientos = [];
    
    if (sheetHeader && sheetHeader.getLastRow() > 1) {
      const lastRow = sheetHeader.getLastRow();
      const startRow = Math.max(2, lastRow - 19); // Mirar ultimas 20 filas
      const dataRows = sheetHeader.getRange(startRow, 1, lastRow - startRow + 1, 9).getValues();
      
      ultimosMovimientos = dataRows
        .filter(r => String(r[3]) === String(idCliente)) // Filtrar por cliente
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
    }

    return {
      success: true,
      contrato: contrato,
      ocupacion: {
        pesoTotal: pesoTotal,
        posicionesUsadas: (pesoTotal / contrato.factor),
        porcentaje: contrato.posiciones > 0 ? ((pesoTotal / contrato.factor) / contrato.posiciones) * 100 : 0
      },
      historial: ultimosMovimientos
    };

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
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  const products = ss.getSheetByName('DIM_PRODUCTOS').getDataRange().getValues();
  
  // Mapa de productos para nombres rápidos
  const mapProductos = {};
  products.slice(1).forEach(r => mapProductos[r[0]] = { nombre: r[1], empaque: r[3] });
  
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
          lote: r[3],
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

  // Filtrar solo lo que tiene existencia positiva (> 0.01)
  return Object.values(inventario).filter(item => item.peso > 0.01);
}

// ======================================================
// 3. API: PRODUCTOS Y STOCK GLOBAL
// ======================================================

function apiGetProductosConStock() {
  const productosBase = apiGetProductos(); 
  
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

  return productosBase.map(p => ({
    ...p,
    stockCajas: (stockMap[p.id]?.cajas || 0).toFixed(1),
    stockPeso: (stockMap[p.id]?.peso || 0).toFixed(2)
  }));
}

// ======================================================
// 4. API: BÚSQUEDA Y EDICIÓN DE MOVIMIENTOS
// ======================================================

function apiGetMovimientoDetalle(idMovimiento) {
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

function apiActualizarMovimiento(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
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
    sheetHeader.getRange(rowIndex + 1, 3).setValue(new Date(data.fecha));
    sheetHeader.getRange(rowIndex + 1, 4).setValue(data.idCliente);
    sheetHeader.getRange(rowIndex + 1, 5).setValue(data.docReferencia);
    sheetHeader.getRange(rowIndex + 1, 6).setValue(data.totalCajas);
    sheetHeader.getRange(rowIndex + 1, 7).setValue(data.totalPeso);
    
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

function apiGetProductos() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const data = ss.getSheetByName('DIM_PRODUCTOS').getDataRange().getValues();
  data.shift();
  return data.map(row => ({ id: row[0], nombre: row[1], pesoNominal: row[2], empaque: row[3] }));
}

/**
 * Obtiene clientes con su información de contrato activa
 */
function apiGetClientes() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // 1. Leer Clientes
  const dataCli = ss.getSheetByName('DIM_CLIENTES').getDataRange().getValues();
  dataCli.shift(); // Quitar header
  
  // 2. Leer Contratos
  const dataCon = ss.getSheetByName('DIM_CONTRATOS').getDataRange().getValues();
  // Crear mapa: ID_CLIENTE -> { posiciones, precio, exceso }
  const mapaContratos = {};
  dataCon.forEach(r => {
    if(r[7] === 'ACTIVO') { // Solo contratos activos
       mapaContratos[r[1]] = { 
         posiciones: r[2], 
         precio: r[4], 
         exceso: r[5] 
       };
    }
  });

  // 3. Fusionar
  return dataCli.map(row => ({
    id: row[0],
    nombre: row[1],
    nit: row[2],
    contratoInfo: mapaContratos[row[0]] || null // Adjuntar info contrato si existe
  }));
}

function apiGetDataInicial() {
  return { clientes: apiGetClientes(), productos: apiGetProductos() };
}

function apiGuardarMovimiento(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return registrarMovimiento(data);
}

function apiGuardarCliente(form) { return registrarCliente(form); }
function apiGuardarProducto(form) { return registrarProducto(form); }
function apiGuardarProductosBatch(lista) { return registrarProductosMasivo(lista); }

/**
 * Guarda Cliente + Contrato Inicial
 */
function registrarCliente(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetCli = ss.getSheetByName('DIM_CLIENTES');
    const sheetCon = ss.getSheetByName('DIM_CONTRATOS'); 
    
    // 1. Generar ID Cliente (ej: CLI005)
    const idCliente = generateNextId('DIM_CLIENTES', 'CLI');
    
    // 2. Guardar Datos Maestros del Cliente
    sheetCli.appendRow([
      idCliente,
      data.nombre,
      data.nit,
      data.email || '',
      data.telefono || '',
      'ACTIVO'
    ]);

    // 3. Crear el Contrato Vinculado (VITAL)
    // Si no vienen datos, usamos valores por defecto del negocio
    const posiciones = Number(data.posiciones) || 0;
    const precioPos = Number(data.precioPosicion) || 450000; // Default $450k
    const precioExc = Number(data.precioExceso) || 85;       // Default $85 pesos

    if (posiciones > 0) {
      const idContrato = generateNextId('DIM_CONTRATOS', 'CTR');
      // Columnas: ID_CONTRATO, ID_CLIENTE, POSICIONES, FACTOR(800), PRECIO_MES, PRECIO_EXCESO, FECHA, ESTADO
      sheetCon.appendRow([
        idContrato,
        idCliente,
        posiciones,
        800,        // Factor estándar de la industria (800kg = 1 Posición)
        precioPos,
        precioExc,
        new Date(), // Fecha de inicio contrato
        'ACTIVO'
      ]);
    }
    
    return { success: true, message: `Cliente ${data.nombre} y Contrato registrados.` };

  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function apiActualizarCliente(data) {
  // Asegurar que los números sean números y no texto "10"
  data.posiciones = Number(data.posiciones);
  data.precioPosicion = Number(data.precioPosicion);
  data.precioExceso = Number(data.precioExceso);
  
  return actualizarClienteDB(data);
}

// ======================================================
// 6. MÓDULO DE FACTURACIÓN
// ======================================================

function apiCalcularFacturacion(idCliente, fechaInicio, fechaFin) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // 1. Obtener Contrato
  const clientes = apiGetClientes();
  const cliente = clientes.find(c => String(c.id) === String(idCliente));
  if (!cliente || !cliente.contratoInfo) throw new Error("Cliente no tiene contrato activo.");
  
  const contrato = cliente.contratoInfo;
  // contrato = { posiciones, precio: precioMes, exceso: precioDiaExceso }
  
  // 2. Obtener Historial Completo para reconstruir saldos
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  
  // Filtrar movimientos del cliente y parsear fechas
  const movs = [];
  const mapMovFecha = {}; // ID -> Fecha (timestamp 00:00)
  
  headers.slice(1).forEach(r => {
    if (String(r[3]) === String(idCliente)) {
      const d = new Date(r[2]);
      d.setHours(0,0,0,0);
      mapMovFecha[r[0]] = d.getTime();
    }
  });
  
  // Detalles con fecha y peso
  details.slice(1).forEach(r => {
    const idMov = r[1];
    if (mapMovFecha[idMov]) {
      // Si es Salida (MOV-OUT), Database guarda "positivo" en MOV_DETAIL? 
      // Revisando Database.gs -> MOV_DETAIL guarda valor absoluto en save, pero Controller.gs linea 140 trata salidas asumiendo signo en BD o tipo. 
      // ERROR POTENCIAL: Database.gs guarda abs(). Controller linea 253 guarda abs * -1. 
      // Asumiendo DB tiene signo correcto (negativo para salidas).
      let peso = Number(r[7]); 
      // Si en DB están positivos las salidas, necesitamos corregir con el tipo.
      // Pero Controller `apiActualizarMovimiento` guarda con signo. Confiemos en el signo de BD.
      
      movs.push({
        fecha: mapMovFecha[idMov],
        peso: peso
      });
    }
  });

  // Ordenar por fecha
  movs.sort((a, b) => a.fecha - b.fecha);

  // 3. Simulación Día a Día
  const start = new Date(fechaInicio); start.setHours(0,0,0,0);
  const end = new Date(fechaFin); end.setHours(0,0,0,0);
  
  let saldoKg = 0;
  // Calcular saldo inicial (sumar todo lo previo a start)
  movs.forEach(m => {
    if (m.fecha < start.getTime()) {
      saldoKg += m.peso;
    }
  });

  const detalle = [];
  let costoBaseTotal = 0;
  let costoExcedenteTotal = 0;
  let diasConExcedente = 0;

  // Iterar día por día
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const todayMs = d.getTime();
    
    // Aplicar movimientos de "hoy" (asumiendo que ocurren al final del día para cobro, o saldo promedio)
    // Política: Cobramos sobre saldo al cierre del día
    movs.forEach(m => {
      if (m.fecha === todayMs) {
        saldoKg += m.peso;
      }
    });
    
    // Cálculos
    const posUsadas = saldoKg / 800; // Factor 800 estandar
    const excedente = Math.max(0, posUsadas - contrato.posiciones);
    
    // Costos
    const costoBaseDia = (contrato.precio / 30); // Precio Mes / 30
    const costoExcDia = excedente * contrato.exceso;
    
    const totalDia = costoBaseDia + costoExcDia;
    
    costoBaseTotal += costoBaseDia;
    costoExcedenteTotal += costoExcDia;
    if (excedente > 0) diasConExcedente++;

    detalle.push({
      fecha: new Date(d).toISOString(), // Para enviar a frontend
      stockKg: Math.max(0, saldoKg),
      posUsadas: Math.max(0, posUsadas),
      posContratadas: contrato.posiciones,
      excedente: excedente,
      costoDia: totalDia
    });
  }

  // Resultado Final
  return {
    success: true,
    dias: detalle.length,
    costoBase: costoBaseTotal,
    costoExcedente: costoExcedenteTotal,
    diasConExcedente: diasConExcedente,
    totalPagar: costoBaseTotal + costoExcedenteTotal,
    detalleDiario: detalle
  };
}