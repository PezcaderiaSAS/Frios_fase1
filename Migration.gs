/**
 * MIGRACIÓN: Añadir columnas TIPO_PAGO y PRECIO_DIA_POSICION a contratos existentes
 * 
 * Ejecutar UNA VEZ para actualizar la estructura de DIM_CONTRATOS
 * Todos los contratos existentes se asumen como PREPAGO (pago adelantado)
 */
function migrarContratosTipoPago() {
  throw new Error("MIGRACIÓN BLOQUEADA: Elimine esta línea para ejecutar en Producción.");
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DIM_CONTRATOS');
    
    if (!sheet) {
      throw new Error('La hoja DIM_CONTRATOS no existe');
    }
    
    // 1. Verificar si ya existen las columnas
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (headers.includes('TIPO_PAGO')) {
      Logger.log('✅ Las columnas TIPO_PAGO y PRECIO_DIA_POSICION ya existen');
      Logger.log('Migración no necesaria');
      return {
        success: true,
        message: 'Columnas ya existen, no se requiere migración'
      };
    }
    
    Logger.log('🔄 Iniciando migración de schema...');
    
    // 2. Añadir nuevos headers en columnas I y J (9 y 10)
    sheet.getRange(1, 9).setValue('TIPO_PAGO');
    sheet.getRange(1, 10).setValue('PRECIO_DIA_POSICION');
    
    // Aplicar formato a headers
    sheet.getRange(1, 9, 1, 2)
         .setFontWeight('bold')
         .setBackground('#E0E0E0');
    
    // 3. Migrar datos existentes
    const lastRow = sheet.getLastRow();
    
    if (lastRow > 1) {
      // Crear array de valores default para todos los contratos existentes
      // TIPO_PAGO = 'PREPAGO', PRECIO_DIA_POSICION = 0
      const defaultValues = [];
      for (let i = 0; i < lastRow - 1; i++) {
        defaultValues.push(['PREPAGO', 0]);
      }
      
      // Escribir valores en bloque (más eficiente)
      sheet.getRange(2, 9, lastRow - 1, 2).setValues(defaultValues);
      
      Logger.log(`✅ Migrados ${lastRow - 1} contratos como PREPAGO`);
    }
    
    // 4. Log de éxito
    Logger.log('✅ Migración completada exitosamente');
    Logger.log(`- Columnas añadidas: TIPO_PAGO, PRECIO_DIA_POSICION`);
    Logger.log(`- Registros actualizados: ${lastRow - 1}`);
    
    return {
      success: true,
      message: `Migración exitosa: ${lastRow - 1} contratos actualizados`,
      registrosActualizados: lastRow - 1
    };
    
  } catch (e) {
    Logger.log('❌ Error en migración: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * MIGRACIÓN OPCIONAL: Actualizar datos antiguos si es necesario
 */
function migrarDatosAntiguos() {
  // Se puede usar para correcciones futuras
  // Ejemplo: convertir formatos de fecha, actualizar referencias, etc.
  
  Logger.log("Función de migración lista para usar en el futuro.");
}
