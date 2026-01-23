/**
 * FUNCIÓN DE MIGRACIÓN - Ejecutar UNA SOLA VEZ
 * Añade la columna ID_CLIENTE a DIM_PRODUCTOS para productos existentes
 */
function migrarProductosConCliente() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DIM_PRODUCTOS');
  
  if (!sheet) {
    Logger.log("ERROR: DIM_PRODUCTOS no existe");
    return;
  }
  
  // 1. Verificar si ya tiene la columna ID_CLIENTE
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers[1] === 'ID_CLIENTE') {
    Logger.log("⚠️ La columna ID_CLIENTE ya existe. Migración ya ejecutada.");
    return;
  }
  
  // 2. Insertar nueva columna en posición B (después de ID_PRODUCTO)
  sheet.insertColumnAfter(1);
  sheet.getRange(1, 2).setValue('ID_CLIENTE').setFontWeight('bold').setBackground('#E0E0E0');
  
  // 3. Asignar valor por defecto "COMPARTIDO" a productos existentes
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const numFilas = lastRow - 1;
    const valoresDefecto = Array(numFilas).fill(['COMPARTIDO']);
    sheet.getRange(2, 2, numFilas, 1).setValues(valoresDefecto);
  }
  
  Logger.log("✅ Migración completada. Columna ID_CLIENTE añadida a DIM_PRODUCTOS.");
  Logger.log(`   ${lastRow - 1} productos existentes asignados a "COMPARTIDO"`);
  Logger.log("   Ahora puedes reasignar productos manualmente o editar el código.");
}
