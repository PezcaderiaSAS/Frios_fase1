/**
 * MANTENIMIENTO: Limpieza automática de archivos temporales
 * 
 * Este script elimina archivos PDF generados en la carpeta de Facturación
 * que tengan más de 24 horas de antigüedad para evitar saturar el Drive.
 */

function cleanupTempFiles() {
  try {
    const folderId = CONFIG.RECEIPTS_FOLDER_BILLING_ID;
    if (!folderId) {
      Logger.log("No está configurado el ID de carpeta de facturación.");
      return;
    }

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType(MimeType.PDF);
    const now = new Date();
    const cutoff = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 horas atrás

    let count = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() < cutoff) {
        file.setTrashed(true);
        count++;
      }
    }

    Logger.log(`Mantenimiento completado: ${count} archivos eliminados.`);
  } catch (e) {
    Logger.log("Error en cleanup: " + e.toString());
  }
}

/**
 * INSTALACIÓN DEL TRIGGER
 * Ejecutar esta función una sola vez manualmente para configurar la limpieza diaria.
 */
function installCleanupTrigger() {
  // Borrar triggers existentes para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'cleanupTempFiles') {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Crear nuevo trigger diario a las 3 AM
  ScriptApp.newTrigger('cleanupTempFiles')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
      
  Logger.log("Trigger de limpieza instalado correctamente.");
}
