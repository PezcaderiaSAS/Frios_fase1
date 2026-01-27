# WMS ColdChain Pro - Documentación Técnica y Manual de Operaciones

Sistema profesional de gestión de inventarios (WMS) para cadena de frío, optimizado para alto rendimiento, integridad de datos y escalabilidad en Google Workspace.

---

## 🚀 Estado del Proyecto: FINALIZADO
Este sistema ha sido modernizado y robustecido con las siguientes características empresariales:

### 1. Integridad y Seguridad (Backend)
*   **Bloqueo de Concurrencia (`LockService`)**: Evita que dos usuarios generen el mismo ID o sobrescriban datos simultáneamente. Usa `waitLock(30000)` para encolar peticiones.
*   **Validación de Datos (Schema Validation)**: Sistema estricto que rechaza movimientos o clientes con datos incompletos antes de tocar la base de datos.
*   **Lecturas Optimizadas**: Lectura por lotes (`Batch Reading`) en lugar de escaneo celda por celda.

### 2. Rendimiento (Escalabilidad)
*   **Sistema de Caché Inteligente (`CacheService`)**:
    *   **Dashboard**: Carga instantánea (cache de 30 min).
    *   **Inventarios**: Cache de 60 min.
    *   **Invalidación Automática**: Al guardar una entrada/salida, el sistema limpia la caché afectada para mostrar datos frescos de inmediato.
*   **Modernización JS**: Migración completa de "Callback Hell" a `Async/Await` + Promesas.

### 3. Interfaz (Frontend)
*   **HTML Semántico**: Mantenibilidad mejorada y accesibilidad.
*   **Diseño Premium**: Bootstrap 5 + FontAwesome 6 con estética "Glassmorphism".
*   **SPA Real**: Navegación sin recargas de página.

---

## 🛠️ Guía de Instalación y Despliegue

### Requisitos Previos
*   Cuenta de Google Workspace.
*   Node.js instalado (para usar `clasp`).

### Opción A: Despliegue Manual (Copiar y Pegar)
1.  Crear nuevo proyecto en [script.google.com](https://script.google.com).
2.  Copiar el contenido de todos los archivos `.gs` y `.html` de la carpeta local.
3.  Actualizar `Configuration.gs` con los IDs reales de la Hoja de Cálculo y Carpetas de Drive.

### Opción B: Despliegue con CLASP (Recomendado para Desarrollo)
`clasp` permite subir el código directamente desde tu PC y gestionar versiones.

1.  **Instalar Clasp**:
    ```bash
    npm install -g @google/clasp
    ```
2.  **Login**:
    ```bash
    clasp login
    ```
3.  **Vincular Proyecto Existente** (Obtén el Script ID desde Configuración del Proyecto en el navegador):
    ```bash
    clasp clone "TU_SCRIPT_ID"
    ```
4.  **Subir Cambios**:
    ```bash
    clasp push
    ```
5.  **Desplegar Nueva Versión Web**:
    ```bash
    clasp deploy --description "Versión final con Cache y LockService"
    ```

---

## 🧹 Mantenimiento Automático (Trigger)

Para evitar que Google Drive se llene de PDFs temporales, el sistema incluye un script de limpieza.

**Configuración Inicial (Obligatoria):**
1.  Abrir el editor de Apps Script.
2.  Ir al archivo `Cleanup.gs`.
3.  Ejecutar la función `installCleanupTrigger()` una sola vez.
4.  **Resultado**: El sistema borrará automáticamente cada madrugada (3:00 AM) los PDFs de facturación con más de 24 horas de antigüedad.

---

## 📂 Estructura de Archivos Clave

| Archivo | Responsabilidad | Nivel de Importancia |
| :--- | :--- | :--- |
| `Controller.gs` | Orquestador, Validación (Schemas), Caché, API Pública. | ⭐ CRÍTICO |
| `Database.gs` | Conexión a Sheets, LockService, Transacciones Atómicas. | ⭐ CRÍTICO |
| `js-logic.html` | Lógica Frontend, Router, Llamadas Async, UI State. | ⭐ ALTO |
| `Cleanup.gs` | Mantenimiento y limpieza de archivos temporales. | MEDIO |
| `Configuration.gs` | Variables de entorno (IDs, Timezone). | MEDIO |

---

## ⚠️ Solución de Problemas Comunes

**1. "Error generando ID" o "Timeout" en guardado:**
El sistema de bloqueo espera 30 segundos. Si falla, es porque la hoja está bajo uso masivo extremo. Reintentar suele solucionar el problema.

**2. Los datos no se actualizan en el Dashboard:**
El sistema usa Caché. Si realizaste cambios manuales directamente en la hoja de cálculo, la caché no se enterará. Debes esperar 30 min o guardar un movimiento "ficticio" para forzar la limpieza de caché.

**3. "ScriptError: Authorization Required":**
Si añades nuevas librerías o scopes, debes volver a ejecutar una función en el editor para conceder permisos.

---
**Desarrollado para Pezcaderia SAS | Fase Final**
