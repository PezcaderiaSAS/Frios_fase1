/**
 * Genera IDs únicos (Auto-incrementales) leyendo la hoja directamente.
 * IMPORTANTE: Esta función asume que YA existe un bloqueo activo (LockService) manejado por el caller.
 * @requires LockService (en la función que llama a esta)
 */
function generateNextId(sheetName, prefix) {
  // NOTA: Se eliminó LockService interno para evitar liberar el bloqueo prematuramente.
  
  try {
    // CORRECCIÓN: Usamos CONFIG.SPREADSHEET_ID
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    // Si la hoja no existe o está vacía
    if (!sheet || sheet.getLastRow() < 2) return prefix + "001";
    
    // Optimización: Leer solo la columna 1 (IDs)
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
    
    // 0. AUTOGENERACIÓN DE LOTES (Solo ENTRADA)
    // Se ignora el lote que venga del frontend y se calcula el siguiente consecutivo
    if (data.tipo === 'ENTRADA') {
       const allDetails = detailSheet.getDataRange().getValues();
       // Mapa para rastrear el último lote por Producto
       const maxLotePorProducto = {};
       
       // Barrido para encontrar máximos actuales
       // Estructura DETAIL: [ID_DETALLE, ID_MOV, ID_PROD, LOTE, ...]
       // Saltamos header (fila 0)
       for (let i = 1; i < allDetails.length; i++) {
         const row = allDetails[i];
         const pId = String(row[2]);
         const loteRaw = row[3];
         
         // Intentar parsear como entero
         if (pId && loteRaw) {
           const loteNum = parseInt(loteRaw, 10);
           if (!isNaN(loteNum)) {
             if (!maxLotePorProducto[pId] || loteNum > maxLotePorProducto[pId]) {
               maxLotePorProducto[pId] = loteNum;
             }
           }
         }
       }
       
       // Asignar nuevos lotes a los productos entrantes
       data.productos.forEach(p => {
         const pId = String(p.idProducto);
         const currentMax = maxLotePorProducto[pId] || 0;
         const nextLote = currentMax + 1;
         
         p.lote = nextLote; // ASIGNACIÓN FORZADA
         
         // Actualizar mapa por si el mismo producto viene varias veces en este payload
         maxLotePorProducto[pId] = nextLote;
       });
    }
    
    // 0. VALIDACIÓN DE INTEGRIDAD REFERENCIAL (Trust no one)
    // ss ya está definido arriba
    const prodSheet = ss.getSheetByName('DIM_PRODUCTOS');
    const existingProds = new Set(prodSheet.getRange(2, 1, prodSheet.getLastRow()-1, 1).getValues().flat().map(String));
    
    for (let p of data.productos) {
        if (!existingProds.has(String(p.idProducto))) {
             throw new Error(`Integridad Violada: El producto ${p.idProducto} no existe en la base de datos.`);
        }
    }

    // (headerSheet y detailSheet ya definidos arriba)
    
    // 1. Generar ID Único
    const prefix = data.tipo === 'ENTRADA' ? 'MOV-IN-' : 'MOV-OUT-';
    const idMovimiento = generateNextId('MOV_HEADER', prefix);
    
    // 1b. Enriquecer productos con nombres desde el catálogo
    const prodData = prodSheet.getDataRange().getValues();
    const mapProductos = {};
    prodData.slice(1).forEach(row => {
        // [ID_PRODUCTO, ID_CLIENTE, NOMBRE, PESO_NOMINAL, EMPAQUE]
        mapProductos[row[0]] = { nombre: row[2], empaque: row[4] };
    });
    
    const productosEnriquecidos = data.productos.map(p => ({
        ...p,
        nombreProducto: mapProductos[p.idProducto]?.nombre || p.idProducto,
        empaque: mapProductos[p.idProducto]?.empaque || 'Unidad'
    }));
    
    // 2. Preparar Datos para PDF (Inicial)
    const datosParaPDF = {
      id: idMovimiento,
      fecha: new Date(),
      cliente: data.nombreCliente || data.idCliente, 
      tipo: data.tipo,
      docReferencia: data.docReferencia,
      items: productosEnriquecidos,
      totalCajas: data.totalCajas,
      totalPeso: data.totalPeso,
      totalStockCajas: 0,
      totalStockPeso: 0
    };

    // 2b. Calcular Stock Restante Total Y por Producto
    try {
        const inventarioActual = apiGetInventarioCliente(data.idCliente);
        let stockCajas = inventarioActual.reduce((acc, i) => acc + i.cajas, 0);
        let stockPeso = inventarioActual.reduce((acc, i) => acc + i.peso, 0);
        
        // Aplicar este movimiento al stock total
        if (data.tipo === 'ENTRADA') {
            stockCajas += Number(data.totalCajas);
            stockPeso += Number(data.totalPeso);
        } else {
            stockCajas -= Number(data.totalCajas);
            stockPeso -= Number(data.totalPeso);
        }
        
        datosParaPDF.totalStockCajas = stockCajas.toFixed(1);
        datosParaPDF.totalStockPeso = stockPeso.toFixed(2);
        
        // NUEVO: Calcular stock restante por producto/lote
        data.productos.forEach(producto => {
            const itemEnInventario = inventarioActual.find(inv => 
                inv.idProducto === producto.idProducto && String(inv.lote) === String(producto.lote)
            );
            
            let stockRestante = 0;
            if (itemEnInventario) {
                stockRestante = itemEnInventario.peso;
            }
            
            // Aplicar este movimiento específico
            if (data.tipo === 'ENTRADA') {
                stockRestante += Number(producto.pesoKg);
            } else {
                stockRestante -= Number(producto.pesoKg);
            }
            
            // Añadir al objeto producto
            producto.stockRestante = Math.max(0, stockRestante).toFixed(2);
        });
        
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
    
    SpreadsheetApp.flush(); // FORZAR ESCRITURA
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
 * ACTUALIZADO: Soporta TIPO_PAGO (PREPAGO/POSTPAGO) y PRECIO_DIA_POSICION
 */
function registrarCliente(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetCli = ss.getSheetByName('DIM_CLIENTES');
    const sheetCon = ss.getSheetByName('DIM_CONTRATOS'); // Asegúrate que esta hoja exista
    
    // VALIDACIÓN: Si es POSTPAGO, debe tener precio día posición
    if (data.tipoPago === 'POSTPAGO' && (!data.precioDiaPosicion || data.precioDiaPosicion <= 0)) {
      throw new Error('POSTPAGO requiere un PRECIO_DIA_POSICION mayor a 0');
    }
    
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
    if (data.posiciones > 0 || data.tipoPago === 'POSTPAGO') {
      const idContrato = generateNextId('DIM_CONTRATOS', 'CTR');
      
      // Valores con defaults seguros
      const tipoPago = data.tipoPago || 'PREPAGO';
      const precioDiaPosicion = data.precioDiaPosicion || 0;
      const precioPosicion = data.precioPosicion || 450000;
      const precioExceso = data.precioExceso || 85;
      
      sheetCon.appendRow([
        idContrato,
        idCliente,
        data.posiciones || 0,  // Posiciones contratadas (puede ser 0 para POSTPAGO)
        800,                   // Factor estándar (800kg por posición)
        precioPosicion,        // Precio mensual (PREPAGO) o base
        precioExceso,          // Precio exceso día
        new Date(),            // Fecha inicio
        'ACTIVO',              // Estado
        tipoPago,              // NUEVO: TIPO_PAGO (columna I)
        precioDiaPosicion      // NUEVO: PRECIO_DIA_POSICION (columna J)
      ]);
      
      Logger.log(`Contrato creado: ${idContrato} - Tipo: ${tipoPago}`);
    }
    
    SpreadsheetApp.flush(); // FORZAR ESCRITURA
    return { success: true, message: `Cliente ${data.nombre} creado con éxito.` };
  } catch(e) {
    Logger.log('Error en registrarCliente: ' + e.toString());
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda un nuevo producto en DIM_PRODUCTOS
 * ACTUALIZADO: Requiere ID_CLIENTE para relación 1:N
 */
function registrarProducto(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Validación: ID_CLIENTE es requerido
    if (!data.idCliente) {
      throw new Error("El campo ID_CLIENTE es obligatorio para crear un producto.");
    }
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_PRODUCTOS');
    
    // Validar que el cliente existe
    const sheetClientes = ss.getSheetByName('DIM_CLIENTES');
    const clientes = sheetClientes.getRange("A2:A" + sheetClientes.getLastRow()).getValues().flat();
    if (!clientes.includes(data.idCliente)) {
      throw new Error("El cliente " + data.idCliente + " no existe.");
    }
    
    // Generar ID: PRO-001
    const id = generateNextId('DIM_PRODUCTOS', 'PRO');
    
    // Orden columnas: [ID, ID_CLIENTE, NOMBRE, PESO_NOMINAL, EMPAQUE]
    sheet.appendRow([
      id,
      data.idCliente,
      data.nombre,
      data.pesoNominal,
      data.empaque
    ]);
    
    SpreadsheetApp.flush(); // FORZAR ESCRITURA
    return { success: true, message: 'Producto creado: ' + id };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra múltiples productos de una sola vez
 * ACTUALIZADO: Requiere ID_CLIENTE para todos los productos
 */
function registrarProductosMasivo(listaProductos, idCliente) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // Validación: ID_CLIENTE es requerido
    if (!idCliente) {
      throw new Error("El campo ID_CLIENTE es obligatorio para crear productos.");
    }
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_PRODUCTOS');
    
    // Validar que el cliente existe
    const sheetClientes = ss.getSheetByName('DIM_CLIENTES');
    const clientes = sheetClientes.getRange("A2:A" + sheetClientes.getLastRow()).getValues().flat();
    if (!clientes.includes(idCliente)) {
      throw new Error("El cliente " + idCliente + " no existe.");
    }
    
    // 1. Obtener el último número de ID actual
    const dataIds = sheet.getRange("A2:A" + sheet.getLastRow()).getValues().flat();
    let maxId = 0;
    const regex = /^PRO(\d+)$/;

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
      const siguienteNum = maxId + 1 + index;
      const nuevoId = 'PRO' + siguienteNum.toString().padStart(3, '0');
      
      return [
        nuevoId,            // A: ID
        idCliente,          // B: ID_CLIENTE (NUEVO)
        prod.nombre,        // C: Nombre
        prod.pesoNominal,   // D: Peso
        prod.empaque        // E: Empaque
      ];
    });

    // 3. Escribir en bloque
    if (nuevasFilas.length > 0) {
      sheet.getRange(
        sheet.getLastRow() + 1, 
        1, 
        nuevasFilas.length, 
        nuevasFilas[0].length
      ).setValues(nuevasFilas);
    }
    
    return { success: true, message: `✅ Se registraron ${nuevasFilas.length} productos para el cliente ${idCliente}.` };
    SpreadsheetApp.flush(); // FORZAR ESCRITURA

  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza los datos de un Cliente y su Contrato Activo (VERSIÓN BLINDADA)
 * ACTUALIZADO: Soporta TIPO_PAGO y PRECIO_DIA_POSICION
 */
function actualizarClienteDB(data) {
  const lock = LockService.getScriptLock();
  // Esperar hasta 30s para evitar choques de escritura
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetCli = ss.getSheetByName('DIM_CLIENTES');
    const sheetCon = ss.getSheetByName('DIM_CONTRATOS');
    
    // VALIDACIÓN: Si es POSTPAGO, debe tener precio día posición
    if (data.tipoPago === 'POSTPAGO' && (!data.precioDiaPosicion || data.precioDiaPosicion <= 0)) {
      throw new Error('POSTPAGO requiere un PRECIO_DIA_POSICION mayor a 0');
    }
    
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
    
    // Valores con defaults seguros
    const tipoPago = data.tipoPago || 'PREPAGO';
    const precioDiaPosicion = data.precioDiaPosicion || 0;
    
    const valoresContrato = [
      Number(data.posiciones) || 0, // Posiciones (puede ser 0 para POSTPAGO)
      800,                           // Factor (Fijo)
      Number(data.precioPosicion),
      Number(data.precioExceso),
      // NO incluir fecha/estado aquí, son fijos
    ];

    if (rowIndexCon !== -1) {
      // SI EXISTE: Actualizar columnas Posiciones(C) a PrecioExceso(F) + TipoPago(I) + PrecioDiaPosicion(J)
      // Primero actualizar los 4 campos básicos (columnas C-F)
      sheetCon.getRange(rowIndexCon + 1, 3, 1, 4).setValues([valoresContrato]);
      
      // Luego actualizar los campos nuevos (columnas I-J)
      sheetCon.getRange(rowIndexCon + 1, 9, 1, 2).setValues([[tipoPago, precioDiaPosicion]]);
      
      Logger.log(`Contrato actualizado: Tipo=${tipoPago}, PrecioDia=${precioDiaPosicion}`);
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
        new Date(),         // Fecha inicio
        'ACTIVO',           // Estado
        tipoPago,           // NUEVO: TIPO_PAGO (columna I)
        precioDiaPosicion   // NUEVO: PRECIO_DIA_POSICION (columna J)
      ]);
      
      Logger.log(`Contrato creado en actualización: ${nuevoIdContrato} - Tipo: ${tipoPago}`);
    }
    
    // ---------------------------------------------------------
    // 3. FORZAR GUARDADO
    // ---------------------------------------------------------
    SpreadsheetApp.flush(); // <--- ESTO ES VITAL: Obliga a Sheets a escribir YA.
    
    return { success: true, message: "✅ Cliente y contrato actualizados correctamente." };

  } catch(e) {
    Logger.log("Error en actualizarClienteDB: " + e.toString());
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza la información de un producto existente
 * NO PERMITE: Cambiar ID ni Cliente Propietario
 */
function actualizarProductoDB(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_PRODUCTOS');
    const allData = sheet.getDataRange().getValues();
    
    // Buscar fila por ID de producto (Columna A)
    // row[0] es ID
    const rowIndex = allData.findIndex(r => String(r[0]) === String(data.id));
    
    if (rowIndex === -1) {
      throw new Error("Producto no encontrado: " + data.id);
    }
    
    // Validar integridad: No permitir cambiar dueño (idCliente)
    // allData[rowIndex][1] es el idCliente actual
    if (String(allData[rowIndex][1]) !== String(data.idCliente)) {
       throw new Error("No se permite cambiar el cliente propietario del producto.");
    }

    // Actualizar columnas: Nombre(C), Peso(D), Empaque(E)
    // Indices base 0: 2, 3, 4. 
    // Sheets usa index base 1, así que fila es rowIndex + 1.
    
    sheet.getRange(rowIndex + 1, 3, 1, 3).setValues([[
       data.nombre,
       data.pesoNominal,
       data.empaque
    ]]);
    
    SpreadsheetApp.flush();
    return { success: true, message: "Producto actualizado correctamente." };

  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}