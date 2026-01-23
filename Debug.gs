/**
 * FUNCIÓN DE DEPURACIÓN - Ejecutar para verificar datos
 * Muestra los movimientos y detalles de un cliente específico
 */
function debugInventarioCliente() {
  const idCliente = 'CLI001'; // Cambiar por el ID del cliente a debuggear
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const headers = ss.getSheetByName('MOV_HEADER').getDataRange().getValues();
  const details = ss.getSheetByName('MOV_DETAIL').getDataRange().getValues();
  
  Logger.log("===== DEBUG INVENTARIO CLIENTE: " + idCliente + " =====");
  
  // 1. Encontrar movimientos del cliente
  Logger.log("\n--- MOVIMIENTOS EN MOV_HEADER ---");
  const movimientosCliente = [];
  headers.slice(1).forEach(r => {
    if (String(r[3]) === String(idCliente)) {
      movimientosCliente.push(r[0]);
      Logger.log(`ID: ${r[0]} | TIPO: ${r[1]} | FECHA: ${r[2]} | CAJAS: ${r[5]} | PESO: ${r[6]}`);
    }
  });
  
  // 2. Mostrar detalles
  Logger.log("\n--- DETALLES EN MOV_DETAIL ---");
  Logger.log("Esquema: [ID_DETALLE, ID_MOVIMIENTO, ID_PRODUCTO, LOTE, ID_ENTRADA, VENC, CAJAS, PESO_KG]");
  details.slice(1).forEach(r => {
    if (movimientosCliente.includes(r[1])) {
      Logger.log(`• ${r[1]} | Producto: ${r[2]} | Lote: ${r[3]} | Cajas: ${r[6]} | Peso: ${r[7]}`);
    }
  });
  
  // 3. Ejecutar función real
  Logger.log("\n--- RESULTADO DE apiGetInventarioCliente ---");
  const inventario = apiGetInventarioCliente(idCliente);
  Logger.log(`Total ítems con stock: ${inventario.length}`);
  inventario.forEach(item => {
    Logger.log(`${item.nombreProducto} | Lote: ${item.lote} | Cajas: ${item.cajas} | Peso: ${item.peso} kg`);
  });
  
  if (inventario.length === 0) {
    Logger.log("\n⚠️ NO HAY INVENTARIO. Posibles causas:");
    Logger.log("1. No hay movimientos registrados para este cliente");
    Logger.log("2. Las salidas tienen signo negativo y anulan las entradas");
    Logger.log("3. Los productos no existen en DIM_PRODUCTOS");
  }
}
