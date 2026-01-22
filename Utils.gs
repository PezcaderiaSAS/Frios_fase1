/**
 * Formatea fecha para input date HTML (YYYY-MM-DD)
 */
function formatDateForInput(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Validador simple de flotantes
 */
function parseFloatSafe(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}