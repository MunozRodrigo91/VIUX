# Guía de Migración e Integración: GitHub, Supabase & PWA
### VIUX - Plataforma de Alquiler de Monopatines Eléctricos

Esta guía detalla los pasos para migrar el MVP desde el entorno de desarrollo actual hacia su infraestructura definitiva con soporte de **PWA fuera de línea**, almacenamiento persistente relacional en **Supabase (PostgreSQL)**, y sincronización en tiempo real.

---

## 📱 1. Arquitectura PWA (Progressive Web App)

La aplicación ha sido configurada con los archivos esenciales para funcionar como una PWA instalable en dispositivos móviles y de escritorio.

### Archivos creados en el proyecto:
1. `/public/manifest.json`: Define el nombre de la app (`VIUX`), el color de tema (`#FF5500`), el inicio en pantalla completa y los accesos directos.
2. `/public/sw.js` (Service Worker): Cachea los recursos estáticos críticos (`index.html`, assets, etc.) para permitir el inicio de la app instantáneamente, incluso sin conexión a internet.
3. Registro en `index.html`: Se añadió el script nativo de registro del Service Worker en el navegador.

### Recomendación de despliegue:
* Asegúrate de agregar los íconos de la marca (`icon-192.png` y `icon-512.png`) en el directorio `/public/` antes de compilar para producción para evitar errores de carga de manifiesto en Lighthouse.

---

## 🗄️ 2. Diseño de Base de Datos en Supabase (PostgreSQL)

Para migrar la persistencia de datos (actualmente en `/data.json` y respaldada por `/mockdata.json` como sets de datos modelo), debes crear las siguientes tablas en el panel de SQL de Supabase.

Ejecuta el siguiente script SQL en el editor de queries de tu proyecto Supabase:

```sql
-- 1. Tabla de Configuración de la Flota (Precios y Parámetros)
CREATE TABLE public.config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    precio_por_hora INTEGER NOT NULL DEFAULT 8000,
    monto_garantia INTEGER NOT NULL DEFAULT 10000,
    porcentaje_sena INTEGER NOT NULL DEFAULT 30,
    tolerancia_no_show_minutos INTEGER NOT NULL DEFAULT 15,
    capacidad_maxima_scooters INTEGER NOT NULL DEFAULT 4,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insertar configuración inicial por defecto
INSERT INTO public.config (id, precio_por_hora, monto_garantia, porcentaje_sena, tolerancia_no_show_minutos, capacidad_maxima_scooters)
VALUES ('default', 8000, 10000, 30, 15, 4)
ON CONFLICT (id) DO NOTHING;


-- 2. Tabla de Turnos / Horarios Diarios
CREATE TABLE public.turnos (
    id TEXT PRIMARY KEY, -- Formato: YYYY-MM-DD_HHMM (ej: '2026-07-06_0900')
    fecha DATE NOT NULL,
    hora TEXT NOT NULL,
    total_unidades INTEGER NOT NULL DEFAULT 4,
    unidades_disponibles INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- 3. Tabla de Reservas de Clientes
CREATE TABLE public.reservas (
    id TEXT PRIMARY KEY, -- Formato 'res_XXXXXX'
    turno_id TEXT REFERENCES public.turnos(id) ON DELETE SET NULL,
    fecha_turno DATE NOT NULL,
    hora_turno TEXT NOT NULL,
    nombre_cliente TEXT NOT NULL,
    dni_cliente TEXT NOT NULL,
    telefono_cliente TEXT NOT NULL,
    email_cliente TEXT NOT NULL,
    cantidad_monopatines INTEGER NOT NULL CHECK (cantidad_monopatines > 0),
    monto_total INTEGER NOT NULL,
    monto_sena INTEGER NOT NULL,
    monto_saldo INTEGER NOT NULL,
    monto_garantia INTEGER NOT NULL,
    estado_pago TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'seña_pagada')),
    estado_reserva TEXT NOT NULL DEFAULT 'creada' CHECK (estado_reserva IN ('creada', 'check_in', 'check_out', 'no_show')),
    partner TEXT, -- Nombre del hotel o partner que originó el QR (ej: 'Hotel Playas')
    delivery_mode TEXT NOT NULL DEFAULT 'meeting_point' CHECK (delivery_mode IN ('meeting_point', 'hotel_delivery')),
    nombre_hotel TEXT, -- Rellenado si delivery_mode = 'hotel_delivery'
    punto_encuentro_zona TEXT CHECK (punto_encuentro_zona IN ('Pinamar', 'Mar de Ostende', 'Valeria del mar', 'Carilo')), -- Rellenado si delivery_mode = 'meeting_point'
    mp_preference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- 4. Tabla de Cajas Diarias (Operación del Admin)
CREATE TABLE public.cajas (
    fecha DATE PRIMARY KEY,
    monto_apertura INTEGER NOT NULL DEFAULT 15000,
    estado TEXT NOT NULL DEFAULT 'cerrada' CHECK (estado IN ('abierta', 'cerrada')),
    total_efectivo_actual INTEGER NOT NULL DEFAULT 15000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- 5. Tabla de Transacciones de Caja (Auditoría Financiera)
CREATE TABLE public.transacciones (
    id TEXT PRIMARY KEY, -- Formato 'tx_XXXXXX'
    fecha_caja DATE REFERENCES public.cajas(fecha) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('apertura', 'ingreso_seña_mp', 'ingreso_saldo_efectivo', 'ingreso_garantia_efectivo', 'egreso_garantia_efectivo', 'ingreso_manual', 'gasto_manual', 'cierre')),
    monto INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    reserva_id TEXT REFERENCES public.reservas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

---

## 📥 3. Sincronización e Importación de mockdata.json

El archivo `/mockdata.json` que contiene datos semilla ya está disponible en tu entorno para poblar la base de datos Supabase inicialmente.

### Pasos para realizar la importación semilla (Seeding):
1. **Mediante CLI de Supabase** (Recomendado):
   Puedes escribir una función simple de Node.js o utilizar el cliente Supabase de JS para leer `/mockdata.json` e insertar los registros iterativamente:
   ```typescript
   import { createClient } from '@supabase/supabase-api';
   import mockData from './mockdata.json';

   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

   async function seed() {
     // 1. Cargar Configuración
     await supabase.from('config').insert(mockData.config);
     // 2. Cargar Turnos
     await supabase.from('turnos').insert(mockData.turnos);
     // 3. Cargar Reservas
     await supabase.from('reservas').insert(mockData.reservas);
     // 4. Cargar Cajas
     for (const [fecha, infoCaja] of Object.entries(mockData.caja)) {
       await supabase.from('cajas').insert({
         fecha,
         monto_apertura: infoCaja.monto_apertura,
         estado: infoCaja.estado,
         total_efectivo_actual: infoCaja.total_efectivo_actual
       });
       await supabase.from('transacciones').insert(infoCaja.transacciones.map(tx => ({
         ...tx,
         fecha_caja: fecha
       })));
     }
     console.log("¡Base de datos Supabase poblada con éxito!");
   }
   ```
2. **Mediante el Panel de Supabase (Table Editor)**:
   Puedes copiar los bloques JSON de `/mockdata.json` o convertirlos a formato CSV e importarlos usando el botón de importación directa en la interfaz gráfica de Supabase.

---

## 📈 4. Nueva Sección: Analytics & Reportes Descargables

Hemos implementado un módulo de **Analytics de Negocio** en tiempo real en la barra de navegación del Administrador (`AdminPanel.tsx`). Este módulo te provee de las siguientes métricas e indicadores de rendimiento fundamentales para el MVP:

### Indicadores Clave de Rendimiento (KPIs):
* **Facturación Realizada**: Suma monetaria efectiva de todas las señas cobradas online más los saldos cobrados de manera presencial en efectivo (Check-in/Check-out).
* **Facturación Proyectada**: El volumen total que representan todas las reservas que tienen seña pagada.
* **Total de Monopatines Reservados**: Suma acumulada de unidades arrendadas.
* **Tasa de Conversión**: Porcentaje de reservas que completaron el pago de la seña frente al total de reservas iniciadas.

### Reportes de Logística y Demanda:
1. **Distribución de Logística (Punto de Encuentro vs Envíos a Hotel)**: Permite dimensionar la logística necesaria para el transporte de monopatines.
2. **Zonas más Populares**: Visualiza con exactitud qué barrios tienen mayor tráfico y selección (Pinamar, Mar de Ostende, Valeria del Mar, Cariló) con barras de progreso dinámicas.
3. **Horas Pico**: Gráfico de demanda horaria para optimizar la recarga y posicionamiento de flota de scooters.
4. **Desglose de Comisiones a Partners**: Tabla que audita automáticamente qué hoteles refirieron reservas y calcula el 10% de comisión sugerida para el pago de comisiones a los recepcionistas.

### Funcionalidad de Descarga CSV:
* Se ha añadido el botón de **Descargar CSV** que extrae toda la base de datos de reservas dinámicamente y la compila en una planilla de cálculo Excel organizada.
* El archivo incluye DNI, correo electrónico, teléfono, logística (hoteles, puntos de encuentro coordinados), estado de pago y montos detallados.

---

## 🛠️ 5. Frameworks de Desarrollo Recomendados para este MVP

Al portar el código a tu repositorio de GitHub conectado con Antigravity, la configuración recomendada para garantizar velocidad extrema y escalabilidad del MVP consiste en:

1. **Frontend**: **React 18** (desarrollado con componentes funcionales de TypeScript) + **Vite** para compilación ultrarrápida (menos de 1 segundo en recargas).
2. **Estilos**: **Tailwind CSS v4** con soporte nativo de variables CSS y mixins para lograr el look futurista, de alto contraste y limpio de **VIUX** (colores negro carbón y naranja flúor `#FF5500`).
3. **Animaciones**: **Motion (anteriormente Framer Motion)** para las transiciones dinámicas entre pasos del cliente, efectos hover en botones de reserva y el desvanecimiento elegante del ticket de pago.
4. **Iconografía**: **Lucide React** para mantener consistencia en íconos vectoriales modernos y estilizados.
5. **Backend**: 
   * **Supabase Client SDK (`@supabase/supabase-js`)** directamente en el cliente. Esto te permite prescindir de un servidor Node.js para consultar reservas y turnos, usando las políticas RLS (Row Level Security) para proteger la información del panel de administración.
   * **MercadoPago SDK**: Si continúas procesando transacciones reales de Mercado Pago, mantén una función serverless (por ejemplo, Supabase Edge Functions) para generar las preferencias de pago (`preference_id`) y recibir los webhooks (IPN) de pago de manera 100% segura.

---

¡Tu aplicación está completamente lista y optimizada para ser llevada a producción!
