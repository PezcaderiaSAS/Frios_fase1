/**
 * Servicio de Generación de PDFs de Facturación
 * 
 * Este módulo contiene funciones para generar PDFs de facturación en dos formatos:
 * 1. Resumen Ejecutivo: PDF corto con métricas principales
 * 2. Detallado: PDF completo con tabla día a día
 * 
 * @author WMS ColdChain Pro
 * @version 1.0
 */

/**
 * Genera un PDF de facturación en formato RESUMEN EJECUTIVO
 * 
 * @param {string} idFactura - Identificador único de la factura
 * @param {Object} datosFactura - Objeto con todos los datos de facturación
 * @param {Object} datosFactura.cliente - Información del cliente (id, nombre, nit)
 * @param {Object} datosFactura.periodo - Fechas de inicio y fin del período
 * @param {Object} datosFactura.metricas - Métricas calculadas (días, costos, totales)
 * @param {Object} datosFactura.contrato - Información del contrato activo
 * @returns {string} URL del PDF generado en Google Drive
 */
function generarFacturaResumenPDF(idFactura, datosFactura) {
  try {
    Logger.log(`Generando PDF Resumen para factura: ${idFactura}`);
    
    // 1. Cargar plantilla HTML de resumen ejecutivo
    const template = HtmlService.createTemplateFromFile('billing-invoice-summary');
    template.data = datosFactura;
    
    // 2. Preparar nombre del archivo
    const nombreCliente = datosFactura.cliente.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const fechaInicio = new Date(datosFactura.periodo.inicio).toISOString().split('T')[0];
    const fechaFin = new Date(datosFactura.periodo.fin).toISOString().split('T')[0];
    const nombreArchivo = `FACTURA-RESUMEN-${nombreCliente}-${fechaInicio}-${fechaFin}.pdf`;
    
    // 3. Convertir a Blob PDF
    const htmlContent = template.evaluate().getContent();
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML)
                          .getAs(MimeType.PDF)
                          .setName(nombreArchivo);
    
    // 4. Guardar en carpeta de facturación
    const folder = DriveApp.getFolderById(CONFIG.RECEIPTS_FOLDER_BILLING_ID);
    const file = folder.createFile(blob);
    
    Logger.log(`PDF Resumen creado exitosamente: ${file.getName()}`);
    
    // 5. Retornar URL para acceso
    return file.getUrl();
    
  } catch (e) {
    Logger.log(`Error generando PDF Resumen: ${e.toString()}`);
    return `Error generando PDF Resumen: ${e.message}`;
  }
}

/**
 * Genera un PDF de facturación en formato DETALLADO
 * 
 * @param {string} idFactura - Identificador único de la factura
 * @param {Object} datosFactura - Objeto con todos los datos de facturación
 * @param {Object} datosFactura.cliente - Información del cliente (id, nombre, nit)
 * @param {Object} datosFactura.periodo - Fechas de inicio y fin del período
 * @param {Object} datosFactura.metricas - Métricas calculadas (días, costos, totales)
 * @param {Object} datosFactura.contrato - Información del contrato activo
 * @param {Array} datosFactura.detalleDiario - Array con datos día a día
 * @returns {string} URL del PDF generado en Google Drive
 */
function generarFacturaDetalladaPDF(idFactura, datosFactura) {
  try {
    Logger.log(`Generando PDF Detallado para factura: ${idFactura}`);
    
    // 1. Cargar plantilla HTML detallada
    const template = HtmlService.createTemplateFromFile('billing-invoice-detailed');
    template.data = datosFactura;
    
    // 2. Preparar nombre del archivo
    const nombreCliente = datosFactura.cliente.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const fechaInicio = new Date(datosFactura.periodo.inicio).toISOString().split('T')[0];
    const fechaFin = new Date(datosFactura.periodo.fin).toISOString().split('T')[0];
    const nombreArchivo = `FACTURA-DETALLADA-${nombreCliente}-${fechaInicio}-${fechaFin}.pdf`;
    
    // 3. Convertir a Blob PDF
    const htmlContent = template.evaluate().getContent();
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML)
                          .getAs(MimeType.PDF)
                          .setName(nombreArchivo);
    
    // 4. Guardar en carpeta de facturación
    const folder = DriveApp.getFolderById(CONFIG.RECEIPTS_FOLDER_BILLING_ID);
    const file = folder.createFile(blob);
    
    Logger.log(`PDF Detallado creado exitosamente: ${file.getName()}`);
    
    // 5. Retornar URL para acceso
    return file.getUrl();
    
  } catch (e) {
    Logger.log(`Error generando PDF Detallado: ${e.toString()}`);
    return `Error generando PDF Detallado: ${e.message}`;
  }
}

/**
 * Función auxiliar para formatear números como moneda colombiana
 * 
 * @param {number} valor - Valor numérico a formatear
 * @returns {string} Valor formateado como moneda
 */
function formatearMoneda(valor) {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}

/**
 * Función auxiliar para formatear fechas en formato legible
 * 
 * @param {Date|string} fecha - Fecha a formatear
 * @returns {string} Fecha formateada en español
 */
function formatearFecha(fecha) {
  const f = new Date(fecha);
  const opciones = { year: 'numeric', month: 'long', day: 'numeric', timeZone: CONFIG.TIMEZONE };
  return f.toLocaleDateString('es-CO', opciones);
}
