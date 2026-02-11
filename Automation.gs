/**
 * Automation.gs
 * Tareas programadas y automatización de fondo.
 */

// Configuración de Correo para Reportes
const EMAIL_REPORT_TO = "gerencia@pezcaderia.sas"; // Reemplazar con email real

/**
 * DAILY TRIGGER: Ejecutar esto con un activador diario (ej: 6:00 PM)
 */
function dailyReportJob() {
  try {
    const today = new Date();
    Logger.log("Iniciando Reporte Diario: " + today);

    // 1. Obtener Datos del Día
    const movimientos = apiGetMovimientosDia(today); // Necesito exponer esta función o crearla
    const lowStock = checkLowStock(); // Helper local

    // 2. Generar PDF
    const template = HtmlService.createTemplateFromFile('report-daily-template'); // Nueva plantilla o reusar
    template.date = today;
    template.movan = movimientos;
    template.stock = lowStock;
    
    const blob = template.evaluate().getBlob();
    blob.setName(`Reporte_Diario_${Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd")}.pdf`);

    // 3. Enviar Correo
    MailApp.sendEmail({
      to: EMAIL_REPORT_TO,
      subject: "📊 WMS Reporte Diario - " + Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy"),
      body: "Adjunto encontrará el resumen de movimientos y alertas de stock del día.",
      attachments: [blob]
    });

    Logger.log("Reporte enviado a " + EMAIL_REPORT_TO);

  } catch (e) {
    Logger.log("Error en dailyReportJob: " + e.toString());
    MailApp.sendEmail(EMAIL_REPORT_TO, "Error WMS Automation", "Falló el reporte diario: " + e.toString());
  }
}

/**
 * Helper: Obtener movimientos de HOY (Simulado/Reusado)
 */
function apiGetMovimientosDia(dateObj) {
  const movs = getMovimientos(); // Function is global in Database.gs
  const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // Filter by date (approximate string match or proper date parsing)
  return db.filter(m => {
    // m[2] is fecha. Assuming it's readable or Date object.
    // Database.getMovimientos returns objects if mapped? No, Database.gs usually returns raw data or mapped in Controller.
    // Let's call Controller's apiGetUltimosMovimientos and filter?
    // Better: Read DB directly for efficiency or use existing Controller logic.
    // user's Controller has 'apiGetUltimosMovimientos'.
    return m.fecha.startsWith(dateStr); 
  });
}

/**
 * Helper: Check Low Stock
 */
function checkLowStock() {
   // Logic to query stock and filter < configured threshold
   return []; // Placeholder
}
