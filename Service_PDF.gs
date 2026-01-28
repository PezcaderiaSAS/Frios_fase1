/**
 * Genera un PDF del movimiento y devuelve la URL pública/privada
 */
function generarReciboPDF(idMovimiento, datosMovimiento) {
  try {
    // 1. Cargar plantilla HTML (se creará más adelante)
    const template = HtmlService.createTemplateFromFile('receipt-template');
    template.data = datosMovimiento; // Pasar datos al HTML
    
    // 2. Prepare descriptive filename
    const tipo = datosMovimiento.tipo ? datosMovimiento.tipo.toUpperCase() : 'MOV';
    const cliente = (datosMovimiento.cliente || 'CLIENTE').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const id = idMovimiento || 'NUL';
    
    // Format: RECIBO-ENTRADA-CARNES_SAS-20260124-1050.pdf
    const filename = `RECIBO-${tipo}-${cliente}-${fecha}-${id}.pdf`;

    // 3. Convert to Blob (PDF)
    const htmlContent = template.evaluate().getContent();
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML)
                          .getAs(MimeType.PDF)
                          .setName(filename);
    
    // 4. Guardar en el Folder específico según el tipo
    const folderId = datosMovimiento.tipo === 'ENTRADA' 
        ? CONFIG.RECEIPTS_FOLDER_IN_ID 
        : CONFIG.RECEIPTS_FOLDER_OUT_ID;
        
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    // 4. Devolver la URL para guardarla en la BD
    return file.getUrl();
    
  } catch (e) {
    Logger.log("Error generando PDF: " + e.toString());
    return "Error generando PDF"; // No romper el flujo si falla el PDF
  }
}

function generarReporteStockPDF(cliente, productos) {
    try {
        const template = HtmlService.createTemplateFromFile('report-stock-template');
        template.cliente = cliente;
        template.productos = productos;
        template.fecha = new Date();
        
        const filename = `REPORTE-STOCK-${cliente.nombre.replace(/[^a-zA-Z0-9]/g,'_')}-${new Date().toISOString().split('T')[0]}.pdf`;
        
        const htmlContent = template.evaluate().getContent();
        const blob = Utilities.newBlob(htmlContent, MimeType.HTML).getAs(MimeType.PDF).setName(filename);
        
        // Save to Drive (Using IN folder for now as dumping ground, or specific if exists)
        // Ideal: CONFIG.REPORTS_FOLDER_ID
        const folderId = CONFIG.RECEIPTS_FOLDER_IN_ID; 
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(blob);
        
        return file.getUrl();
    } catch(e) {
        Logger.log("Error Reporte Stock PDF: " + e);
        return "Error: " + e.toString();
    }
}