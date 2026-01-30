# WMS ColdChain Pro ❄️

**Sistema de Gestión de Almacenes (WMS) para Logística de Fríos**

Este proyecto es una aplicación web integral desarrollada sobre **Google Apps Script** para gestionar el inventario, movimientos y facturación de una empresa de almacenamiento en frío ("Pezcaderia SAS").

## 🚀 Características Principales

### 1. Gestión de Inventario
- **Entradas:** Registro detallado de lotes, pesos, fechas de vencimiento y estado de congelación (Control de calidad).
- **Salidas:** Despacho de mercancía con validación de stock en tiempo real (FIFO/FEFO).
- **Stock en Vivo:** Panel de control con visualización de ocupación y alertas de vencimiento.

### 2. Facturación Inteligente
- **Cálculo Automático:** Generación de cortes de facturación basados en contratos personalizados por cliente.
- **Detección de Excedentes:** Cobro automático de posiciones o kilos extra según la capacidad contratada.
- **Recargos de Servicio:** Aplicación automática intergrada de recargos por refrigeración para mercancía no congelada (granularidad por ítem).
- **Reportes:** Generación de PDFs de facturación (Resumen Ejecutivo e Informe Detallado día a día).

### 3. Trazabilidad y Seguridad
- **Historial Completo:** Registro inmutable de todos los movimientos.
- **Edición Auditada:** Capacidad de corregir movimientos históricos con regeneración automática de saldos y PDFs.
- **Backups:** Respaldo automático de datos críticos.

## 🛠️ Tecnologías Utilizadas

- **Backend:** Google Apps Script (Servelss, basado en V8 Engine).
- **Base de Datos:** Google Sheets (Estructura relacional simulada: Header/Detail).
- **Frontend:** HTML5, CSS3, JavaScript (ES6+).
- **Framework UI:** Bootstrap 5 (Diseño Responsivo y Moderno).
- **Generación de Documentos:** Google Docs & PDF Service.

## 📂 Estructura del Proyecto

- `Controller.gs`: Lógica de negocio central y orquestación de APIs.
- `Database.gs`: Capa de persistencia y acceso a datos (CRUD Google Sheets).
- `Service_PDF.gs`: Motor de generación de reportes y facturas.
- `Cleanup.gs`: Mantenimiento y limpieza de archivos temporales.
- `index.html`: Punto de entrada de la aplicación (SPA Router).
- `js-logic.html`: Lógica del cliente (Frontend Controller).
- `*.html`: Vistas parciales (`view-entrada`, `view-salida`, `view-billing`, etc.).

## 📦 Instalación y Despliegue

1. **Requisitos:** Cuenta de Google Workspace.
2. **Configuración:**
   - Clonar el proyecto en Google Apps Script.
   - Configurar el ID de la Hoja de Cálculo en `CONFIG.SPREADSHEET_ID`.
   - Definir carpetas de destino en Google Drive para PDFs.
3. **Despliegue:**
   - Publicar como "Aplicación Web".
   - Ejecutar como: "Yo" (Propietario).
   - Acceso: "Cualquiera" o "Dominio de la Organización".

## 👥 Uso

Consultar el [Manual de Usuario](docs/USER_MANUAL.md) para instrucciones detalladas de operación.

## 📄 Licencia

Propiedad de **Pezcaderia SAS**. Uso exclusivo autorizado.
