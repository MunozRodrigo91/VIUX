# VIUX — Memory del Proyecto
> Última actualización: 2026-07-22

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
| Pagos | MercadoPago Checkout Pro **REAL** (Edge Function + SDK) | ✅ INTEGRADO |
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

## API Endpoints del server.ts

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/config` | Obtener configuración |
| POST | `/api/config` | Actualizar configuración |
| GET | `/api/turnos` | Listar turnos (con auto-generación por fecha) |
| POST | `/api/turnos/set-capacity` | Ajustar capacidad de un turno |
| POST | `/api/reservas` | Crear nueva reserva |
| GET | `/api/reservas` | Listar reservas (con filtro por fecha) |
| GET | `/api/reservas/:id` | Ver reserva individual |
| POST | `/api/reservas/:id/checkin` | Check-in (cobra saldo + garantía) |
| POST | `/api/reservas/:id/checkout` | Check-out (devuelve garantía) |
| POST | `/api/reservas/:id/no-show` | Marcar no-show |
| GET | `/api/caja` | Estado de caja de una fecha |
| POST | `/api/caja/abrir` | Abrir caja del día |
| POST | `/api/caja/cerrar` | Cerrar caja del día |
| POST | `/api/caja/ingreso` | Ingreso manual |
| POST | `/api/caja/gasto` | Gasto manual |
| GET | `/api/events` | SSE stream de actualizaciones |
| GET/POST | `/api/mercadopago/*` | Webhook/simulación de pagos (legacy) |

---

## Edge Functions Supabase

| Función | Descripción | Estado |
|---|---|---|
| `validate-booking` | Crea reserva atómicamente en DB | ✅ ACTIVA (deployada 2026-07-22) |
| `create-mp-preference` | Genera preferencia real MP Checkout Pro (30% seña) | ✅ ACTIVA |

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
- [x] **Gestión avanzada de turnos en Panel de Operación (2026-07-21)**:
    - Toggle habilitar/inhabilitar horario (campo `habilitado BOOLEAN` en tabla `turnos`)
    - Selector de duración por turno: 1h / 2h / Día completo (campo `duracion_horas INTEGER NULL`)
    - Turnos inhabilitados NO se muestran al cliente
    - Horarios pasados (hora < hora actual, mismo día) NO se muestran al cliente
    - Precios diferenciados por duración: `precio_2_horas` y `precio_dia_completo` en tabla `config`
    - Panel de Ajustes muestra los 3 precios editables: 1h, 2h, Día completo
    - Seleccionar 0 monopatines inhabilita el turno automáticamente
- [x] **CRUD completo de turnos en Panel de Operación (2026-07-21)**:
    - Formulario para crear turnos: hora (select 08:00-20:00), duración (1h/2h/Día), monopatines (1-4)
    - Validación anti-duplicado (misma fecha + misma hora)
    - Botón "Generar día completo": crea en un click los turnos de 09:00 a 19:00 faltantes
    - Botón de eliminación individual por turno (con confirmación)
    - Lista de turnos ordenada por hora con edición inline de duración, capacidad y visibilidad

---

## Próximo Hito: Migración a Supabase

### Tareas Pendientes
- [x] Crear proyecto en Supabase
- [x] Ejecutar script SQL del MIGRATION.md (5 tablas)
- [x] Seed de datos desde mockdata.json
- [x] Reemplazar fetch("/api/*") por Supabase Client SDK
- [x] Migrar webhook MercadoPago a Supabase Edge Function (validate-booking y simulación listas)
- [x] Reemplazar SSE por Supabase Realtime
- [x] Implementar RLS (Row Level Security) para admin
- [x] Quitar demo credentials de UI y crear Admin User seguro en auth.users
- [ ] Agregar iconos PWA (icon-192.png y icon-512.png)
- [x] Deploy en producción (Vercel / Netlify + Supabase)
- [x] **Integración MercadoPago Checkout Pro REAL (2026-07-22)**:
    - Nueva Edge Function `create-mp-preference` deployada en Supabase
    - Secrets `MP_ACCESS_TOKEN` y `APP_URL` configurados en Supabase
    - SDK oficial de MP cargado desde CDN en `index.html`
    - Step 4 del flujo de reserva usa SDK real con botón MP oficial
    - back_urls configuradas: `?payment=success/failure/pending&external_reference=reserva_id`
    - `App.tsx` maneja las 3 back_urls de retorno y actualiza estado en Supabase
    - Botón de aprobación directa conservado para demos internas

---

## Archivos Clave
- `DOCUMENTACION.md` — descripción completa del dominio y reglas de negocio
- `MIGRATION.md` — guía paso a paso para Supabase + PWA
- `data.json` — base de datos local activa (9KB)
- `mockdata.json` — datos semilla para Supabase (8.5KB)
- `server.ts` — backend Express completo (1065 líneas / 35KB)
- `netlify.toml` — configuración de redirecciones y build de Netlify

