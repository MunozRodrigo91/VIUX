import React from "react";
import { Reserva } from "../types";
import { Calendar, Clock, MapPin, CheckCircle, Phone, CreditCard, Shield, AlertTriangle, MessageSquare, Mail } from "lucide-react";

interface TicketViewProps {
  reserva: Reserva;
  onBackToStart: () => void;
}

export default function TicketView({ reserva, onBackToStart }: TicketViewProps) {
  const generateBarcode = (id: string) => {
    return (
      <div className="flex items-center justify-center space-x-0.5 h-12 my-3">
        {id.split("").map((char, index) => {
          const width = (char.charCodeAt(0) % 3) + 1; // 1 to 3px
          const spacing = (char.charCodeAt(0) % 2) === 0 ? "mr-0.5" : "mr-1";
          return (
            <div
              key={index}
              className={`h-full bg-gradient-to-b from-white to-zinc-600 ${spacing}`}
              style={{ width: `${width}px` }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 text-white font-sans selection:bg-[#FF5500] selection:text-white">
      {/* Visual Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-3 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-display font-extrabold text-white tracking-tight uppercase">¡Reserva Confirmada!</h2>
        <p className="text-xs text-zinc-400 mt-1 font-light">
          Tus equipos están asegurados. Te enviamos los detalles a continuación:
        </p>
      </div>

      {/* NEW: NOTIFICATIONS CONFIRMATION BANNER */}
      <div className="mb-6 bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-4.5 space-y-2.5">
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Notificaciones enviadas en tiempo real:</span>
        </div>
        <div className="grid grid-cols-1 gap-2 text-[11px] text-zinc-300">
          <div className="flex items-center space-x-2.5 bg-black/25 rounded-lg p-2 border border-white/5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">WhatsApp de confirmación enviado a: <strong>{reserva.telefono_cliente}</strong></span>
          </div>
          <div className="flex items-center space-x-2.5 bg-black/25 rounded-lg p-2 border border-white/5">
            <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Mail de confirmación enviado a: <strong>{reserva.email_cliente}</strong></span>
          </div>
        </div>
      </div>

      {/* Ticket Container */}
      <div className="glass-card rounded-xl p-6 relative overflow-hidden border border-white/10">
        {/* Ticket Notch Deco */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#060608] border-r border-white/10 rounded-full z-10" />
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#060608] border-l border-white/10 rounded-full z-10" />

        {/* Ticket Header */}
        <div className="border-b border-dashed border-white/10 pb-4 mb-4 text-center">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#FF5500] font-bold">
            Código de Reserva
          </span>
          <div className="text-xl font-mono font-black tracking-widest text-[#FF5500] mt-1 uppercase neon-orange-text">
            {reserva.id.toUpperCase()}
          </div>
          {reserva.partner && (
            <div className="mt-2 inline-block bg-[#FF5500]/10 text-[#FF5500] border border-[#FF5500]/25 text-[9px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Hotel Socio: {reserva.partner}
            </div>
          )}
        </div>

        {/* Ticket Info Grid */}
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Calendar className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Cliente</div>
              <div className="text-xs font-bold text-white">
                {reserva.nombre_cliente} (DNI: {reserva.dni_cliente})
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Calendar className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Fecha</div>
              <div className="text-xs font-bold text-white">{reserva.fecha_turno}</div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Clock className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Horario del Turno</div>
              <div className="text-xs font-bold text-white">{reserva.hora_turno} hs (Duración: 1 hora)</div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Shield className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Equipos Reservados</div>
              <div className="text-xs font-bold text-white">
                {reserva.cantidad_monopatines} {reserva.cantidad_monopatines === 1 ? "unidad" : "unidades"} (Xiaomi 6 Pro)
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                * Incluye equipo de seguridad homologado: casco, coderas y rodilleras.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <MapPin className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Modalidad de Entrega</div>
              <div className="text-xs font-bold text-white">
                {reserva.delivery_mode === "hotel_delivery"
                  ? `Entrega Directa en Hotel / Hospedaje (${reserva.partner || "Coordinar"})`
                  : "Punto de encuentro a acordar juntos"}
              </div>
              <div className="text-[10.5px] text-zinc-400 mt-1 leading-relaxed font-light">
                No tenemos un punto de encuentro fijo. Coordinaremos un punto óptimo en **Pinamar, Valeria del Mar, Mar de Ostende o Cariló** para la entrega.
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-b border-dashed border-white/10 my-5" />

        {/* Financial Details */}
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase font-bold text-zinc-400">Detalle de Cuenta</h4>
          
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Alquiler:</span>
            <span className="font-mono font-bold text-white">${reserva.monto_total.toLocaleString("es-AR")}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400 flex items-center">
              <CreditCard className="w-3.5 h-3.5 mr-1 text-[#FF5500]" /> Seña Online MP (30%):
            </span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
              ${reserva.monto_sena.toLocaleString("es-AR")} (PAGADA)
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Saldo a Abonar en Efectivo (70%):</span>
            <span className="font-mono font-bold text-white">${reserva.monto_saldo.toLocaleString("es-AR")}</span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2.5 mt-1 text-zinc-400">
            <span>Garantía en Efectivo (100% Reembolsable):</span>
            <span className="font-mono font-semibold text-white">${reserva.monto_garantia.toLocaleString("es-AR")}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="border-b border-dashed border-white/10 my-5" />

        {/* Instructions / Rules */}
        <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-2">
          <div className="flex items-center space-x-2 text-[#FF5500] font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>REGLAS IMPORTANTES DE RETIRO</span>
          </div>
          <ul className="text-[11px] text-zinc-400 list-disc list-inside space-y-1.5 leading-relaxed font-light">
            <li>Llegar 10 minutos antes del horario del turno.</li>
            <li>Presentar <strong>DNI físico original obligatorio</strong> del titular registrado (sin excepción).</li>
            <li><strong>Tolerancia horaria:</strong> 15 minutos máximo. Cumplido el plazo se declara No-Show.</li>
            <li>Los monopatines y kits de seguridad cumplen con la <strong>Ordenanza Municipal N.° 005/2026 de Pinamar</strong>.</li>
            <li>Prohibido circular sobre playas, dunas o bosque.</li>
          </ul>
        </div>

        {/* Barcode representation */}
        <div className="mt-6 text-center">
          {generateBarcode(reserva.id)}
          <span className="text-[9px] font-mono tracking-widest text-zinc-500">
            * {reserva.id.toUpperCase()} *
          </span>
        </div>
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={onBackToStart}
        className="mt-6 w-full h-12 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg font-bold active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer text-sm shadow-lg shadow-[#FF5500]/15 uppercase tracking-wider"
      >
        Volver al Inicio
      </button>
    </div>
  );
}
