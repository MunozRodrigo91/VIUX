import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Config, Turno, Reserva, Caja, Transaccion, PartnerStats } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path to persistent data storage
const DATA_FILE = path.join(process.cwd(), "data.json");

// Helper to get formatted dates in Pinamar (Argentina, offset-3 or local)
function getLocalDateString(offsetDays = 0) {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY_STR = getLocalDateString(0);
const TOMORROW_STR = getLocalDateString(1);

// Default Configuration
const DEFAULT_CONFIG: Config = {
  precioPorHora: 8000,
  montoGarantia: 10000,
  porcentajeSeña: 30,
  toleranciaNoShowMinutos: 15,
  capacidadMaximaScooters: 4
};

// Interface for persistent DB structure
interface DB {
  config: Config;
  turnos: Turno[];
  reservas: Reserva[];
  caja: { [fecha: string]: Caja };
}

// Initialize database with seed data if not present
function loadDB(): DB {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading database file, using defaults", e);
    }
  }

  // Generate turnos for today and tomorrow (from 09:00 to 19:00)
  const seedTurnos: Turno[] = [];
  const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
  
  [TODAY_STR, TOMORROW_STR].forEach(fecha => {
    hours.forEach(hora => {
      seedTurnos.push({
        id: `${fecha}_${hora.replace(":", "")}`,
        fecha,
        hora,
        total_unidades: 4,
        unidades_disponibles: 4
      });
    });
  });

  // Seed initial reservations
  // Res 1: Completed check-out today morning (09:00 to 10:00)
  const res1Id = "res_1001";
  const res1: Reserva = {
    id: res1Id,
    turno_id: `${TODAY_STR}_0900`,
    fecha_turno: TODAY_STR,
    hora_turno: "09:00",
    nombre_cliente: "Martín Gómez",
    dni_cliente: "38491823",
    telefono_cliente: "+54 9 2254 41-2345",
    email_cliente: "martin.gomez@gmail.com",
    cantidad_monopatines: 2,
    monto_total: 16000,
    monto_seña: 4800,
    monto_saldo: 11200,
    monto_garantia: 20000,
    estado_pago: "seña_pagada",
    estado_reserva: "check_out",
    partner: "Hotel del Bosque",
    mp_preference_id: "pref_mp_101",
    created_at: new Date(new Date().setHours(new Date().getHours() - 6)).toISOString()
  };

  // Res 2: Currently active check-in (11:00 to 12:00)
  const res2Id = "res_1002";
  const res2: Reserva = {
    id: res2Id,
    turno_id: `${TODAY_STR}_1100`,
    fecha_turno: TODAY_STR,
    hora_turno: "11:00",
    nombre_cliente: "Sofía Rodríguez",
    dni_cliente: "41029481",
    telefono_cliente: "+54 9 11 5501-9982",
    email_cliente: "sofia.rod@gmail.com",
    cantidad_monopatines: 1,
    monto_total: 8000,
    monto_seña: 2400,
    monto_saldo: 5600,
    monto_garantia: 10000,
    estado_pago: "seña_pagada",
    estado_reserva: "check_in",
    partner: "Hotel Playas",
    mp_preference_id: "pref_mp_102",
    created_at: new Date(new Date().setHours(new Date().getHours() - 4)).toISOString()
  };

  // Res 3: Reserved for late today (17:00 to 18:00)
  const res3Id = "res_1003";
  const res3: Reserva = {
    id: res3Id,
    turno_id: `${TODAY_STR}_1700`,
    fecha_turno: TODAY_STR,
    hora_turno: "17:00",
    nombre_cliente: "Alejandro Pérez",
    dni_cliente: "35912482",
    telefono_cliente: "+54 9 2267 52-9481",
    email_cliente: "perez.ale@outlook.com",
    cantidad_monopatines: 2,
    monto_total: 16000,
    monto_seña: 4800,
    monto_saldo: 11200,
    monto_garantia: 20000,
    estado_pago: "seña_pagada",
    estado_reserva: "creada",
    partner: "Hotel del Bosque",
    mp_preference_id: "pref_mp_103",
    created_at: new Date(new Date().setHours(new Date().getHours() - 2)).toISOString()
  };

  const seedReservas: Reserva[] = [res1, res2, res3];

  // Seed Caja for Today
  const seedTransacciones: Transaccion[] = [
    {
      id: "tx_01",
      tipo: "apertura",
      monto: 15000,
      descripcion: "Apertura de caja inicial",
      created_at: new Date(new Date().setHours(8, 0, 0)).toISOString()
    },
    {
      id: "tx_02",
      tipo: "ingreso_seña_mp",
      monto: 4800,
      descripcion: `Seña Online MP - Reserva Martín Gómez (${res1Id})`,
      reserva_id: res1Id,
      created_at: new Date(new Date().setHours(8, 15, 0)).toISOString()
    },
    {
      id: "tx_03",
      tipo: "ingreso_seña_mp",
      monto: 2400,
      descripcion: `Seña Online MP - Reserva Sofía Rodríguez (${res2Id})`,
      reserva_id: res2Id,
      created_at: new Date(new Date().setHours(9, 10, 0)).toISOString()
    },
    {
      id: "tx_04",
      tipo: "ingreso_seña_mp",
      monto: 4800,
      descripcion: `Seña Online MP - Reserva Alejandro Pérez (${res3Id})`,
      reserva_id: res3Id,
      created_at: new Date(new Date().setHours(10, 0, 0)).toISOString()
    },
    // Martín Gómez Check-in (cobro de saldo y garantía)
    {
      id: "tx_05",
      tipo: "ingreso_saldo_efectivo",
      monto: 11200,
      descripcion: `Cobro Saldo Efectivo - Reserva Martín Gómez (${res1Id})`,
      reserva_id: res1Id,
      created_at: new Date(new Date().setHours(9, 5, 0)).toISOString()
    },
    {
      id: "tx_06",
      tipo: "ingreso_garantia_efectivo",
      monto: 20000,
      descripcion: `Garantía Efectivo - Reserva Martín Gómez (${res1Id})`,
      reserva_id: res1Id,
      created_at: new Date(new Date().setHours(9, 6, 0)).toISOString()
    },
    // Martín Gómez Check-out (devolución de garantía)
    {
      id: "tx_07",
      tipo: "egreso_garantia_efectivo",
      monto: 20000,
      descripcion: `Devolución Garantía - Reserva Martín Gómez (${res1Id})`,
      reserva_id: res1Id,
      created_at: new Date(new Date().setHours(10, 15, 0)).toISOString()
    },
    // Sofía Rodríguez Check-in
    {
      id: "tx_08",
      tipo: "ingreso_saldo_efectivo",
      monto: 5600,
      descripcion: `Cobro Saldo Efectivo - Reserva Sofía Rodríguez (${res2Id})`,
      reserva_id: res2Id,
      created_at: new Date(new Date().setHours(11, 5, 0)).toISOString()
    },
    {
      id: "tx_09",
      tipo: "ingreso_garantia_efectivo",
      monto: 10000,
      descripcion: `Garantía Efectivo - Reserva Sofía Rodríguez (${res2Id})`,
      reserva_id: res2Id,
      created_at: new Date(new Date().setHours(11, 6, 0)).toISOString()
    }
  ];

  const initialCaja: Caja = {
    fecha: TODAY_STR,
    monto_apertura: 15000,
    estado: "abierta",
    transacciones: seedTransacciones,
    total_efectivo_actual: 15000 + 11200 + 20000 - 20000 + 5600 + 10000 // 41800 (Note: Online deposits by MP are NOT cash in register, wait, are they? Deposit is digital, we separate it. Cash in register has apertura, cash balances, guarantees in and out. So cash is apertura (15000) + saldo res1 (11200) + gar1 in (20000) - gar1 out (20000) + saldo res2 (5600) + gar2 in (10000) = 41800!)
  };

  const db: DB = {
    config: DEFAULT_CONFIG,
    turnos: seedTurnos,
    reservas: seedReservas,
    caja: {
      [TODAY_STR]: initialCaja
    }
  };

  // Compute initial available units for seed turnos
  recalculateTurnosAvailability(db);
  saveDB(db);
  return db;
}

function saveDB(db: DB) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving database file", e);
  }
}

// Function to recalculate available units in turnos
function recalculateTurnosAvailability(db: DB) {
  const activeBookings = db.reservas.filter(r => {
    // A booking consumes units if it is paid, or currently in check_in/check_out
    const isPaid = r.estado_pago === "seña_pagada";
    const isActiveStatus = r.estado_reserva === "check_in" || r.estado_reserva === "check_out" || r.estado_reserva === "creada";
    
    // Also include pending payment bookings if they were created in the last 10 minutes to hold the slots
    const isRecentlyPending = r.estado_pago === "pendiente" && 
      (Date.now() - new Date(r.created_at).getTime()) < 10 * 60 * 1000;
      
    return (isPaid && isActiveStatus) || (isRecentlyPending && r.estado_reserva === "creada");
  });

  db.turnos.forEach(turno => {
    const reservedUnits = activeBookings
      .filter(r => r.turno_id === turno.id)
      .reduce((sum, r) => sum + r.cantidad_monopatines, 0);
    
    turno.unidades_disponibles = Math.max(0, turno.total_unidades - reservedUnits);
  });
}

// Global DB instance
const dbInstance = loadDB();

// SSE Real-time client list
let clients: { id: number; res: any }[] = [];

function broadcastRealtimeUpdate(type: string, data: any) {
  clients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    } catch (e) {
      console.error("Error sending SSE to client", client.id, e);
    }
  });
}

// --- API ENDPOINTS ---

// Server-sent events endpoint for real-time updates
app.get("/api/realtime", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.write("\n");

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on("close", () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

// Config endpoints
app.get("/api/config", (req, res) => {
  res.json(dbInstance.config);
});

app.post("/api/config", (req, res) => {
  dbInstance.config = { ...dbInstance.config, ...req.body };
  saveDB(dbInstance);
  broadcastRealtimeUpdate("config_updated", dbInstance.config);
  res.json(dbInstance.config);
});

// Turnos list
app.get("/api/turnos", (req, res) => {
  const { fecha } = req.query;
  recalculateTurnosAvailability(dbInstance);
  
  if (fecha) {
    const filtered = dbInstance.turnos.filter(t => t.fecha === fecha);
    // If turnos don't exist for this date, let's auto-generate them
    if (filtered.length === 0) {
      const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
      hours.forEach(hora => {
        dbInstance.turnos.push({
          id: `${fecha}_${hora.replace(":", "")}`,
          fecha: fecha as string,
          hora,
          total_unidades: dbInstance.config.capacidadMaximaScooters,
          unidades_disponibles: dbInstance.config.capacidadMaximaScooters
        });
      });
      saveDB(dbInstance);
      const newlyGenerated = dbInstance.turnos.filter(t => t.fecha === fecha);
      return res.json(newlyGenerated);
    }
    return res.json(filtered);
  }
  res.json(dbInstance.turnos);
});

// Create/Update a specific shift manually (admin capacity override)
app.post("/api/turnos/set-capacity", (req, res) => {
  const { id, total_unidades } = req.body;
  const tIndex = dbInstance.turnos.findIndex(t => t.id === id);
  if (tIndex !== -1) {
    dbInstance.turnos[tIndex].total_unidades = total_unidades;
    recalculateTurnosAvailability(dbInstance);
    saveDB(dbInstance);
    broadcastRealtimeUpdate("turnos_updated", { fecha: dbInstance.turnos[tIndex].fecha });
    res.json(dbInstance.turnos[tIndex]);
  } else {
    res.status(404).json({ error: "Turno no encontrado" });
  }
});

// Create booking (Step 3/4)
app.post("/api/reservas", (req, res) => {
  const { turno_id, nombre_cliente, dni_cliente, telefono_cliente, email_cliente, cantidad_monopatines, partner, delivery_mode, nombre_hotel, punto_encuentro_zona } = req.body;
  
  if (!turno_id || !nombre_cliente || !dni_cliente || !telefono_cliente || !email_cliente || !cantidad_monopatines) {
    return res.status(400).json({ error: "Todos los campos (Nombre, DNI, Teléfono, Email, Cantidad) son obligatorios" });
  }

  // Find turno
  const turno = dbInstance.turnos.find(t => t.id === turno_id);
  if (!turno) {
    return res.status(404).json({ error: "Turno no encontrado" });
  }

  // Recalculate available scooters
  recalculateTurnosAvailability(dbInstance);
  if (turno.unidades_disponibles < cantidad_monopatines) {
    return res.status(400).json({ error: "No hay suficientes monopatines disponibles en este turno" });
  }

  // Calculations
  const precioPorHora = dbInstance.config.precioPorHora;
  const montoGarantiaUnitario = dbInstance.config.montoGarantia;
  const total = precioPorHora * cantidad_monopatines;
  const seña = Math.round(total * (dbInstance.config.porcentajeSeña / 100));
  const saldo = total - seña;
  const garantia = montoGarantiaUnitario * cantidad_monopatines;

  const id = "res_" + Math.random().toString(36).substr(2, 9);
  
  // MercadoPago simulated Preference ID
  const mp_preference_id = `pref_mp_${id}`;

  const nuevaReserva: Reserva = {
    id,
    turno_id,
    fecha_turno: turno.fecha,
    hora_turno: turno.hora,
    nombre_cliente,
    dni_cliente,
    telefono_cliente,
    email_cliente,
    cantidad_monopatines,
    monto_total: total,
    monto_seña: seña,
    monto_saldo: saldo,
    monto_garantia: garantia,
    estado_pago: "pendiente",
    estado_reserva: "creada",
    partner: partner || undefined,
    delivery_mode: delivery_mode || "meeting_point",
    nombre_hotel: nombre_hotel || undefined,
    punto_encuentro_zona: punto_encuentro_zona || undefined,
    mp_preference_id,
    created_at: new Date().toISOString()
  };

  dbInstance.reservas.push(nuevaReserva);
  recalculateTurnosAvailability(dbInstance);
  saveDB(dbInstance);

  // Broadcast realtime updates of available turnos immediately
  broadcastRealtimeUpdate("turnos_updated", { fecha: turno.fecha });
  broadcastRealtimeUpdate("reserva_creada", nuevaReserva);

  res.json({
    reserva: nuevaReserva,
    checkout_url: `/api/mercadopago/checkout-simulado?pref_id=${mp_preference_id}&res_id=${id}`
  });
});

// View reservations (admin or public query)
app.get("/api/reservas", (req, res) => {
  const { fecha } = req.query;
  if (fecha) {
    const filtered = dbInstance.reservas.filter(r => r.fecha_turno === fecha);
    return res.json(filtered);
  }
  res.json(dbInstance.reservas);
});

app.get("/api/reservas/:id", (req, res) => {
  const resId = req.params.id;
  const r = dbInstance.reservas.find(item => item.id === resId);
  if (r) {
    res.json(r);
  } else {
    res.status(404).json({ error: "Reserva no encontrada" });
  }
});

// MercadoPago Checkout simulation page/redirect
app.get("/api/mercadopago/checkout-simulado", (req, res) => {
  const { pref_id, res_id } = req.query;
  const r = dbInstance.reservas.find(item => item.id === res_id);
  if (!r) {
    return res.status(404).send("Reserva no encontrada");
  }

  // Return simple, elegant, mock MP checkout screen HTML
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mercado Pago - Checkout Pro Simulado</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background-color: #F5F5F5;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          color: #333;
        }
        .checkout-card {
          background: white;
          max-width: 420px;
          width: 100%;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .header {
          background-color: #009EE3;
          color: white;
          padding: 24px;
          text-align: center;
          font-weight: 700;
          font-size: 20px;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 24px;
        }
        .concept {
          font-size: 14px;
          color: #666;
          margin-bottom: 4px;
        }
        .amount {
          font-size: 32px;
          font-weight: 700;
          color: #333;
          margin-bottom: 24px;
          display: flex;
          align-items: baseline;
        }
        .amount span {
          font-size: 18px;
          font-weight: 500;
          margin-right: 4px;
        }
        .details-box {
          background-color: #F9F9F9;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          font-size: 14px;
          line-height: 1.5;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .row:last-child {
          margin-bottom: 0;
        }
        .label {
          color: #777;
        }
        .val {
          font-weight: 500;
          color: #111;
        }
        .btn {
          display: block;
          width: 100%;
          background-color: #009EE3;
          color: white;
          border: none;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          margin-bottom: 12px;
          box-sizing: border-box;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: #0084c0;
        }
        .btn-cancel {
          background-color: transparent;
          color: #666;
          border: 1px solid #CCC;
        }
        .btn-cancel:hover {
          background-color: #EEE;
          color: #333;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #999;
          padding: 16px;
          border-top: 1px solid #EEE;
        }
      </style>
    </head>
    <body>
      <div class="checkout-card">
        <div class="header">
          MERCADO PAGO
        </div>
        <div class="content">
          <div class="concept">Pago de Seña (30%)</div>
          <div class="amount"><span>$</span>${r.monto_seña.toLocaleString("es-AR")}</div>
          
          <div class="details-box">
            <div class="row">
              <span class="label">Reserva ID</span>
              <span class="val">${r.id}</span>
            </div>
            <div class="row">
              <span class="label">Cliente</span>
              <span class="val">${r.nombre_cliente}</span>
            </div>
            <div class="row">
              <span class="label">Monopatines</span>
              <span class="val">${r.cantidad_monopatines} unidad(es)</span>
            </div>
            <div class="row">
              <span class="label">Fecha y Turno</span>
              <span class="val">${r.fecha_turno} a las ${r.hora_turno} hs</span>
            </div>
          </div>
          
          <form id="payForm" action="/api/mercadopago/webhook" method="POST">
            <input type="hidden" name="reserva_id" value="${r.id}" />
            <input type="hidden" name="preference_id" value="${pref_id}" />
            <input type="hidden" name="status" value="approved" />
            <button type="submit" class="btn">Simular Pago Aprobado</button>
          </form>

          <form action="/api/mercadopago/webhook" method="POST">
            <input type="hidden" name="reserva_id" value="${r.id}" />
            <input type="hidden" name="preference_id" value="${pref_id}" />
            <input type="hidden" name="status" value="rejected" />
            <button type="submit" class="btn btn-cancel">Simular Pago Rechazado</button>
          </form>
        </div>
        <div class="footer">
          Esta es una pantalla de simulación de MercadoPago Checkout Pro para entornos de prueba.
        </div>
      </div>
    </body>
    </html>
  `);
});

// MercadoPago Webhook / Redirect handler
app.post("/api/mercadopago/webhook", (req, res) => {
  const { reserva_id, preference_id, status } = req.body;
  const rIndex = dbInstance.reservas.findIndex(item => item.id === reserva_id);
  
  if (rIndex === -1) {
    return res.status(404).send("Reserva no encontrada");
  }

  const r = dbInstance.reservas[rIndex];

  if (status === "approved") {
    r.estado_pago = "seña_pagada";
    
    // Add transaction to Caja if open
    const fechaTurno = r.fecha_turno;
    let caja = dbInstance.caja[fechaTurno];
    
    // Fallback: If caja is not open, automatically open it or create ledger so the payment is tracked
    if (!caja) {
      caja = {
        fecha: fechaTurno,
        monto_apertura: 0,
        estado: "abierta",
        transacciones: [],
        total_efectivo_actual: 0
      };
      dbInstance.caja[fechaTurno] = caja;
    }

    if (caja.estado === "abierta") {
      const txId = "tx_" + Math.random().toString(36).substr(2, 9);
      const nuevaTx: Transaccion = {
        id: txId,
        tipo: "ingreso_seña_mp",
        monto: r.monto_seña,
        descripcion: `Seña Online MP - Reserva ${r.nombre_cliente} (${r.id})`,
        reserva_id: r.id,
        created_at: new Date().toISOString()
      };
      caja.transacciones.push(nuevaTx);
      // Wait: Online deposits are electronic, they are part of total balance but not cash in drawer.
      // Let's keep total_efectivo_actual updated as just physical cash, and track online separately or include it.
      // In our code, we will show "Efectivo en Caja" and "Monto Digital MP" in the reports.
    }

    recalculateTurnosAvailability(dbInstance);
    saveDB(dbInstance);

    // Broadcast SSE event
    broadcastRealtimeUpdate("pago_confirmado", r);
    broadcastRealtimeUpdate("turnos_updated", { fecha: r.fecha_turno });

    // Send the user back to the app with a success param
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pago Exitoso</title>
        <meta http-equiv="refresh" content="3;url=/?reserva_confirmada=${r.id}" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; text-align: center; padding: 50px; background-color: #FAF7F1; color: #162420; }
          .card { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; border: 1px solid #E4DFD2; }
          .icon { font-size: 48px; color: #0F6E66; margin-bottom: 20px; }
          h2 { margin-bottom: 10px; }
          p { color: #5C6B62; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>¡Pago Procesado!</h2>
          <p>Tu seña de $${r.monto_seña.toLocaleString("es-AR")} fue cobrada con éxito.</p>
          <p>Redirigiendo a tu ticket de reserva...</p>
        </div>
      </body>
      </html>
    `);
  } else {
    // Payment failed or was rejected
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pago Fallido</title>
        <meta http-equiv="refresh" content="3;url=/?reserva_fallida=${r.id}" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; text-align: center; padding: 50px; background-color: #FAF7F1; color: #162420; }
          .card { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; border: 1px solid #E4DFD2; }
          .icon { font-size: 48px; color: #D9534F; margin-bottom: 20px; }
          h2 { margin-bottom: 10px; }
          p { color: #5C6B62; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✗</div>
          <h2>Pago No Aprobado</h2>
          <p>La operación no pudo completarse. Redirigiendo para que intentes nuevamente...</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Admin endpoint: Check-In reservation (cobrar saldo y registrar garantía)
app.post("/api/reservas/:id/check-in", (req, res) => {
  const { id } = req.params;
  const { dni_cliente } = req.body;
  const r = dbInstance.reservas.find(item => item.id === id);
  if (!r) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }

  if (r.estado_reserva !== "creada" || r.estado_pago !== "seña_pagada") {
    return res.status(400).json({ error: "No es posible realizar check-in en este estado" });
  }

  const fechaHoy = getLocalDateString(0);
  const caja = dbInstance.caja[fechaHoy];
  if (!caja || caja.estado !== "abierta") {
    return res.status(400).json({ error: "La caja del día de hoy debe estar ABIERTA para procesar cobros en efectivo." });
  }

  // Action
  r.estado_reserva = "check_in";
  if (dni_cliente) {
    r.dni_cliente = dni_cliente;
  }

  // Transactions: Cobro Saldo Efectivo (70%)
  const txSaldoId = "tx_" + Math.random().toString(36).substr(2, 9);
  const txSaldo: Transaccion = {
    id: txSaldoId,
    tipo: "ingreso_saldo_efectivo",
    monto: r.monto_saldo,
    descripcion: `Cobro Saldo Efectivo - Reserva ${r.nombre_cliente} (${r.id})`,
    reserva_id: r.id,
    created_at: new Date().toISOString()
  };
  caja.transacciones.push(txSaldo);

  // Transactions: Cobro Garantía Efectivo
  const txGarantiaId = "tx_" + Math.random().toString(36).substr(2, 9);
  const txGarantia: Transaccion = {
    id: txGarantiaId,
    tipo: "ingreso_garantia_efectivo",
    monto: r.monto_garantia,
    descripcion: `Garantía Efectivo Ingreso - Reserva ${r.nombre_cliente} (${r.id})`,
    reserva_id: r.id,
    created_at: new Date().toISOString()
  };
  caja.transacciones.push(txGarantia);

  // Recompute cash
  caja.total_efectivo_actual = caja.monto_apertura + caja.transacciones.reduce((sum, t) => {
    if (t.tipo === "ingreso_saldo_efectivo" || t.tipo === "ingreso_garantia_efectivo" || t.tipo === "ingreso_manual") {
      return sum + t.monto;
    }
    if (t.tipo === "egreso_garantia_efectivo" || t.tipo === "gasto_manual") {
      return sum - t.monto;
    }
    return sum;
  }, 0);

  saveDB(dbInstance);
  broadcastRealtimeUpdate("reserva_updated", r);
  broadcastRealtimeUpdate("caja_updated", caja);

  res.json({ reserva: r, caja });
});

// Admin endpoint: Check-Out reservation (devolver garantía)
app.post("/api/reservas/:id/check-out", (req, res) => {
  const { id } = req.params;
  const r = dbInstance.reservas.find(item => item.id === id);
  if (!r) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }

  if (r.estado_reserva !== "check_in") {
    return res.status(400).json({ error: "La reserva no está en estado de Check-In activo" });
  }

  const fechaHoy = getLocalDateString(0);
  const caja = dbInstance.caja[fechaHoy];
  if (!caja || caja.estado !== "abierta") {
    return res.status(400).json({ error: "La caja del día de hoy debe estar ABIERTA para procesar egreso de garantía." });
  }

  // Action
  r.estado_reserva = "check_out";

  // Transactions: Egreso Garantía Efectivo
  const txGarantiaId = "tx_" + Math.random().toString(36).substr(2, 9);
  const txGarantia: Transaccion = {
    id: txGarantiaId,
    tipo: "egreso_garantia_efectivo",
    monto: r.monto_garantia,
    descripcion: `Devolución Garantía - Reserva ${r.nombre_cliente} (${r.id})`,
    reserva_id: r.id,
    created_at: new Date().toISOString()
  };
  caja.transacciones.push(txGarantia);

  // Recompute cash
  caja.total_efectivo_actual = caja.monto_apertura + caja.transacciones.reduce((sum, t) => {
    if (t.tipo === "ingreso_saldo_efectivo" || t.tipo === "ingreso_garantia_efectivo" || t.tipo === "ingreso_manual") {
      return sum + t.monto;
    }
    if (t.tipo === "egreso_garantia_efectivo" || t.tipo === "gasto_manual") {
      return sum - t.monto;
    }
    return sum;
  }, 0);

  recalculateTurnosAvailability(dbInstance);
  saveDB(dbInstance);
  broadcastRealtimeUpdate("reserva_updated", r);
  broadcastRealtimeUpdate("caja_updated", caja);
  broadcastRealtimeUpdate("turnos_updated", { fecha: r.fecha_turno });

  res.json({ reserva: r, caja });
});

// Admin endpoint: Mark No-Show
app.post("/api/reservas/:id/no-show", (req, res) => {
  const { id } = req.params;
  const r = dbInstance.reservas.find(item => item.id === id);
  if (!r) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }

  if (r.estado_reserva !== "creada") {
    return res.status(400).json({ error: "No es posible marcar no-show en este estado" });
  }

  r.estado_reserva = "no_show";
  
  recalculateTurnosAvailability(dbInstance);
  saveDB(dbInstance);
  broadcastRealtimeUpdate("reserva_updated", r);
  broadcastRealtimeUpdate("turnos_updated", { fecha: r.fecha_turno });

  res.json(r);
});

// Caja endpoints
app.get("/api/caja", (req, res) => {
  const { fecha } = req.query;
  const targetFecha = (fecha as string) || getLocalDateString(0);
  
  let caja = dbInstance.caja[targetFecha];
  if (!caja) {
    // Return empty state or let admin know they need to open it
    return res.json({ fecha: targetFecha, estado: "cerrada", transacciones: [], monto_apertura: 0, total_efectivo_actual: 0 });
  }

  // Ensure total_efectivo_actual is correct
  caja.total_efectivo_actual = caja.monto_apertura + caja.transacciones.reduce((sum, t) => {
    if (t.tipo === "ingreso_saldo_efectivo" || t.tipo === "ingreso_garantia_efectivo" || t.tipo === "ingreso_manual") {
      return sum + t.monto;
    }
    if (t.tipo === "egreso_garantia_efectivo" || t.tipo === "gasto_manual") {
      return sum - t.monto;
    }
    return sum;
  }, 0);

  res.json(caja);
});

// Open Caja
app.post("/api/caja/abrir", (req, res) => {
  const { fecha, monto_apertura } = req.body;
  const targetFecha = fecha || getLocalDateString(0);

  if (dbInstance.caja[targetFecha] && dbInstance.caja[targetFecha].estado === "abierta") {
    return res.status(400).json({ error: "La caja de este día ya está abierta." });
  }

  const txId = "tx_" + Math.random().toString(36).substr(2, 9);
  const nuevaCaja: Caja = {
    fecha: targetFecha,
    monto_apertura: Number(monto_apertura),
    estado: "abierta",
    transacciones: [
      {
        id: txId,
        tipo: "apertura",
        monto: Number(monto_apertura),
        descripcion: "Apertura de caja inicial",
        created_at: new Date().toISOString()
      }
    ],
    total_efectivo_actual: Number(monto_apertura)
  };

  dbInstance.caja[targetFecha] = nuevaCaja;
  saveDB(dbInstance);
  broadcastRealtimeUpdate("caja_updated", nuevaCaja);

  res.json(nuevaCaja);
});

// Close Caja
app.post("/api/caja/cerrar", (req, res) => {
  const { fecha, monto_cierre } = req.body;
  const targetFecha = fecha || getLocalDateString(0);

  const caja = dbInstance.caja[targetFecha];
  if (!caja) {
    return res.status(404).json({ error: "No hay caja para este día." });
  }

  if (caja.estado === "cerrada") {
    return res.status(400).json({ error: "La caja de este día ya está cerrada." });
  }

  caja.estado = "cerrada";
  caja.monto_cierre = Number(monto_cierre);
  
  const txId = "tx_" + Math.random().toString(36).substr(2, 9);
  caja.transacciones.push({
    id: txId,
    tipo: "cierre",
    monto: Number(monto_cierre),
    descripcion: `Cierre de caja. Efectivo declarado: $${Number(monto_cierre).toLocaleString("es-AR")}. Diferencia: $${(Number(monto_cierre) - caja.total_efectivo_actual).toLocaleString("es-AR")}`,
    created_at: new Date().toISOString()
  });

  saveDB(dbInstance);
  broadcastRealtimeUpdate("caja_updated", caja);

  res.json(caja);
});

// Add manual movement
app.post("/api/caja/transaccion", (req, res) => {
  const { fecha, tipo, monto, descripcion } = req.body;
  const targetFecha = fecha || getLocalDateString(0);

  const caja = dbInstance.caja[targetFecha];
  if (!caja || caja.estado !== "abierta") {
    return res.status(400).json({ error: "La caja debe estar abierta para registrar movimientos." });
  }

  const txId = "tx_" + Math.random().toString(36).substr(2, 9);
  const nuevaTx: Transaccion = {
    id: txId,
    tipo: tipo as "ingreso_manual" | "gasto_manual",
    monto: Number(monto),
    descripcion,
    created_at: new Date().toISOString()
  };

  caja.transacciones.push(nuevaTx);

  // Recalculate cash in box
  caja.total_efectivo_actual = caja.monto_apertura + caja.transacciones.reduce((sum, t) => {
    if (t.tipo === "ingreso_saldo_efectivo" || t.tipo === "ingreso_garantia_efectivo" || t.tipo === "ingreso_manual") {
      return sum + t.monto;
    }
    if (t.tipo === "egreso_garantia_efectivo" || t.tipo === "gasto_manual") {
      return sum - t.monto;
    }
    return sum;
  }, 0);

  saveDB(dbInstance);
  broadcastRealtimeUpdate("caja_updated", caja);

  res.json(caja);
});

// Partner Analytics
app.get("/api/partners", (req, res) => {
  const stats: { [partner: string]: { count: number; total: number } } = {};
  
  dbInstance.reservas.forEach(r => {
    if (r.estado_pago === "seña_pagada" && r.estado_reserva !== "no_show") {
      const partnerName = r.partner || "Directo (Sin Partner)";
      if (!stats[partnerName]) {
        stats[partnerName] = { count: 0, total: 0 };
      }
      stats[partnerName].count += 1;
      stats[partnerName].total += r.monto_total;
    }
  });

  const partnerStatsList: PartnerStats[] = Object.keys(stats).map(key => ({
    partner: key,
    reservas_count: stats[key].count,
    total_recaudado: stats[key].total
  })).sort((a, b) => b.total_recaudado - a.total_recaudado);

  res.json(partnerStatsList);
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve client on all remaining routes (for standard single page routing)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
