# WMS ColdChain Pro

Sistema de gestión de inventarios y movimientos (WMS) para logística de cadena de frío, construido con **Google Apps Script** y **Vue.js 3** + **Bootstrap 5**.

## Características
- **Dashboard:** KPIs en tiempo real (Ocupación, movimientos recientes).
- **Entradas y Salidas:** Formularios intuitivos para registro de movimientos.
- **Inventario:** Control de lotes, vencimientos y stock en tiempo real.
- **Facturación:** Cálculo de almacenamiento y excesos.
- **PDF Premium:** Generación automática de recibos en PDF (A5) guardados en Google Drive.

## Estructura del Proyecto
El proyecto está estructurado para ejecutarse dentro del entorno de Google Apps Script:

- `Code.gs` / `Controller.gs`: Lógica del servidor (Backend).
- `Index.html`: Punto de entrada de la aplicación web.
- `js-app.html`: Lógica Frontend (Vue.js).
- `view-*.html`: Componentes visuales (Vistas).
- `Configuration.gs`: Variables de entorno y configuración.

## Instalación

1.  Crea un nuevo proyecto en [Google Apps Script](https://script.google.com/).
2.  Copia el contenido de los archivos `.gs` y `.html` a tu proyecto.
3.  Configura los IDs en `Configuration.gs` (ver abajo).

## Configuración
Edita el archivo `Configuration.gs` con tus propios IDs de recursos:

```javascript
const CONFIG = {
  SPREADSHEET_ID: 'TU_ID_DE_HOJA_DE_CALCULO',
  RECEIPTS_FOLDER_IN_ID: 'ID_FOLDER_ENTRADAS',
  RECEIPTS_FOLDER_OUT_ID: 'ID_FOLDER_SALIDAS',
  TIMEZONE: 'America/Bogota'
};
```

## Tecnologías
- **Frontend:** HTML5, CSS3 (Bootstrap 5.3), Vue.js 3 (CDN).
- **Backend:** Google Apps Script (V8 Runtime).
- **Base de Datos:** Google Sheets.
- **Almacenamiento:** Google Drive (PDFs).

## Licencia
Este proyecto es de uso privado para la gestión logística empresarial.
