# Documentación Técnica - WMS ColdChain Pro

**Arquitectura del Sistema y Detalles de Implementación**

---

## 1. Arquitectura General

El sistema sigue un patrón **MVC (Modelo-Vista-Controlador)** adaptado a Google Apps Script:

- **Modelo (Database.gs):** Gestiona la interacción con Google Sheets (`MOV_HEADER`, `MOV_DETAIL`, `DIM_PRODUCTOS`, `DIM_CLIENTES`).
- **Vista (HTML Files):** Interfaz SPA (Single Page Application) renderizada en el cliente.
- **Controlador (Controller.gs):** API pública expuesta mediante `google.script.run` que conecta el Frontend con el Backend.

---

## 2. Bases de Datos (Google Sheets)

El almacenamiento se realiza en una Hoja de Cálculo con las siguientes pestañas críticas:

### `MOV_HEADER` (Cabecera de Movimientos)
- **ID:** UUID único del movimiento.
- **Tipo:** ENTRADA / SALIDA.
- **Fecha:** Timestamp (UTC/Local normalizado).
- **Metadata:** Columna JSON deprecada (antes guardaba estado congelado global).

### `MOV_DETAIL` (Detalle de Productos)
- **ID_Movimiento:** FK hacia Header.
- **ID_Producto:** FK hacia Dimensión Productos.
- **Cantidad/Peso:** Valores positivos (Entrada) o negativos (Salida).
- **Metadata (Col 9):** JSON que almacena atributos por ítem (ej: `{ "esCongelado": false }`).

---

## 3. Módulos Core

### A. Motor de Facturación (`apiCalcularFacturacion`)
Calcula el costo de almacenamiento día a día.
- **Algoritmo:** Reconstrucción de saldo.
  1. Obtiene saldo inicial antes del rango.
  2. Itera día por día dentro del rango.
  3. Aplica Suma de Movimientos del día.
  4. Compara saldo vs capacidad contratada.
- **Manejo de Fechas:** Normalización estricta a Mediodía (`T12:00:00`) para evitar desfases de zona horaria entre servidor (UTC) y cliente.

### B. Gestión de Inventario
- **FIFO/FEFO:** El frontend sugiere lotes basados en fecha de vencimiento.
- **Validación de Stock:** El backend (`apiGetProductosConStock`) calcula el saldo disponible por producto agregando todas las entradas y salidas históricas.

### C. Sistema de Edición
Permite modificar movimientos pasados preservando la integridad.
1. Actualiza Header.
2. Elimina detalles anteriores.
3. Inserta nuevos detalles con la nueva Metadata.
4. Invalida Caché (`CacheService`) para reflejar cambios inmediatos en reportes.

---

## 4. Dependencias y Servicios

- **CacheService:** Optimización de lectura para Dashboard y Stock (TTL 30 min, invalidación on-write).
- **LockService:** Prevención de condiciones de carrera durante escritura simultánea.
- **HtmlService:** Renderizado de plantillas.
- **Utilities:** Generación de UUIDs y formateo de fechas.

---

## 5. Mantenimiento

### Actualización de Código
El código fuente (.gs y .html) se gestiona localmente y se despliega mediante CLASP o copia manual al editor de Apps Script.

### Limpieza
El script `Cleanup.gs` (si está configurado) debe ejecutarse periódicamente para eliminar PDFs temporales de Google Drive.
