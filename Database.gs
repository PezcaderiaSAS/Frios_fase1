/**
 * Genera IDs únicos (Auto-incrementales) de forma segura ante concurrencia
 */
function generateNextId(sheetName, prefix) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    // CORRECCIÓN: Usamos CONFIG.SPREADSHEET_ID
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    // Si la hoja no existe o está vacía
    if (!sheet || sheet.getLastRow() < 2) return prefix + "001";
    
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`); 

    ids.forEach(id => {
      const match = id.toString().match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    return prefix + (maxNum + 1).toString().padStart(3, '0');

  } catch (e) {
    Logger.log("Error ID: " + e);
    throw new Error("Error generando ID: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda el movimiento y genera el PDF
 */
function registrarMovimiento(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // CORRECCIÓN: Usamos CONFIG.SPREADSHEET_ID
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const headerSheet = ss.getSheetByName('MOV_HEADER');
    const detailSheet = ss.getSheetByName('MOV_DETAIL');
    
    // 1. Generar ID Único
    const prefix = data.tipo === 'ENTRADA' ? 'MOV-IN-' : 'MOV-OUT-';
    const idMovimiento = generateNextId('MOV_HEADER', prefix);
    
    // 2. Preparar Datos para PDF (Inicial)
    const datosParaPDF = {
      id: idMovimiento,
      fecha: new Date(),
      cliente: data.nombreCliente || data.idCliente, 
      tipo: data.tipo,
      docReferencia: data.docReferencia,
      items: data.productos,
      totalCajas: data.totalCajas,
      totalPeso: data.totalPeso,
      totalStockCajas: 0, // Placeholder
      totalStockPeso: 0   // Placeholder
    };

    // 2b. Calcular Stock Restante Simulando el Movimiento
    // (Llamamos a la API de Controller que ya lee de la hoja, pero necesitamos inyectar este movimiento 
    // porque aún no se ha guardado en Sheet). 
    // ESTRATEGIA: Obtener inventario actual y sumar/restar este movimiento.
    try {
        const inventarioActual = apiGetInventarioCliente(data.idCliente);
        let stockCajas = inventarioActual.reduce((acc, i) => acc + i.cajas, 0);
        let stockPeso = inventarioActual.reduce((acc, i) => acc + i.peso, 0);
        
        if (data.tipo === 'ENTRADA') {
            stockCajas += Number(data.totalCajas);
            stockPeso += Number(data.totalPeso);
        } else {
            stockCajas -= Number(data.totalCajas);
            stockPeso -= Number(data.totalPeso);
        }
        
        datosParaPDF.totalStockCajas = stockCajas.toFixed(1);
        datosParaPDF.totalStockPeso = stockPeso.toFixed(2);
    } catch (errStock) {
        Logger.log("Error calculando stock para PDF: " + errStock);
    }

    // 3. Generar PDF (Asegúrate de tener el archivo Service_PDF.gs creado)
    let urlPdf = '';
    try {
      urlPdf = generarReciboPDF(idMovimiento, datosParaPDF);
    } catch (pdfErr) {
      console.log("Error PDF: " + pdfErr);
      urlPdf = "Error generando PDF";
    }

    // 4. Guardar Cabecera
    headerSheet.appendRow([
      idMovimiento,
      data.tipo,
      new Date(),
      data.idCliente,
      data.docReferencia || 'S/N',
      data.totalCajas,
      data.totalPeso,
      urlPdf, 
      Session.getActiveUser().getEmail()
    ]);

    // 5. Guardar Detalles
    const detallesRows = data.productos.map(p => [
        Utilities.getUuid(),
        idMovimiento,
        p.idProducto,
        p.lote,
        '', 
        p.fechaVencimiento || '', 
        p.cantidadCajas, 
        p.pesoKg
    ]);

    if (detallesRows.length > 0) {
      detailSheet.getRange(detailSheet.getLastRow() + 1, 1, detallesRows.length, detallesRows[0].length).setValues(detallesRows);
    }
    
    return { success: true, id: idMovimiento, pdfUrl: urlPdf, message: "Guardado exitoso" };

  } catch (e) {
    Logger.log(e);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda un nuevo cliente y crea su contrato base de posiciones
 */
function registrarCliente(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetCli = ss.getSheetByName('DIM_CLIENTES');
    const sheetCon = ss.getSheetByName('DIM_CONTRATOS'); // Asegúrate que esta hoja exista
    
    // 1. Generar ID Cliente: CLI-001
    const idCliente = generateNextId('DIM_CLIENTES', 'CLI');
    
    // 2. Guardar Cliente
    sheetCli.appendRow([
      idCliente,
      data.nombre,
      data.nit,
      data.email || '',
      data.telefono || '',
      'ACTIVO'
    ]);

    // 3. Crear Contrato Inicial (Si se definieron posiciones)
    if (data.posiciones > 0) {
      const idContrato = generateNextId('DIM_CONTRATOS', 'CTR');
      sheetCon.appendRow([
        idContrato,
        idCliente,
        data.posiciones,   // Posiciones contratadas
        800,               // Factor estándar (800kg por posición)
        450000,            // Precio estándar (puedes parametrizarlo luego)
        85,                // Precio exceso día
        new Date(),        // Fecha inicio
        'ACTIVO'
      ]);
    }
    
    return { success: true, message: `Cliente ${data.nombre} creado con éxito.` };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda un nuevo producto en DIM_PRODUCTOS
 */
function registrarProducto(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_PRODUCTOS');
    
    // Generar ID: PRO-001
    const id = generateNextId('DIM_PRODUCTOS', 'PRO');
    
    // Orden columnas: [ID, NOMBRE, PESO_NOMINAL, EMPAQUE]
    sheet.appendRow([
      id,
      data.nombre,
      data.pesoNominal,
      data.empaque
    ]);
    
    return { success: true, message: 'Producto creado: ' + id };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra múltiples productos de una sola vez
 * Optimizado para rendimiento y generación de IDs consecutivos
 */
function registrarProductosMasivo(listaProductos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Espera hasta 30s si hay otro usuario guardando

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_PRODUCTOS');
    
    // 1. Obtener el último número de ID actual para calcular la secuencia
    const dataIds = sheet.getRange("A2:A" + sheet.getLastRow()).getValues().flat();
    let maxId = 0;
    const regex = /^PRO(\d+)$/; // Patrón PRO + Números

    dataIds.forEach(id => {
      if (id) {
        const match = id.toString().match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      }
    });

    // 2. Preparar filas para inserción masiva
    const nuevasFilas = listaProductos.map((prod, index) => {
      // Calculamos ID consecutivo: Máximo actual + 1 + índice en el array
      const siguienteNum = maxId + 1 + index;
      const nuevoId = 'PRO' + siguienteNum.toString().padStart(3, '0');
      
      return [
        nuevoId,            // A: ID
        prod.nombre,        // B: Nombre
        prod.pesoNominal,   // C: Peso
        prod.empaque        // D: Empaque
      ];
    });

    // 3. Escribir en bloque (Mucho más rápido que appendRow uno por uno)
    if (nuevasFilas.length > 0) {
      sheet.getRange(
        sheet.getLastRow() + 1, 
        1, 
        nuevasFilas.length, 
        nuevasFilas[0].length
      ).setValues(nuevasFilas);
    }
    
    return { success: true, message: `✅ Se registraron ${nuevasFilas.length} productos nuevos.` };

  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza los datos de un Cliente y su Contrato Activo (VERSIÓN BLINDADA)
 */
function actualizarClienteDB(data) {
  const lock = LockService.getScriptLock();
  // Esperar hasta 10s para evitar choques de escritura
  lock.waitLock(10000);
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetCli = ss.getSheetByName('DIM_CLIENTES');
    const sheetCon = ss.getSheetByName('DIM_CONTRATOS');
    
    // ---------------------------------------------------------
    // 1. ACTUALIZAR DATOS MAESTROS (DIM_CLIENTES)
    // ---------------------------------------------------------
    const dataCli = sheetCli.getDataRange().getValues();
    // Convertimos ambos a String y usamos trim() para limpiar espacios
    const rowIndexCli = dataCli.findIndex(r => String(r[0]).trim() === String(data.id).trim());
    
    if (rowIndexCli === -1) {
      throw new Error("Error Crítico: No se encontró el ID de cliente " + data.id);
    }
    
    // Actualizamos columnas: Nombre(B), NIT(C), Email(D), Teléfono(E)
    sheetCli.getRange(rowIndexCli + 1, 2, 1, 4).setValues([[
      data.nombre,
      data.nit,
      data.email || '',
      data.telefono || ''
    ]]);

    // ---------------------------------------------------------
    // 2. ACTUALIZAR O CREAR CONTRATO (DIM_CONTRATOS)
    // ---------------------------------------------------------
    const dataCon = sheetCon.getDataRange().getValues();
    
    // Buscar contrato donde ID_CLIENTE coincida y Estado sea ACTIVO
    const rowIndexCon = dataCon.findIndex(r => 
      String(r[1]).trim() === String(data.id).trim() && 
      String(r[7]).toUpperCase() === 'ACTIVO'
    );
    
    const valoresContrato = [
      Number(data.posiciones), // Posiciones
      800,                     // Factor (Fijo)
      Number(data.precioPosicion),
      Number(data.precioExceso)
    ];

    if (rowIndexCon !== -1) {
      // SI EXISTE: Actualizar columnas Posiciones(C) a PrecioExceso(F)
      sheetCon.getRange(rowIndexCon + 1, 3, 1, 4).setValues([valoresContrato]);
    } else {
      // SI NO EXISTE: Crear uno nuevo para no perder los datos
      const nuevoIdContrato = generateNextId('DIM_CONTRATOS', 'CTR');
      sheetCon.appendRow([
        nuevoIdContrato,
        data.id,
        valoresContrato[0], // Posiciones
        valoresContrato[1], // Factor
        valoresContrato[2], // Precio Pos
        valoresContrato[3], // Precio Exc
        new Date(),
        'ACTIVO'
      ]);
    }
    
    // ---------------------------------------------------------
    // 3. FORZAR GUARDADO
    // ---------------------------------------------------------
    SpreadsheetApp.flush(); // <--- ESTO ES VITAL: Obliga a Sheets a escribir YA.
    
    return { success: true, message: "✅ Cliente y contrato actualizados correctamente." };

  } catch(e) {
    Logger.log("Error en update: " + e);
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

