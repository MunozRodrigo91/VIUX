# Documentación del Proyecto: Sistema de Gestión de Alquiler de Monopatines (VIUX)

## 1. Descripción General del Proyecto
Este proyecto es una plataforma web para la **gestión de alquiler de monopatines eléctricos** enfocado en zonas turísticas (Pinamar, Mar de Ostende, Valeria del Mar, Cariló). 
Actualmente, el sistema funciona de forma local con persistencia en un archivo JSON (`data.json`) y actualizaciones en tiempo real mediante *Server-Sent Events* (SSE).

El sistema maneja el ciclo de vida completo del negocio: 
1. **Disponibilidad y Turnos:** Control de stock de monopatines por bloque horario.
2. **Reservas:** Interfaz para que los clientes reserven unidades pagando una seña (30%) de forma online a través de MercadoPago.
3. **Operativa de Local (Check-In / Check-Out):** Cobro del saldo restante y depósito de garantía en efectivo al retirar, y devolución de la garantía al devolver el vehículo.
4. **Caja Diaria:** Control de flujo de efectivo en el local (apertura, cierres, ingresos por saldos/garantías, y retiros).
5. **Partners / Hoteles:** Trazabilidad de reservas provenientes de hoteles asociados para el cálculo de estadísticas o comisiones.

---

## 2. Entidades y Modelos de Datos

El dominio del sistema se compone de las siguientes entidades principales:

*   **Configuración (`Config`):** Almacena variables globales del negocio como Precio por Hora, Monto de Garantía, Porcentaje de Seña (30%), Tolerancia de No-Show, y Capacidad Máxima de monopatines por turno.
*   **Turnos (`Turno`):** Representa un bloque horario en una fecha determinada (ej. `2026-07-08_1400`). Lleva el control del `total_unidades` (capacidad máxima) y las `unidades_disponibles`.
*   **Reservas (`Reserva`):** Almacena los datos del cliente, la cantidad de unidades alquiladas, el hotel/partner de procedencia, el modo de entrega (Punto de encuentro o Delivery a Hotel), y los desgloses de dinero (Monto Total, Seña, Saldo, Garantía).
*   **Caja (`Caja`):** Representa la sesión contable de un día específico. Almacena el estado (`abierta` o `cerrada`), el monto de apertura, el efectivo actual calculado, y la lista de transacciones.
*   **Transacciones (`Transaccion`):** Movimientos individuales dentro de una caja (ingresos, egresos, cobros, devoluciones, aperturas y cierres).

---

## 3. Reglas de Negocio Clave

Para integrar correctamente este proyecto con Supabase, es crucial respetar y portar las siguientes reglas de negocio:

### A. Gestión de Disponibilidad e Inventario
*   **Bloqueo Temporal:** Una reserva en estado `creada` con pago `pendiente` retiene el stock (bloquea unidades) por un máximo de **10 minutos** a la espera del pago de la seña. Pasado ese tiempo sin confirmación de pago, las unidades deben liberarse.
*   **Consumo Definitivo:** Una reserva consume `unidades_disponibles` del turno de forma definitiva si su estado de pago es `seña_pagada` y la reserva está activa (`creada`, `check_in` o `check_out`).

### B. Flujo Monetario y Pagos (MercadoPago vs Efectivo)
*   **Seña Online:** Al momento de reservar, el sistema calcula el 30% del total. Este valor se cobra mediante un link/preferencia de MercadoPago. Si se aprueba, la transacción (`ingreso_seña_mp`) se registra en la caja diaria, pero **no incrementa el dinero físico en la caja** (ya que es dinero digital).
*   **Saldos y Garantías (Local):** El saldo restante (70%) y el monto de garantía fijado por unidad se cobran **en efectivo** al momento del Check-In. Estos sí incrementan el flujo de efectivo real en caja (`total_efectivo_actual`).
*   **Devolución de Garantía:** Al momento del Check-Out, el monto exacto de la garantía ingresada se registra como un egreso de efectivo, restando del saldo de la caja física del local.

### C. Máquina de Estados de la Reserva
1.  **`creada`:** El cliente ingresó los datos y generó la intención.
2.  **`creada` + `seña_pagada`:** El cliente pagó en MercadoPago. La reserva está confirmada.
3.  **`check_in`:** El cliente se presenta en el local, presenta DNI, abona saldo en efectivo y deja la garantía. Se le entregan los monopatines.
4.  **`check_out`:** El cliente devuelve los monopatines en condiciones. Se le devuelve el dinero de la garantía en efectivo.
5.  **`no_show`:** El cliente no se presentó tras superar el tiempo de tolerancia.

### D. Reglas de la Caja Diaria
*   Solo puede haber **una caja por día**.
*   Para poder realizar un `check_in` o `check_out` que involucre manejo de saldos o garantías en efectivo, **la caja del día actual debe estar obligatoriamente ABIERTA**.
*   El cálculo del `total_efectivo_actual` se obtiene sumando al monto de apertura todos los `ingreso_saldo_efectivo`, `ingreso_garantia_efectivo` e `ingreso_manual`, y restando los `egreso_garantia_efectivo` y `gasto_manual`.

---

## 4. Preparación para Migrar a Supabase

Al pasar a un Backend-as-a-Service relacional como Supabase (PostgreSQL), la arquitectura cambiará de la siguiente forma:

1.  **Migración de JSON a Tablas Relacionales:**
    *   `config` -> Tabla de una sola fila o uso de un bucket/KV en base de datos.
    *   `turnos` -> Tabla `shifts` o `turnos`.
    *   `reservas` -> Tabla `reservations`.
    *   `caja` y `transacciones` -> Tabla `cash_registers` (Cajas) y `transactions` con FK a la caja correspondiente y a la reserva.
2.  **Supabase Edge Functions / Webhooks:** El webhook de MercadoPago que actualmente está en `server.ts` deberá migrarse a una Supabase Edge Function para recibir la confirmación de pago de forma segura y actualizar la tabla de reservas en DB.
3.  **Postgres Triggers / Funciones RPC:** 
    *   El recálculo de disponibilidad (`unidades_disponibles`) que hoy se hace en memoria, debería ser una `View` o actualizarse automáticamente mediante *Database Triggers* cada vez que una reserva cambie de estado, o calcularse al vuelo con una consulta SQL sumando las reservas activas por turno.
    *   La auto-liberación de reservas pendientes no pagadas a los 10 minutos puede gestionarse con pg_cron o un check temporal en las queries.
4.  **Real-Time:** Los *Server-Sent Events* de Express se reemplazarán directamente por **Supabase Realtime** (suscripciones a canales y tablas vía PostgreSQL), permitiendo que el Frontend de React escuche instantáneamente cuando entra una nueva reserva o se actualiza la caja.
