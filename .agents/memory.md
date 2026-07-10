# VIUX — Memory del Proyecto
> Última actualización: 2026-07-10

## Estado Actual: MVP LOCAL COMPLETO — Pendiente migración a Supabase

---

## Arquitectura Actual

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 | ✅ COMPLETO |
| Backend | Prescindido (Supabase SDK directo en frontend) | ✅ ELIMINADO / DIRECTO |
| Persistencia | Supabase PostgreSQL Remoto | ✅ ACTIVO |
| Realtime | Supabase Realtime Channels (Postgres changes) | ✅ ACTIVO |
| Pagos | MercadoPago (simulado con impacto de caja) | ⚠️ SIMULADO |
| PWA | manifest.json + sw.js | ✅ CONFIGURADO (faltan iconos) |
| DB Supabase | PostgreSQL / RLS y roles configurados | ✅ COMPLETO |
| Auth Admin | Integrado con auth.users + profiles | ✅ COMPLETO |

---

## Componentes del Frontend

| Archivo | Función | Estado |
|---|---|---|
| `src/App.tsx` | Router principal, lógica de auth admin, SSE listener | ✅ |
| `src/components/LandingPage.tsx` | Página de inicio pública (28KB) | ✅ |
| `src/components/PublicBooking.tsx` | Flujo de reserva cliente (35KB) | ✅ |
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
| GET/POST | `/api/mercadopago/*` | Webhook/simulación de pagos |

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
- [ ] Agregar iconos PWA (icon-192.png y icon-512.png)
- [ ] Deploy en producción (Vercel / Netlify + Supabase)

---

## Archivos Clave
- `DOCUMENTACION.md` — descripción completa del dominio y reglas de negocio
- `MIGRATION.md` — guía paso a paso para Supabase + PWA
- `data.json` — base de datos local activa (9KB)
- `mockdata.json` — datos semilla para Supabase (8.5KB)
- `server.ts` — backend Express completo (1065 líneas / 35KB)
