# Manual de Usuario - WMS ColdChain Pro

**Guía Operativa y Administrativa**

---

## 1. Acceso y Navegación

Al iniciar la aplicación, se presenta el **Dashboard Principal**. La barra de navegación superior permite acceder a los módulos:
- **Dashboard:** Vista general de ocupación y contratos.
- **Entrada:** Formulario para recibir mercancía.
- **Salida:** Formulario para despachar mercancía.
- **Catálogos:** Gestión de Productos y Clientes.
- **Historial:** Registro de movimientos y edición.
- **Facturación:** Generación de cortes y cobros.

---

## 2. Gestión de Entrada (Recepción)

Utilice este módulo cada vez que ingrese mercancía al almacén.

1. **Seleccionar Cliente:** Elija el cliente propietario de la carga.
2. **Fecha:** Por defecto es hoy, pero puede registrar movimientos pasados.
3. **Agregar Productos:**
   - Seleccione el producto del catálogo (filtro automático por cliente).
   - Ingrese **Lote** y **Vencimiento**.
   - Digite **Cajas** y **Peso Total (Kg)**.
   - **IMPORTANTE:** Marque o desmarque la casilla **"Congelado"** (Frozen).
     - ✅ **Marcado:** Mercancía congelada (Tarifa estándar).
     - ⬜ **Desmarcado:** Mercancía refrigerada/fresca (Aplica Recargo por Refrigeración).
4. **Guardar:** Haga clic en "Guardar Entrada". Se generará un Recibo PDF automáticamente.

---

## 3. Gestión de Salida (Despacho)

Para dar salida o retirar mercancía:

1. **Seleccionar Cliente.**
2. **Seleccionar Producto:** El sistema solo mostrará productos con stock disponible (FIFO por defecto).
3. **Indicar Cantidad:**
   - Puede retirar por Cajas o por Kilos.
   - El sistema validará que no retire más de lo disponible en el lote seleccionado.
4. **Guardar:** Se registrará la salida y se actualizará el stock inmediatamente.

---

## 4. Historial y Correcciones

Si cometió un error en un registro:

1. Vaya a la pestaña **Historial**.
2. Busque el movimiento (use Ctrl+F o los filtros de fecha/cliente).
3. Haga clic en el botón **Editar** (Lápiz) a la derecha de la fila.
4. Modifique los datos necesarios (Cantidades, Pesos, **Estado Congelado**).
5. Haga clic en **Actualizar Movimiento**.
   - ⚠️ **Nota:** Esto recalculará el inventario y regenerará el recibo PDF original.

---

## 5. Facturación

Para generar los cobros del periodo:

1. Seleccione el **Cliente**.
2. Defina el **Rango de Fechas** (ej: 01/01/2026 al 15/01/2026).
3. Haga clic en **Calcular**.
4. Revise el Resumen en pantalla:
   - **Base:** Tarifa fija o por uso.
   - **Excedentes:** Cargos por superar la capacidad contratada.
   - **Servicios/Recargos:** Suma de los ítems no congelados (marcados como frescos).
5. **Exportar:**
   - **Resumen Ejecutivo:** PDF de una página con totales.
   - **Informe Detallado:** PDF con el desglose día a día de ocupación y movimientos.

---

## 6. Soporte

Para reportar fallos o solicitar nuevas funcionalidades, contacte al administrador del sistema.
**Versión Actual:** 1.2.0 (Enero 2026)
