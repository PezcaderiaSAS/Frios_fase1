/**
 * Genera un PDF del movimiento y devuelve la URL pública/privada
 */
function generarReciboPDF(idMovimiento, datosMovimiento) {
  try {
    // 1. Cargar plantilla HTML (se creará más adelante)
    const template = HtmlService.createTemplateFromFile('receipt-template');
    template.data = datosMovimiento; // Pasar datos al HTML
    
    // 2. Convertir a Blob (PDF)
    const htmlContent = template.evaluate().getContent();
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML)
                          .getAs(MimeType.PDF)
                          .setName(`Recibo_${idMovimiento}.pdf`);
    
    // 3. Guardar en el Folder específico según el tipo
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