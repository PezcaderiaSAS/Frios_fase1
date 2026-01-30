# Registro de Cambios (Changelog)

Todas las modificaciones notables a este proyecto serán documentadas en este archivo.

## [1.2.0] - 30-01-2026
### Añadido
- **Estado de Congelación por Ítem:**
  - Se eliminó el check global de "Entrada Congelada".
  - Se añadió una columna "Congelado" en la tabla de productos de la Vista de Entrada.
  - Nueva columna de Metadatos en `MOV_DETAIL` para persistir esta configuración por producto.
- **Edición de Historial:**
  - Capacidad completa para editar movimientos de Entrada y Salida desde el Historial.
  - Recálculo automático de stock y regeneración de PDFs al actualizar.
  - Invalidación inteligente de caché tras actualizaciones.

### Corregido
- **Facturación / Zona Horaria:** Se solucionó un error crítico donde las fechas se reportaban con un día de desfase debido a conversiones UTC/Local. Ahora el sistema normaliza todas las fechas a Mediodía (12:00 PM).
- **Rango de Fechas:** El selector de fechas en facturación ahora respeta estrictamente los días seleccionados (inclusive).
- **Interfaz de Edición:** Se corrigieron bloqueos en el botón "Actualizar" y errores de carga ("Cannot read properties of null") al cambiar entre modos de creación y edición.
- **Carga de Clientes:** Se solucionó una condición de carrera que causaba errores en la carga de filtros de productos.

## [1.1.0] - 25-01-2026
### Añadido
- **Módulo de Facturación:** Generación de reportes PDF detallados y resumidos.
- **Lógica de Excedentes:** Cobro automático por posiciones o kilos extra.
- **PDFs Mejorados:** Nuevo diseño limpio y profesional para recibos de entrada/salida.

## [1.0.0] - 01-01-2026
### Lanzamiento Inicial
- Gestión de Entradas y Salidas.
- Dashboard Básico.
- Control de Inventario FIFO.
