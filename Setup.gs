/**
 * EJECUTAR UNA SOLA VEZ: Prepara la Base de Datos Relacional
 */
function instalarSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Esquema exacto validado contra tus CSVs
  const esquema = {
    'DIM_CLIENTES': ['ID_CLIENTE', 'NOMBRE_EMPRESA', 'NIT_RUT', 'EMAIL', 'TELEFONO', 'ESTADO'],
    'DIM_CONTRATOS': ['ID_CONTRATO', 'ID_CLIENTE', 'POSICIONES_CONTRATADAS', 'FACTOR_POSICION', 'PRECIO_POSICION', 'PRECIO_DIA_EXCESO', 'FECHA_INICIO', 'ESTADO', 'TIPO_PAGO', 'PRECIO_DIA_POSICION'],
    'DIM_PRODUCTOS': ['ID_PRODUCTO', 'ID_CLIENTE', 'NOMBRE', 'PESO_NOMINAL_CAJA', 'TIPO_EMPAQUE'],
    'MOV_HEADER': ['ID_MOVIMIENTO', 'TIPO', 'FECHA_REGISTRO', 'ID_CLIENTE', 'DOCUMENTO_REFERENCIA', 'TOTAL_CAJAS', 'TOTAL_PESO', 'URL_PDF', 'USUARIO'],
    'MOV_DETAIL': ['ID_DETALLE', 'ID_MOVIMIENTO', 'ID_PRODUCTO', 'LOTE_PROVEEDOR', 'ID_ENTRADA_ORIGEN', 'FECHA_VENCIMIENTO', 'CANTIDAD_CAJAS', 'PESO_KG']
  };

  for (let nombreHoja in esquema) {
    let hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) {
      hoja = ss.insertSheet(nombreHoja);
      hoja.getRange(1, 1, 1, esquema[nombreHoja].length)
          .setValues([esquema[nombreHoja]])
          .setFontWeight('bold')
          .setBackground('#E0E0E0');
      hoja.setFrozenRows(1);
      // Formato Texto para IDs para evitar que '001' se convierta en '1'
      hoja.getRange("A:A").setNumberFormat("@"); 
    }
  }
  Logger.log("Estructura de Base de Datos actualizada correctamente.");
}