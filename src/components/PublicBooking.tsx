import React, { useState, useEffect } from "react";
import { Turno, Reserva, Config } from "../types";
import { Calendar as CalendarIcon, Users, User, Phone, Shield, ArrowRight, ArrowLeft, RefreshCw, AlertTriangle, CreditCard, Sparkles, Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";

interface PublicBookingProps {
  partner?: string;
  onBookingSuccess: (reserva: Reserva) => void;
  config: Config;
  onStepChange: (step: number) => void;
}

export default function PublicBooking({ partner, onBookingSuccess, config, onStepChange }: PublicBookingProps) {
  const [step, setStep] = useState<number>(1);
  const [cantidad, setCantidad] = useState<number>(1);
  
  const getFormattedDate = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const todayStr = getFormattedDate(0);
  const tomorrowStr = getFormattedDate(1);

  const [fecha, setFecha] = useState<string>(todayStr);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>("");
  const [loadingTurnos, setLoadingTurnos] = useState<boolean>(false);
  
  const [nombre, setNombre] = useState<string>("");
  const [dni, setDni] = useState<string>("");
  const [telefono, setTelefono] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [deliveryMode, setDeliveryMode] = useState<"meeting_point" | "hotel_delivery">("meeting_point");
  const [nombreHotel, setNombreHotel] = useState<string>("");
  const [puntoEncuentroZona, setPuntoEncuentroZona] = useState<"Pinamar" | "Mar de Ostende" | "Valeria del mar" | "Carilo">("Pinamar");
  
  const [loadingBooking, setLoadingBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string>("");
  const [createdReserva, setCreatedReserva] = useState<Reserva | null>(null);
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string>("");

  useEffect(() => {
    onStepChange(step);
  }, [step, onStepChange]);

  useEffect(() => {
    fetchTurnos();

    const eventSource = new EventSource("/api/realtime");
    
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "turnos_updated" && parsed.data.fecha === fecha) {
          fetchTurnos(false);
        }
      } catch (e) {
        console.error("Error parsing real-time message", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fecha]);

  const fetchTurnos = async (showLoading = true) => {
    if (showLoading) setLoadingTurnos(true);
    try {
      // Cargar turnos usando Supabase
      const { data, error } = await supabase
        .from("turnos")
        .select("*")
        .eq("fecha", fecha)
        .order("hora", { ascending: true });

      if (!error && data) {
        // Mapear los datos de Supabase si es necesario, aunque coinciden en estructura
        setTurnos(data as unknown as Turno[]);
      }
    } catch (e) {
      console.error("Error fetching turnos", e);
    } finally {
      if (showLoading) setLoadingTurnos(false);
    }
  };

  const precioUnitario = config.precioPorHora;
  const totalAlquiler = precioUnitario * cantidad;
  const montoSeña = Math.round(totalAlquiler * (config.porcentajeSeña / 100));
  const montoSaldo = totalAlquiler - montoSeña;
  const montoGarantia = config.montoGarantia * cantidad;

  const handleSelectTurno = (turnoId: string, disponibles: number) => {
    if (disponibles < cantidad) return;
    setSelectedTurnoId(turnoId);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !telefono || !dni || !email) {
      setBookingError("Por favor completá todos los datos obligatorios (Nombre, Teléfono, DNI y Correo Electrónico).");
      return;
    }

    if (deliveryMode === "hotel_delivery" && !nombreHotel.trim()) {
      setBookingError("Por favor ingresá el nombre del hotel o hospedaje para la entrega.");
      return;
    }

    setLoadingBooking(true);
    setBookingError("");

    try {
      // 1. Generar ID único para la reserva
      const resId = `res_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 2. Obtener los detalles del turno seleccionado para completar fecha y hora
      const selectedTurno = turnos.find(t => t.id === selectedTurnoId);
      if (!selectedTurno) {
        setBookingError("Turno inválido o no seleccionado.");
        setLoadingBooking(false);
        return;
      }

      // 3. Invocar a la Edge Function 'validate-booking' en Supabase para crear la reserva y bloquear stock de forma segura
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('validate-booking', {
        body: {
          turno_id: selectedTurnoId,
          cantidad: cantidad,
          nombre_cliente: nombre,
          dni_cliente: dni,
          telefono_cliente: telefono,
          email_cliente: email,
          monto_total: totalAlquiler,
          monto_sena: montoSeña,
          monto_saldo: montoSaldo,
          monto_garantia: montoGarantia,
          delivery_mode: deliveryMode,
          nombre_hotel: deliveryMode === "hotel_delivery" ? nombreHotel : null,
          punto_encuentro_zona: deliveryMode === "meeting_point" ? puntoEncuentroZona : null,
          partner: partner || null,
          source: "PWA-Local"
        }
      });

      if (edgeError || (edgeData && !edgeData.success)) {
        throw new Error(edgeError?.message || edgeData?.error || "Error al validar la disponibilidad o crear la reserva.");
      }

      const createdId = edgeData.reserva_id;

      // 4. Traer la reserva creada para mostrarla en el paso del ticket / simulador de pago
      const { data: dbReserva, error: getResError } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', createdId)
        .single();

      if (getResError || !dbReserva) {
        throw new Error("No se pudo obtener la información de la reserva creada.");
      }

      setCreatedReserva(dbReserva as unknown as Reserva);
      setMpCheckoutUrl(`https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_${createdId}`);
      setStep(4);
    } catch (e: any) {
      console.error(e);
      setBookingError(e.message || "Hubo un problema al procesar tu reserva.");
    } finally {
      setLoadingBooking(false);
    }
  };

  const handleSimulateInstantPayment = async () => {
    if (!createdReserva) return;
    setLoadingBooking(true);
    try {
      // 1. Confirmar pago de la seña en la reserva
      const { error: updateError } = await supabase
        .from('reservas')
        .update({ estado_pago: 'seña_pagada' })
        .eq('id', createdReserva.id);

      if (updateError) throw new Error(updateError.message);

      // 2. Intentar buscar si hay una caja abierta para hoy para registrar la transacción digital
      const today = new Date().toISOString().split("T")[0];
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('*')
        .eq('fecha', today)
        .eq('estado', 'abierta')
        .single();

      if (cajaData) {
        // Si hay una caja abierta, registrar la transacción contable digital de seña MP
        const txId = Math.floor(Math.random() * 100000000);
        await supabase
          .from('transacciones')
          .insert({
            id: txId,
            caja_id: cajaData.id,
            reserva_id: createdReserva.id,
            tipo: 'ingreso_seña_mp',
            monto: createdReserva.monto_seña,
            descripcion: `Ingreso Seña MP - ${createdReserva.nombre_cliente} (${createdReserva.id})`
          });
      }

      // 3. Traer la reserva actualizada
      const { data: finalRes, error: fetchError } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', createdReserva.id)
        .single();

      if (!fetchError && finalRes) {
        onBookingSuccess(finalRes as unknown as Reserva);
      }
    } catch (e: any) {
      console.error(e);
      setBookingError("Error simulando el pago instantáneo: " + e.message);
    } finally {
      setLoadingBooking(false);
    }
  };

  const getDayLabel = (dateStr: string) => {
    if (dateStr === todayStr) return "Hoy";
    if (dateStr === tomorrowStr) return "Mañana";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 text-white font-sans selection:bg-[#FF5500] selection:text-white">
      {/* Navigation & Realtime header */}
      <div className="mb-6 flex items-center justify-between">
        {step > 1 && step < 4 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex items-center text-xs font-bold text-white h-10 px-4 border border-white/10 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 text-[#FF5500]" /> Volver
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center space-x-2 bg-[#FF5500]/10 px-3.5 py-1.5 rounded-full border border-[#FF5500]/25">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse shadow-[0_0_8px_#FF5500]" />
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#FF5500] neon-orange-text">
            Flota en tiempo real
          </span>
        </div>
      </div>

      {partner && (
        <div className="mb-6 bg-[#FF5500]/10 border border-[#FF5500]/25 rounded-xl p-4 flex items-center justify-between text-xs text-white shadow-sm">
          <span className="flex items-center gap-1.5 font-medium">
            🏨 Reserva vía partner: <strong className="text-[#FF5500] neon-orange-text">{partner}</strong>
          </span>
          <span className="bg-[#FF5500] text-white font-bold text-[9px] px-2.5 py-0.5 rounded-full">
            Socio
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: QUANTITY AND DATE */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight uppercase">
                Reservá tu <span className="text-[#FF5500] neon-orange-text">Scooter</span>
              </h1>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-light">
                Asegurá tu monopatín pagando el <strong className="text-[#FF5500]">30% de seña online</strong> y cancelá el 70% restante al retirar.
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="glass-card rounded-xl p-5 space-y-3.5 border border-white/10">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                1. ¿Cuántos monopatines necesitás?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setCantidad(num);
                      setSelectedTurnoId("");
                    }}
                    className={`h-12 rounded-lg font-black flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      cantidad === num
                        ? "border-[#FF5500] bg-[#FF5500]/15 text-white shadow-[0_0_12px_rgba(255,85,0,0.15)]"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-base font-display">{num}</span>
                    <span className="text-[8px] uppercase tracking-wider font-bold text-zinc-500">
                      {num === 1 ? "unidad" : "unidades"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selector */}
            <div className="glass-card rounded-xl p-5 space-y-4 border border-white/10">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                2. Elegí el día de tu alquiler
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFecha(todayStr)}
                  className={`h-12 rounded-lg font-bold border transition-all cursor-pointer text-xs ${
                    fecha === todayStr
                      ? "border-[#FF5500] bg-[#FF5500]/15 text-white"
                      : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  Hoy ({getDayLabel(todayStr)})
                </button>
                <button
                  type="button"
                  onClick={() => setFecha(tomorrowStr)}
                  className={`h-12 rounded-lg font-bold border transition-all cursor-pointer text-xs ${
                    fecha === tomorrowStr
                      ? "border-[#FF5500] bg-[#FF5500]/15 text-white"
                      : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  Mañana ({getDayLabel(tomorrowStr)})
                </button>
              </div>

              {/* Manual Date picker */}
              <div className="pt-3 border-t border-white/5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">O seleccioná otra fecha:</span>
                <input
                  type="date"
                  value={fecha}
                  min={todayStr}
                  onChange={(e) => {
                    if (e.target.value) setFecha(e.target.value);
                  }}
                  className="w-full h-11 border border-white/10 rounded-lg px-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all"
                />
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={() => setStep(2)}
              className="w-full h-12 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg font-bold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all cursor-pointer text-sm shadow-lg shadow-[#FF5500]/10 uppercase tracking-wider"
            >
              <span>Ver Turnos Disponibles</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* STEP 2: CHOOSE SHIFT */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-xl font-display font-extrabold text-white tracking-tight uppercase">
                Turnos para el <span className="text-[#FF5500]">{getDayLabel(fecha)}</span>
              </h1>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-light">
                Seleccioná un bloque horario de 1 hora. Requerís <strong className="text-white">{cantidad} {cantidad === 1 ? "unidad" : "unidades"}</strong>.
              </p>
            </div>

            <div className="bg-[#FF5500]/10 border border-[#FF5500]/20 rounded-xl p-3 flex items-center space-x-2 text-xs text-[#FF5500] shadow-sm">
              <Sparkles className="w-4 h-4 shrink-0 animate-pulse text-[#FF5500]" />
              <span className="text-[11px] font-medium leading-relaxed">Los turnos se actualizan automáticamente para prevenir sobreventas.</span>
            </div>

            {loadingTurnos ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white/5 border border-white/10 rounded-xl shadow-sm">
                <RefreshCw className="w-8 h-8 text-[#FF5500] animate-spin" />
                <span className="text-xs text-zinc-400">Verificando disponibilidad de flota...</span>
              </div>
            ) : turnos.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center text-sm text-zinc-400 border border-white/10">
                No hay turnos creados por el operador para este día.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {turnos.map((turno) => {
                  const fitsDemand = turno.unidades_disponibles >= cantidad;
                  const isSelected = selectedTurnoId === turno.id;
                  
                  return (
                    <button
                      key={turno.id}
                      type="button"
                      disabled={!fitsDemand}
                      onClick={() => handleSelectTurno(turno.id, turno.unidades_disponibles)}
                      className={`p-4 border rounded-xl flex items-center justify-between text-left transition-all ${
                        !fitsDemand
                          ? "opacity-30 bg-black/10 text-zinc-500 cursor-not-allowed border-white/5"
                          : isSelected
                            ? "border-[#FF5500] bg-[#FF5500]/15 text-white shadow-sm"
                            : "border-white/10 bg-black/20 text-white hover:border-[#FF5500]/40 cursor-pointer"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-white font-display">{turno.hora} hs</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Duración: 1 Hora contratada</div>
                      </div>

                      <div className="text-right">
                        {turno.unidades_disponibles === 0 ? (
                          <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1 rounded-md">
                            Agotado
                          </span>
                        ) : !fitsDemand ? (
                          <span className="text-[10px] font-bold text-zinc-500 bg-black/20 border border-white/5 px-2.5 py-1 rounded-md">
                            Faltan unidades
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                            turno.unidades_disponibles === 1 
                              ? "text-red-400 bg-red-400/10 border-red-400/20"
                              : "text-[#FF5500] bg-[#FF5500]/10 border-[#FF5500]/25"
                          }`}>
                            {turno.unidades_disponibles} {turno.unidades_disponibles === 1 ? "libre" : "libres"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTurnoId && (
              <button
                onClick={() => setStep(3)}
                className="w-full h-12 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg font-bold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all cursor-pointer text-sm shadow-lg shadow-[#FF5500]/10 uppercase tracking-wider"
              >
                <span>Continuar con tus datos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* STEP 3: CONTACT DATA AND COST BREAKDOWN */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
          >
            <form onSubmit={handleCreateReservation} className="space-y-6">
              <div>
                <h1 className="text-xl font-display font-extrabold text-white tracking-tight uppercase">Datos de Contacto</h1>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-light">
                  Completá tu información personal para registrar las unidades en base.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 space-y-4 border border-white/10">
                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <User className="w-4 h-4 text-[#FF5500]" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full h-11 border border-white/10 rounded-lg pl-10 pr-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                    Teléfono de Contacto (con WhatsApp) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Phone className="w-4 h-4 text-[#FF5500]" />
                    </span>
                    <input
                      type="tel"
                      required
                      placeholder="Ej: +54 9 11 1234-5678"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full h-11 border border-white/10 rounded-lg pl-10 pr-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                    Correo Electrónico *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Mail className="w-4 h-4 text-[#FF5500]" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="Ej: juan.perez@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 border border-white/10 rounded-lg pl-10 pr-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500"
                    />
                  </div>
                </div>

                {/* DNI */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                    DNI Titular (Obligatorio) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 38123456"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="w-full h-11 border border-white/10 rounded-lg px-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500"
                  />
                  <span className="text-[9px] text-zinc-500 mt-2 block leading-relaxed">
                    ⚠️ Se requiere presentar el DNI físico original obligatorio al momento de retirar el equipo.
                  </span>
                </div>
              </div>

              {/* Delivery Mode Selection */}
              <div className="glass-card rounded-xl p-5 space-y-3.5 border border-white/10">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                  3. Modalidad de Entrega
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("meeting_point")}
                    className={`p-3.5 border rounded-lg flex flex-col text-left transition-all cursor-pointer ${
                      deliveryMode === "meeting_point"
                        ? "border-[#FF5500] bg-[#FF5500]/10 text-white"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-bold text-xs text-white">Acordamos tu Punto de Encuentro (Flexible)</span>
                    <span className="text-[10px] text-zinc-400 mt-1 leading-relaxed font-light">
                      No tenemos punto fijo. Coordinamos juntos después de confirmada la reserva en Pinamar, Valeria del Mar, Ostende o Cariló.
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("hotel_delivery")}
                    className={`p-3.5 border rounded-lg flex flex-col text-left transition-all cursor-pointer ${
                      deliveryMode === "hotel_delivery"
                        ? "border-[#FF5500] bg-[#FF5500]/10 text-white"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-bold text-xs text-white">
                      {partner ? `Entrega Directa en ${partner}` : "Entrega en tu Hotel / Hospedaje"}
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-1 leading-relaxed font-light">
                      Te lo enviamos directo al lobby o domicilio. Realizamos el check-in directamente allí.
                    </span>
                  </button>
                </div>

                {/* Detalle de Modalidad de Entrega */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  {deliveryMode === "meeting_point" ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#FF5500] block font-mono">
                        Seleccioná la Zona del Punto de Encuentro *
                      </label>
                      <select
                        value={puntoEncuentroZona}
                        onChange={(e) => setPuntoEncuentroZona(e.target.value as any)}
                        className="w-full h-11 border border-white/10 rounded-lg px-4 bg-black/60 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all cursor-pointer"
                      >
                        <option value="Pinamar" className="bg-zinc-950">Pinamar</option>
                        <option value="Mar de Ostende" className="bg-zinc-950">Mar de Ostende</option>
                        <option value="Valeria del mar" className="bg-zinc-950">Valeria del mar</option>
                        <option value="Carilo" className="bg-zinc-950">Cariló</option>
                      </select>
                      <span className="text-[9px] text-zinc-500 block leading-relaxed">
                        📍 Nos encontraremos en la zona seleccionada. Coordinaremos la ubicación exacta por WhatsApp.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#FF5500] block font-mono">
                        Nombre de tu Hotel o Hospedaje *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Hotel Playas, Pinamar"
                        value={nombreHotel}
                        onChange={(e) => setNombreHotel(e.target.value)}
                        className="w-full h-11 border border-white/10 rounded-lg px-4 bg-black/60 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500"
                      />
                      <span className="text-[9px] text-zinc-500 block leading-relaxed">
                        🏨 Entregaremos los monopatines directamente en el lobby o recepción de tu hospedaje.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Breakdown Card */}
              <div className="glass-card rounded-xl p-5 space-y-3.5 border-l-4 border-l-[#FF5500] border-white/10">
                <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#FF5500] font-black border-b border-white/5 pb-2.5 neon-orange-text">
                  Resumen de Cuenta de Reserva
                </h3>
                
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>
                    {cantidad} monopatín(es) x 1 hora:
                  </span>
                  <span className="font-mono text-white font-semibold">
                    ${totalAlquiler.toLocaleString("es-AR")}
                  </span>
                </div>

                {/* Seña (Online MP) */}
                <div className="flex justify-between text-xs items-center">
                  <span className="text-white font-bold flex items-center">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF5500] mr-1.5 animate-pulse shadow-[0_0_6px_#FF5500]" />
                    Seña Online MercadoPago (30%):
                  </span>
                  <span className="font-mono text-[#FF5500] font-black text-sm px-2.5 py-1 rounded bg-[#FF5500]/10 border border-[#FF5500]/20 neon-orange-text">
                    ${montoSeña.toLocaleString("es-AR")}
                  </span>
                </div>

                {/* Saldo Efectivo */}
                <div className="flex justify-between text-xs border-t border-dashed border-white/10 pt-2.5 text-zinc-400">
                  <span>
                    Saldo a abonar en Efectivo (70%):
                  </span>
                  <span className="font-mono text-white font-semibold">
                    ${montoSaldo.toLocaleString("es-AR")}
                  </span>
                </div>

                {/* Garantía */}
                <div className="flex justify-between text-[10px] text-zinc-400 pt-1">
                  <span>
                    Garantía en efectivo (Reembolsable):
                  </span>
                  <span className="font-mono text-white font-semibold">
                    ${montoGarantia.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {bookingError && (
                <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-xs p-3.5 rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loadingBooking}
                className="w-full h-12 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg font-bold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer text-sm shadow-lg shadow-[#FF5500]/10 uppercase tracking-wider"
              >
                {loadingBooking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando reserva...</span>
                  </>
                ) : (
                  <>
                    <span>Reservar y Pagar Seña (${montoSeña.toLocaleString("es-AR")})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* STEP 4: MERCADO PAGO PORTAL / WEBHOOK LAUNCH */}
        {step === 4 && createdReserva && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] mb-3 neon-orange-glow">
                <CreditCard className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-display font-extrabold text-white tracking-tight uppercase">Pago Seguro de Seña</h1>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-light">
                Completá el cobro de la seña para activar tu ticket digital de alquiler.
              </p>
            </div>

            <div className="glass-card rounded-xl p-5 space-y-4 border border-white/10">
              <div className="flex justify-between items-center pb-2.5 border-b border-white/10">
                <span className="text-xs text-zinc-400">Monto de la Seña:</span>
                <span className="text-xl font-mono font-black text-[#FF5500] bg-[#FF5500]/10 px-3 py-1 rounded-md border border-[#FF5500]/20 neon-orange-text">
                  ${montoSeña.toLocaleString("es-AR")}
                </span>
              </div>

              <div className="text-xs text-zinc-400 leading-relaxed space-y-2 font-light">
                <p>
                  Para confirmar tu reserva, debés abonar la seña utilizando <strong>MercadoPago Checkout Pro</strong>.
                </p>
                <p>
                  Una vez aprobada, el sistema te redirigirá automáticamente a tu ticket digital de alquiler.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={mpCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 bg-[#009EE3] text-white rounded-lg font-bold flex items-center justify-center space-x-2 hover:bg-[#0084c0] active:scale-[0.99] transition-all text-decoration-none text-sm shadow-sm uppercase tracking-wider"
              >
                <span>Pagar con MercadoPago (Simulador)</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={handleSimulateInstantPayment}
                disabled={loadingBooking}
                className="w-full h-12 border border-[#FF5500] text-[#FF5500] bg-[#FF5500]/5 hover:bg-[#FF5500]/10 rounded-lg font-bold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all cursor-pointer text-sm uppercase tracking-wider neon-orange-glow"
              >
                {loadingBooking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Aprobación Directa (Sin Redirigir)</span>
                )}
              </button>
            </div>

            <div className="text-[10px] text-center text-zinc-400 glass-card rounded-xl p-4.5 leading-relaxed shadow-sm border border-white/5 font-light">
              💡 <strong>Sugerencia de pruebas:</strong> El botón celeste abre una simulación interactiva de MercadoPago en pestaña nueva, mientras que el botón inferior simula el pago aprobado al instante en esta pantalla.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
