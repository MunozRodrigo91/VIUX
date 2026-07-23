# VIUX — Memory del Proyecto
> Última actualización: 2026-07-23

## ⚠️ CAMBIO COMPLETADO: Ajuste de Zonas, Pie de Página y Edad Mínima (2026-07-23)
- **Footer**: Eliminada la mención a `"Bunge & Playa"` en el pie de página de [`src/App.tsx`](file:///c:/Users/rodri/VIUX/src/App.tsx).
- **Zonas y Recorridos**: Eliminada la zona de Cariló del mapa de recorridos, del selector de puntos de encuentro y de los textos informativos. Actualizadas las referencias de Ostende a **"Mar de Ostende"** en [`src/components/LandingPage.tsx`](file:///c:/Users/rodri/VIUX/src/components/LandingPage.tsx), [`src/components/PublicBooking.tsx`](file:///c:/Users/rodri/VIUX/src/components/PublicBooking.tsx), [`src/components/TicketView.tsx`](file:///c:/Users/rodri/VIUX/src/components/TicketView.tsx) y [`src/types.ts`](file:///c:/Users/rodri/VIUX/src/types.ts).
- **Edad Mínima**: Modificada la edad mínima requerida de 18 a **16 años** en [`src/components/LandingPage.tsx`](file:///c:/Users/rodri/VIUX/src/components/LandingPage.tsx).

## ⚠️ CAMBIO COMPLETADO: Filtro de Reservas Confirmadas y Redirección MercadoPago (2026-07-23)
- **Filtro en AdminPanel**: En la pestaña de Reservas se muestran por defecto únicamente las reservas con **Seña Pagada (`seña_pagada`)**. Se incluyeron botones de acceso rápido para filtrar entre "✅ Con Seña", "⏳ Sin Abonar" y "Todas".
- **Redirección PWA Post-Pago**: Al retornar desde MercadoPago con `payment=success`, `App.tsx` actualiza la reserva, registra la seña en la caja abierta y conmuta la pantalla al **Ticket Confirmado (Paso 5)**. Adicionalmente limpia la URL reemplazando los parámetros query a `?reserva_confirmada=res_XXXX` mediante `window.history.replaceState`.

## ⚠️ CAMBIO COMPLETADO: MercadoPago Sandbox → Producción (2026-07-23)
- Se reemplazaron las credenciales de sandbox por las de producción en `.env`
- Se eliminó el fallback hardcodeado del Access Token en la Edge Function `create-mp-preference`
- Se agregó validación explícita si `MP_ACCESS_TOKEN` no está configurado
- Se removió `sandbox_init_point` del response de la Edge Function
- Se actualizó `APP_URL` a `https://viux.ar` (producción)
- Se actualizó `.env.example` con placeholders de MercadoPago
- **PENDIENTE**: Configurar las variables en el hosting (Netlify + Supabase Edge Functions)

## ⚠️ BUG CONOCIDO RESUELTO: Error en selección de fechas (2026-07-23)
- El uso de `new Date().toISOString()` generaba fechas en UTC. En horario de Argentina (después de las 21hs), generaba el día siguiente, causando que los turnos del día siguiente fueran tratados como "hoy" y se ocultaran.
- Solución: Se implementó `getLocalDateString()` en `AdminPanel` y `PublicBooking` para tomar la fecha según la zona horaria del cliente.

## ⚠️ BUG CONOCIDO RESUELTO: Recursión infinita en RLS de `profiles`
- La política `"Admin total sobre perfiles"` consultaba `profiles` para verificar si el usuario era admin → loop infinito
- Solución: reemplazada por `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`
- También se corrigió el campo login: de texto libre a `type="email"` (evitaba confusión de credenciales)

## ⚠️ BUG CONOCIDO RESUELTO: Mismatch campo monto_seña / monto_sena (2026-07-22)
- La DB de Supabase tiene la columna `monto_sena` (sin ñ), pero el tipo `Reserva` definía `monto_seña` (con ñ)
- Esto causaba: panel admin en negro + crash en TicketView + datos undefined en el flujo de pago
- Solución: `types.ts` actualizado → `monto_sena` es el campo principal, `monto_seña` queda como alias opcional (legacy para server.ts)
- Archivos corregidos: `types.ts`, `App.tsx`, `AdminPanel.tsx`, `PublicBooking.tsx`, `TicketView.tsx`, `server.ts`

## ⚠️ BUG CONOCIDO RESUELTO: validate-booking no estaba deployada en Supabase (2026-07-22)
- La Edge Function existía localmente pero nunca fue subida → 404 al intentar reservar
- Solución: deployada via MCP de Supabase, ACTIVA

---

## Arquitectura Actual

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 | ✅ COMPLETO |
| Backend | Prescindido (Supabase SDK directo en frontend) | ✅ ELIMINADO / DIRECTO |
| Persistencia | Supabase PostgreSQL Remoto | ✅ ACTIVO |
| Realtime | Supabase Realtime Channels (Postgres changes) | ✅ ACTIVO |
| Pagos | MercadoPago Checkout Pro **PRODUCCIÓN** (Edge Function + SDK) | ✅ PRODUCCIÓN |
| PWA | manifest.json + sw.js | ✅ CONFIGURADO (faltan iconos) |
| DB Supabase | PostgreSQL / RLS y roles configurados | ✅ COMPLETO |
| Auth Admin | Integrado con auth.users + profiles | ✅ COMPLETO |

---

## Componentes del Frontend

| Archivo | Función | Estado |
|---|---|---|
| `src/App.tsx` | Router principal + manejo back_urls MP (`?payment=success/failure/pending`) | ✅ |
| `src/components/LandingPage.tsx` | Página de inicio pública (28KB) | ✅ |
| `src/components/PublicBooking.tsx` | Flujo de reserva cliente — Step 4 con MP Checkout Pro real | ✅ |
| `src/components/AdminPanel.tsx` | Panel admin + Analytics + Caja (69KB — el más grande) | ✅ |
| `src/components/TicketView.tsx` | Ticket post-pago de la reserva | ✅ |
| `src/components/ProgressIndicator.tsx` | Indicador de pasos del flujo | ✅ |
| `src/types.ts` | Tipos TypeScript del dominio | ✅ |

---

## Reglas de Negocio Implementadas
- [x] Reserva bloquea stock por 10 min hasta pago de seña
- [x] Seña = 30% del total (configurable)
- [x] Garantía por unidad cobrada en efectivo en Check-In
- [x] Devolución de garantía en Check-Out resta del efectivo real
- [x] Solo una caja por día
- [x] Check-In requiere caja ABIERTA
- [x] Estados de reserva: creada → seña_pagada → check_in → check_out / no_show
- [x] Turnos de 09:00 a 19:00 con auto-generación por fecha
- [x] **Selección Dinámica de Duración (2026-07-23)**:
    - Cliente elige duración en `PublicBooking` (1 hora, 2 horas, Día completo)
    - Precios calculados dinámicamente: `precio_por_hora`, `precio_2_horas`, `precio_dia_completo`
    - Bloqueo en DB real: Si cliente elige > 1 hora, se bloquea el stock correspondiente en los turnos subsecuentes.
    - Script SQL proporcionado `MIGRATION_UPDATES.sql` para alterar `reservas` y recrear `atomic_reserve`.
- [x] **CRUD completo de turnos en Panel de Operación**:
    - Formulario para crear turnos: hora, monopatines.
    - Validación anti-duplicado y generación masiva.

---

## Próximo Hito: Migración a Supabase

### Tareas Pendientes
- [x] Crear proyecto en Supabase
- [x] Ejecutar script SQL del MIGRATION.md (5 tablas)
- [x] **(IMPORTANTE) Ejecutar `MIGRATION_UPDATES.sql` en Supabase para habilitar selección de duración**
- [x] MercadoPago → modo PRODUCCIÓN (credenciales + Edge Function)
- [ ] **Configurar variables de entorno en Supabase Edge Functions** (`MP_ACCESS_TOKEN`, `APP_URL`)
- [ ] **Configurar variable de entorno en Netlify** (`VITE_MP_PUBLIC_KEY`)
- [ ] Agregar iconos PWA (icon-192.png y icon-512.png)

---

## Archivos Clave
- `DOCUMENTACION.md` — descripción completa del dominio y reglas de negocio
- `MIGRATION.md` — guía paso a paso para Supabase + PWA
- `MIGRATION_UPDATES.sql` — Actualización de DB para duraciones dinámicas
- `server.ts` — backend Express completo (1065 líneas / 35KB)
