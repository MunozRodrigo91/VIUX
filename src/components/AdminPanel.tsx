import React, { useState, useEffect } from "react";
import { Turno, Reserva, Caja, Transaccion, PartnerStats, Config } from "../types";
import { Calendar, Users, DollarSign, ArrowUpRight, ArrowDownRight, UserCheck, Check, Trash, Plus, ShieldAlert, Sparkles, RefreshCw, BarChart2, Briefcase, FileText, LogOut, TrendingUp, Download, PieChart, Activity, MapPin, Building, Clock } from "lucide-react";
import { supabase } from "../lib/supabase";
import posthog from 'posthog-js';

interface AdminPanelProps {
  config: Config;
  onUpdateConfig: (newConfig: Config) => void;
  onLogout?: () => void;
}

export default function AdminPanel({ config, onUpdateConfig, onLogout }: AdminPanelProps) {
  const [selectedFecha, setSelectedFecha] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Caja state
  const [caja, setCaja] = useState<Caja | null>(null);
  const [montoAperturaInput, setMontoAperturaInput] = useState<string>("15000");
  const [montoCierreInput, setMontoCierreInput] = useState<string>("");
  
  // Custom Transaction State
  const [txMonto, setTxMonto] = useState<string>("");
  const [txDesc, setTxDesc] = useState<string>("");
  const [txTipo, setTxTipo] = useState<"ingreso_manual" | "gasto_manual">("gasto_manual");

  // Config fields
  const [precioInput, setPrecioInput] = useState<string>(config.precioPorHora.toString());
  const [garantiaInput, setGarantiaInput] = useState<string>(config.montoGarantia.toString());
  const [senaInput, setSenaInput] = useState<string>(config.porcentajeSeña.toString());

  // Check-in helper state
  const [checkInDni, setCheckInDni] = useState<{ [resId: string]: string }>({});

  // Active view
  const [activeTab, setActiveTab] = useState<"reservas" | "turnos" | "caja" | "partners" | "config" | "analytics">("reservas");
  const [partnerStats, setPartnerStats] = useState<PartnerStats[]>([]);
  const [allReservas, setAllReservas] = useState<Reserva[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  useEffect(() => {
    fetchData();

    // Configurar suscripción Supabase Realtime en multicanal
    const realtimeChannel = supabase
      .channel('admin-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        () => {
          fetchData(false);
          if (activeTab === "analytics") {
            fetchAllReservas();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        () => fetchData(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cajas' },
        () => fetchData(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacciones' },
        () => fetchData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [selectedFecha, activeTab]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAllReservas();
    }
  }, [activeTab]);

  const fetchAllReservas = async () => {
    setLoadingAnalytics(true);
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('*');

      if (!error && data) {
        setAllReservas(data as unknown as Reserva[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Obtener Reservas de la fecha
      const { data: bookings, error: bookingsErr } = await supabase
        .from('reservas')
        .select('*')
        .eq('fecha_turno', selectedFecha);

      if (!bookingsErr && bookings) {
        setReservas(bookings as unknown as Reserva[]);
      }

      // 2. Obtener Turnos de la fecha
      const { data: shifts, error: shiftsErr } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', selectedFecha)
        .order('hora', { ascending: true });

      if (!shiftsErr && shifts) {
        setTurnos(shifts as unknown as Turno[]);
      }

      // 3. Obtener Caja del día (incluyendo sus transacciones relacionadas)
      const { data: cajaData, error: cajaErr } = await supabase
        .from('cajas')
        .select('*, transacciones(*)')
        .eq('fecha', selectedFecha)
        .maybeSingle();

      if (!cajaErr && cajaData) {
        setCaja(cajaData as unknown as Caja);
      } else {
        setCaja(null);
      }

      // 4. Calcular estadísticas de partners basadas en todas las reservas
      if (allReservas.length > 0) {
        const statsMap: { [key: string]: { count: number, total: number } } = {};
        allReservas.forEach(r => {
          if (r.partner) {
            if (!statsMap[r.partner]) statsMap[r.partner] = { count: 0, total: 0 };
            statsMap[r.partner].count += 1;
            if (r.estado_pago === 'seña_pagada') {
              statsMap[r.partner].total += r.monto_seña;
            }
            if (r.estado_reserva === 'check_in' || r.estado_reserva === 'check_out') {
              statsMap[r.partner].total += r.monto_saldo;
            }
          }
        });
        const stats = Object.entries(statsMap).map(([pName, pVal]) => ({
          partner: pName,
          reservas_count: pVal.count,
          total_recaudado: pVal.total
        }));
        setPartnerStats(stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleUpdateTurnoCapacity = async (turnoId: string, capacity: number) => {
    try {
      await supabase
        .from('turnos')
        .update({ total_unidades: capacity, unidades_disponibles: capacity })
        .eq('id', turnoId);
      
      fetchData(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckIn = async (reservaId: string) => {
    const dniVal = checkInDni[reservaId] || "";
    try {
      // 1. Obtener la reserva actual
      const { data: reserva, error: resError } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', reservaId)
        .single();

      if (resError || !reserva) {
        alert("No se pudo obtener la información de la reserva.");
        return;
      }

      // 2. Buscar la caja diaria abierta de la fecha
      const { data: activeCaja, error: cajaError } = await supabase
        .from('cajas')
        .select('*')
        .eq('fecha', selectedFecha)
        .eq('estado', 'abierta')
        .single();

      if (cajaError || !activeCaja) {
        alert("Error: Se requiere que la caja diaria esté ABIERTA para poder realizar el Check-in.");
        return;
      }

      // 3. Cambiar estado de reserva a check_in
      const { error: updateResError } = await supabase
        .from('reservas')
        .update({ 
          estado_reserva: 'check_in',
          dni_cliente: dniVal || reserva.dni_cliente
        })
        .eq('id', reservaId);

      if (updateResError) throw new Error(updateResError.message);

      // 4. Registrar transacciones contables
      const txSaldoId = Math.floor(Math.random() * 100000000);
      const txGarantiaId = Math.floor(Math.random() * 100000001);

      await supabase
        .from('transacciones')
        .insert([
          {
            id: txSaldoId,
            caja_id: activeCaja.id,
            reserva_id: reservaId,
            tipo: 'ingreso_saldo_efectivo',
            monto: reserva.monto_saldo,
            descripcion: `Saldo presencial en efectivo - ${reserva.nombre_cliente} (${reservaId})`
          },
          {
            id: txGarantiaId,
            caja_id: activeCaja.id,
            reserva_id: reservaId,
            tipo: 'ingreso_garantia_efectivo',
            monto: reserva.monto_garantia,
            descripcion: `Garantía en efectivo - ${reserva.nombre_cliente} (${reservaId})`
          }
        ]);

      // 5. Afectar saldo en efectivo actual de la caja
      const nuevoEfectivo = activeCaja.total_efectivo_actual + reserva.monto_saldo + reserva.monto_garantia;
      await supabase
        .from('cajas')
        .update({ total_efectivo_actual: nuevoEfectivo })
        .eq('id', activeCaja.id);

      posthog.capture('admin_checkin_completed', {
        reserva_id: reservaId,
        monto_saldo: reserva.monto_saldo,
        monto_garantia: reserva.monto_garantia,
        cantidad_monopatines: reserva.cantidad_monopatines,
        partner: reserva.partner || null,
      });
      fetchData(false);
    } catch (e: any) {
      console.error(e);
      posthog.captureException(e, { level: 'error', extra: { context: 'admin_check_in', reserva_id: reservaId } });
      alert("Error al realizar check-in: " + e.message);
    }
  };

  const handleCheckOut = async (reservaId: string) => {
    if (!confirm("¿Confirmás la devolución del monopatín en buen estado y la devolución de la garantía?")) return;
    try {
      const { data: reserva, error: resError } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', reservaId)
        .single();

      if (resError || !reserva) {
        alert("No se pudo obtener la información de la reserva.");
        return;
      }

      const { data: activeCaja, error: cajaError } = await supabase
        .from('cajas')
        .select('*')
        .eq('fecha', selectedFecha)
        .eq('estado', 'abierta')
        .single();

      if (cajaError || !activeCaja) {
        alert("Error: Se requiere una caja abierta para reintegrar la garantía.");
        return;
      }

      // 1. Cambiar estado a check_out
      await supabase
        .from('reservas')
        .update({ estado_reserva: 'check_out' })
        .eq('id', reservaId);

      // 2. Registrar egreso de garantía
      const txEgresoId = Math.floor(Math.random() * 100000000);
      await supabase
        .from('transacciones')
        .insert({
          id: txEgresoId,
          caja_id: activeCaja.id,
          reserva_id: reservaId,
          tipo: 'egreso_garantia_efectivo',
          monto: reserva.monto_garantia,
          descripcion: `Devolución Garantía Check-Out - ${reserva.nombre_cliente} (${reservaId})`
        });

      // 3. Restar del total en efectivo actual de la caja
      const nuevoEfectivo = activeCaja.total_efectivo_actual - reserva.monto_garantia;
      await supabase
        .from('cajas')
        .update({ total_efectivo_actual: nuevoEfectivo })
        .eq('id', activeCaja.id);

      posthog.capture('admin_checkout_completed', {
        reserva_id: reservaId,
        monto_garantia_devuelta: reserva.monto_garantia,
        partner: reserva.partner || null,
      });
      fetchData(false);
    } catch (e: any) {
      console.error(e);
      posthog.captureException(e, { level: 'error', extra: { context: 'admin_check_out', reserva_id: reservaId } });
      alert("Error al realizar check-out: " + e.message);
    }
  };

  const handleNoShow = async (reservaId: string) => {
    if (!confirm("¿Marcar esta reserva como ausente (No-Show)? Esto liberará la capacidad del monopatín.")) return;
    try {
      const { data: reserva, error: resError } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', reservaId)
        .single();

      if (resError || !reserva) return;

      // 1. Cambiar estado a no_show
      await supabase
        .from('reservas')
        .update({ estado_reserva: 'no_show' })
        .eq('id', reservaId);

      // 2. Liberar monopatines en el turno correspondiente
      const { data: shift } = await supabase
        .from('turnos')
        .select('*')
        .eq('id', reserva.turno_id)
        .single();

      if (shift) {
        await supabase
          .from('turnos')
          .update({
            unidades_disponibles: Math.min(shift.total_unidades, shift.unidades_disponibles + reserva.cantidad_monopatines)
          })
          .eq('id', reserva.turno_id);
      }

      posthog.capture('admin_no_show_marked', {
        reserva_id: reservaId,
        cantidad_monopatines: reserva.cantidad_monopatines,
        partner: reserva.partner || null,
      });
      fetchData(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cajaId = Math.floor(Math.random() * 100000000);
      
      // 1. Crear la caja
      await supabase
        .from('cajas')
        .insert({
          id: cajaId,
          fecha: selectedFecha,
          monto_apertura: Number(montoAperturaInput),
          total_efectivo_actual: Number(montoAperturaInput),
          estado: 'abierta'
        });

      // 2. Registrar transacción de apertura
      const txAperturaId = Math.floor(Math.random() * 100000000);
      await supabase
        .from('transacciones')
        .insert({
          id: txAperturaId,
          caja_id: cajaId,
          tipo: 'apertura',
          monto: Number(montoAperturaInput),
          descripcion: 'Apertura de caja diaria - Saldo inicial'
        });

      fetchData(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoCierreInput || !caja) return;
    try {
      // 1. Cambiar estado de la caja
      await supabase
        .from('cajas')
        .update({
          estado: 'cerrada',
          monto_cierre: Number(montoCierreInput)
        })
        .eq('id', caja.id);

      // 2. Registrar transacción de cierre
      const txCierreId = Math.floor(Math.random() * 100000000);
      await supabase
        .from('transacciones')
        .insert({
          id: txCierreId,
          caja_id: caja.id,
          tipo: 'cierre',
          monto: Number(montoCierreInput),
          descripcion: 'Cierre de caja diaria - Saldo final declarado'
        });

      fetchData(false);
      setMontoCierreInput("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddManualTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txMonto || !txDesc || !caja) return;
    try {
      const txId = Math.floor(Math.random() * 100000000);
      
      // 1. Insertar transacción
      await supabase
        .from('transacciones')
        .insert({
          id: txId,
          caja_id: caja.id,
          tipo: txTipo,
          monto: Number(txMonto),
          descripcion: txDesc
        });

      // 2. Ajustar efectivo actual de la caja
      const factor = txTipo === 'ingreso_manual' ? 1 : -1;
      const nuevoEfectivo = caja.total_efectivo_actual + (Number(txMonto) * factor);
      await supabase
        .from('cajas')
        .update({ total_efectivo_actual: nuevoEfectivo })
        .eq('id', caja.id);

      fetchData(false);
      setTxMonto("");
      setTxDesc("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Actualizar en la base de datos de Supabase
      const { error } = await supabase
        .from('config')
        .update({
          precio_por_hora: Number(precioInput),
          monto_garantia: Number(garantiaInput),
          porcentaje_sena: Number(senaInput)
        })
        .eq('id', 1);

      if (!error) {
        onUpdateConfig({
          precioPorHora: Number(precioInput),
          montoGarantia: Number(garantiaInput),
          porcentajeSeña: Number(senaInput),
          toleranciaNoShowMinutos: config.toleranciaNoShowMinutos,
          capacidadMaximaScooters: config.capacidadMaximaScooters
        });
        alert("Configuración de flota actualizada correctamente.");
      } else {
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error al actualizar configuración: " + e.message);
    }
  };

  const totalScootersRentedToday = reservas
    .filter(r => r.estado_reserva === "check_in")
    .reduce((sum, r) => sum + r.cantidad_monopatines, 0);

  const getCajaTransactionSummary = () => {
    if (!caja) return { ingresos: 0, egresos: 0, total_garantias: 0 };
    
    let ingresos = 0;
    let egresos = 0;
    let total_garantias = 0;

    caja.transacciones.forEach(t => {
      if (t.tipo === "ingreso_saldo_efectivo" || t.tipo === "ingreso_manual") {
        ingresos += t.monto;
      }
      if (t.tipo === "gasto_manual") {
        egresos += t.monto;
      }
      if (t.tipo === "ingreso_garantia_efectivo") {
        total_garantias += t.monto;
      }
      if (t.tipo === "egreso_garantia_efectivo") {
        total_garantias -= t.monto;
      }
    });

    return { ingresos, egresos, total_garantias };
  };

  const { ingresos, egresos, total_garantias } = getCajaTransactionSummary();

  // CSV Report Generator
  const downloadCSVReport = () => {
    if (allReservas.length === 0) {
      alert("No hay datos de reservas para descargar.");
      return;
    }
    
    const headers = [
      "ID Reserva",
      "Fecha Turno",
      "Hora Turno",
      "Cliente",
      "DNI",
      "Telefono",
      "Email",
      "Cantidad Monopatines",
      "Monto Total",
      "Sena Online",
      "Saldo Presencial",
      "Monto Garantia",
      "Estado Pago",
      "Estado Reserva",
      "Partner",
      "Modalidad Entrega",
      "Nombre Hotel",
      "Zona Punto Encuentro",
      "Fecha Creacion"
    ];

    const rows = allReservas.map(r => [
      r.id,
      r.fecha_turno,
      r.hora_turno,
      `"${(r.nombre_cliente || "").replace(/"/g, '""')}"`,
      r.dni_cliente,
      `"${(r.telefono_cliente || "").replace(/"/g, '""')}"`,
      r.email_cliente,
      r.cantidad_monopatines,
      r.monto_total,
      r.monto_seña,
      r.monto_saldo,
      r.monto_garantia,
      r.estado_pago,
      r.estado_reserva,
      r.partner || "Directo (PWA)",
      r.delivery_mode === "hotel_delivery" ? "Hotel" : "Punto de Encuentro",
      r.nombre_hotel ? `"${r.nombre_hotel.replace(/"/g, '""')}"` : "N/A",
      r.punto_encuentro_zona || "N/A",
      r.created_at
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `VIUX_reporte_reservas_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics calculations
  const totalReservasCount = allReservas.length;
  const reservasPagadas = allReservas.filter(r => r.estado_pago === "seña_pagada");
  const totalPagadasCount = reservasPagadas.length;
  const tasaConversion = totalReservasCount > 0 ? Math.round((totalPagadasCount / totalReservasCount) * 100) : 0;
  
  // Money
  const totalSenaOnline = reservasPagadas.reduce((sum, r) => sum + r.monto_seña, 0);
  const totalSaldoPresencial = reservasPagadas
    .filter(r => ["check_in", "check_out"].includes(r.estado_reserva))
    .reduce((sum, r) => sum + r.monto_saldo, 0);
  const totalFacturadoActual = totalSenaOnline + totalSaldoPresencial;
  const totalFacturadoProyectado = reservasPagadas.reduce((sum, r) => sum + r.monto_total, 0);
  const totalMonopatinesAlquilados = reservasPagadas.reduce((sum, r) => sum + r.cantidad_monopatines, 0);

  // Delivery modes breakdown
  const deliveryHotelCount = reservasPagadas.filter(r => r.delivery_mode === "hotel_delivery").length;
  const deliveryMeetingPointCount = reservasPagadas.filter(r => r.delivery_mode === "meeting_point").length;

  // Meet point zones breakdown
  const zoneCounts: { [key: string]: number } = {
    "Pinamar": 0,
    "Mar de Ostende": 0,
    "Valeria del mar": 0,
    "Carilo": 0
  };
  reservasPagadas.forEach(r => {
    if (r.delivery_mode === "meeting_point" && r.punto_encuentro_zona) {
      const zone = r.punto_encuentro_zona;
      const keyMap: { [k: string]: string } = {
        "Pinamar": "Pinamar",
        "Mar de Ostende": "Mar de Ostende",
        "Valeria del mar": "Valeria del mar",
        "Carilo": "Carilo"
      };
      const key = keyMap[zone];
      if (key && zoneCounts[key] !== undefined) {
        zoneCounts[key]++;
      }
    }
  });

  // Partners breakdown
  const partnerBreakdown: { [name: string]: { count: number, total: number } } = {};
  reservasPagadas.forEach(r => {
    const partnerName = r.partner || "Directo (PWA)";
    if (!partnerBreakdown[partnerName]) {
      partnerBreakdown[partnerName] = { count: 0, total: 0 };
    }
    partnerBreakdown[partnerName].count++;
    partnerBreakdown[partnerName].total += r.monto_total;
  });

  // Hours peak
  const hourCounts: { [hour: string]: number } = {};
  reservasPagadas.forEach(r => {
    hourCounts[r.hora_turno] = (hourCounts[r.hora_turno] || 0) + r.cantidad_monopatines;
  });
  const sortedHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto p-4 md:py-8 pb-28 text-white font-sans selection:bg-[#FF5500] selection:text-white">
      {/* Admin Header */}
      <div className="glass-card rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#FF5500]/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-extrabold text-white flex items-center uppercase tracking-wide">
              <Briefcase className="w-5 h-5 text-[#FF5500] mr-2 neon-orange-text" />
              Panel de Operación
            </h1>
            <span className="bg-[#FF5500] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_8px_rgba(255,85,0,0.3)]">
              Admin
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-light">
            Habilitá turnos, procesá check-in/out con DNI, y controlá la caja diaria en tiempo real.
          </p>
        </div>

        {/* Date Selector & Logout */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center space-x-2 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-[#FF5500]" />
            <input
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none w-28"
            />
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 h-9 px-3 border border-red-500/20 text-red-400 bg-red-950/10 rounded-xl hover:bg-red-950/30 text-xs font-semibold cursor-pointer transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-white/5 mb-6 overflow-x-auto space-x-2 pb-1 scrollbar-none no-scrollbar">
        {[
          { id: "reservas", label: `Reservas (${reservas.length})`, icon: Users },
          { id: "turnos", label: "Horarios & Capacidad", icon: Calendar },
          { id: "caja", label: "Caja del Día", icon: DollarSign },
          { id: "partners", label: "Hoteles Partners", icon: BarChart2 },
          { id: "analytics", label: "Estadísticas & Reportes", icon: TrendingUp },
          { id: "config", label: "Ajustes de Precios", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "border-[#FF5500] text-white bg-white/5 rounded-t-lg"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-white/2"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#FF5500]" : "text-zinc-500"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN CONTAINER CONTENT */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 glass-card rounded-2xl border border-white/10">
          <RefreshCw className="w-8 h-8 text-[#FF5500] animate-spin" />
          <span className="text-xs text-zinc-400 font-light">Sincronizando base de datos...</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: RESERVATIONS LIST */}
          {activeTab === "reservas" && (
            <div className="space-y-4">
              {/* Top Summary Widgets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Reservas Hoy</div>
                  <div className="text-lg font-mono font-bold text-white mt-1">{reservas.length}</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Uso Activo</div>
                  <div className="text-lg font-mono font-bold text-[#FF5500] mt-1 neon-orange-text">
                    {totalScootersRentedToday} / 4
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center border border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Señas MP</div>
                  <div className="text-lg font-mono font-bold text-white mt-1">
                    {reservas.filter(r => r.estado_pago === "seña_pagada").length}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center border border-[#FF5500]/30 bg-[#FF5500]/5">
                  <div className="text-[10px] uppercase tracking-wider text-[#FF5500] font-bold">Caja Estado</div>
                  <div className="text-sm font-black mt-1 uppercase text-[#FF5500] neon-orange-text">
                    {caja ? caja.estado : "Cerrada"}
                  </div>
                </div>
              </div>

              {/* Reservations Grid */}
              {reservas.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center text-sm text-zinc-400 border border-white/10">
                  No hay reservas registradas para el {selectedFecha.split("-").reverse().join("/")}.
                </div>
              ) : (
                <div className="space-y-3">
                  {reservas.map((reserva) => {
                    const isPending = reserva.estado_pago === "pendiente";
                    const isCreated = reserva.estado_reserva === "creada";
                    const isRenting = reserva.estado_reserva === "check_in";
                    const isReturned = reserva.estado_reserva === "check_out";
                    const isNoShow = reserva.estado_reserva === "no_show";

                    return (
                      <div 
                        key={reserva.id}
                        className={`glass-card border rounded-2xl p-5 transition-all ${
                          isRenting 
                            ? "border-[#FF5500]/50 bg-[#FF5500]/5 shadow-[0_0_15px_rgba(255,85,0,0.1)]" 
                            : isReturned 
                              ? "opacity-60 border-white/5" 
                              : "border-white/10"
                        }`}
                      >
                        {/* Reservation header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-3 mb-3 gap-2">
                          <div>
                            <span className="text-[9px] font-mono font-extrabold text-[#FF5500] bg-[#FF5500]/10 px-2.5 py-0.5 rounded border border-[#FF5500]/25 uppercase neon-orange-text">
                              ID: {reserva.id.toUpperCase()}
                            </span>
                            <span className="text-xs font-black text-white ml-3">
                              Turno: {reserva.hora_turno} hs
                            </span>
                            {reserva.partner && (
                              <span className="text-[10px] font-bold bg-[#FF5500]/10 text-[#FF5500] border border-[#FF5500]/25 px-2 py-0.5 rounded ml-2 font-mono">
                                Partner: {reserva.partner}
                              </span>
                            )}
                          </div>
                          
                          {/* Badges */}
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                              reserva.estado_pago === "seña_pagada"
                                ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/15"
                                : "bg-amber-950/20 text-amber-400 border-amber-500/15"
                            }`}>
                              Seña: {reserva.estado_pago === "seña_pagada" ? "PAGADA Online" : "PENDIENTE"}
                            </span>

                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border uppercase ${
                              isCreated 
                                ? "bg-blue-950/20 text-blue-400 border-blue-500/15"
                                : isRenting
                                  ? "bg-[#FF5500] border-[#FF5500] text-white shadow-[0_0_8px_rgba(255,85,0,0.4)]"
                                  : isReturned
                                    ? "bg-zinc-800 text-zinc-400 border-white/5"
                                    : "bg-red-950/20 text-red-400 border-red-500/15"
                            }`}>
                              {reserva.estado_reserva}
                            </span>
                          </div>
                        </div>

                        {/* Customer & pricing info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mt-3.5">
                          <div>
                            <div className="text-zinc-400 font-bold uppercase text-[9px] tracking-wide">Cliente</div>
                            <div className="text-sm font-black text-white mt-0.5">{reserva.nombre_cliente}</div>
                            <div className="text-xs text-zinc-400 mt-1">Tel: {reserva.telefono_cliente}</div>
                            <div className="text-xs text-[#FF5500] mt-1 font-mono font-bold">
                              DNI: {reserva.dni_cliente || "⚠️ No registrado"}
                            </div>
                            
                            {/* Entrega Details */}
                            <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
                              <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wider font-mono">Logística de Entrega</span>
                              {reserva.delivery_mode === "hotel_delivery" ? (
                                <div className="text-xs font-semibold text-emerald-400 flex items-center">
                                  <span className="mr-1">🏨</span> Hotel: <span className="text-white ml-1 font-bold">{reserva.nombre_hotel || "No especificado"}</span>
                                </div>
                              ) : (
                                <div className="text-xs font-semibold text-[#FF5500] flex items-center neon-orange-text">
                                  <span className="mr-1">📍</span> Zona: <span className="text-white ml-1 font-bold">{reserva.punto_encuentro_zona || "Pinamar"}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-zinc-400 font-bold uppercase text-[9px] tracking-wide">Monopatines Rentados</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {reserva.cantidad_monopatines} {reserva.cantidad_monopatines === 1 ? "unidad" : "unidades"}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 font-light">
                              Duración contratada: 1 hora
                            </div>
                          </div>

                          <div>
                            <div className="text-zinc-400 font-bold uppercase text-[9px] tracking-wide">Cobros Relacionados</div>
                            <div className="space-y-1 mt-1 font-mono text-zinc-300">
                              <div className="flex justify-between">
                                <span>Total Alquiler:</span>
                                <span className="font-semibold text-white">${reserva.monto_total.toLocaleString("es-AR")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Seña MP (30%):</span>
                                <span className="text-white">${reserva.monto_seña.toLocaleString("es-AR")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={isCreated ? "font-bold text-[#FF5500]" : ""}>
                                  Saldo Efectivo (70%):
                                </span>
                                <span className="font-bold text-[#FF5500] neon-orange-text">${reserva.monto_saldo.toLocaleString("es-AR")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Garantía en Efectivo:</span>
                                <span className="text-white">${reserva.monto_garantia.toLocaleString("es-AR")}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions drawer/footer */}
                        {!isReturned && !isNoShow && (
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 bg-black/20 p-3.5 rounded-xl">
                            {isCreated && (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                                {!reserva.dni_cliente && (
                                  <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
                                    <span className="text-xs text-zinc-300 font-bold whitespace-nowrap">DNI titular:</span>
                                    <input
                                      type="text"
                                      placeholder="DNI físico obligatorio"
                                      value={checkInDni[reserva.id] || ""}
                                      onChange={(e) => setCheckInDni({ ...checkInDni, [reserva.id]: e.target.value })}
                                      className="border border-white/10 rounded-lg bg-black/40 text-xs px-3 py-1.5 text-white focus:outline-none focus:border-[#FF5500] w-40"
                                    />
                                  </div>
                                )}
                                
                                <div className="flex space-x-2 ml-auto">
                                  <button
                                    onClick={() => handleNoShow(reserva.id)}
                                    className="px-3 h-9 border border-red-500/20 text-red-400 rounded-lg bg-black hover:bg-red-950/20 text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    No-Show (Ausente)
                                  </button>

                                  <button
                                    onClick={() => handleCheckIn(reserva.id)}
                                    disabled={reserva.estado_pago !== "seña_pagada" || (!reserva.dni_cliente && !checkInDni[reserva.id])}
                                    className="px-4.5 h-9 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer flex items-center space-x-1 shadow-[0_0_8px_rgba(255,85,0,0.3)] transition-all"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                                    <span>Cobrar Saldo y Check-In</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {isRenting && (
                              <div className="flex justify-between items-center w-full">
                                <span className="text-xs text-[#FF5500] font-bold flex items-center neon-orange-text">
                                  <Sparkles className="w-4 h-4 mr-1.5 animate-pulse" /> Cliente de paseo...
                                </span>
                                <button
                                  onClick={() => handleCheckOut(reserva.id)}
                                  className="px-4.5 h-9 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-[0_0_8px_rgba(255,85,0,0.4)] transition-all uppercase tracking-wide"
                                >
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                  <span>Check-Out y Devolver Garantía</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HORARIOS & CAPACIDAD */}
          {activeTab === "turnos" && (
            <div className="glass-card border border-white/10 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-white uppercase tracking-wide">Capacidad de Flota por Turno</h3>
                <p className="text-xs text-zinc-400 mt-1 font-light leading-relaxed">
                  Configurá cuántos de los 4 monopatines físicos están disponibles para alquiler en cada turno horario.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {turnos.map((turno) => (
                  <div key={turno.id} className="border border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-black/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-extrabold text-white font-mono">{turno.hora} hs</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">Fecha: {turno.fecha}</div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                        turno.unidades_disponibles === 0 
                          ? "bg-red-950/20 text-red-400 border-red-500/15" 
                          : "bg-emerald-950/20 text-emerald-400 border-emerald-500/15"
                      }`}>
                        Libres: {turno.unidades_disponibles} / {turno.total_unidades}
                      </span>
                    </div>

                    <div className="pt-2.5 border-t border-white/5">
                      <span className="text-[10px] font-bold text-zinc-400 block mb-1.5 uppercase">Flota Habilitada:</span>
                      <div className="flex items-center space-x-1">
                        {[0, 1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            onClick={() => handleUpdateTurnoCapacity(turno.id, num)}
                            className={`w-8 h-8 text-xs font-bold rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                              turno.total_unidades === num
                                ? "bg-[#FF5500] border-[#FF5500] text-white shadow-[0_0_8px_rgba(255,85,0,0.4)]"
                                : "bg-black/40 border-white/10 text-zinc-300 hover:bg-zinc-800"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CAJA DEL DIA */}
          {activeTab === "caja" && (
            <div className="space-y-4">
              {!caja ? (
                <div className="glass-card border border-white/10 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 bg-black/20">
                  <DollarSign className="w-12 h-12 text-[#FF5500] mx-auto animate-pulse neon-orange-glow rounded-full" />
                  <div>
                    <h3 className="font-extrabold text-white text-base uppercase">La Caja está Cerrada</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-light">
                      Para cobrar los saldos en efectivo de clientes y registrar depósitos, debés abrir la caja diaria.
                    </p>
                  </div>
                  
                  <form onSubmit={handleOpenCaja} className="space-y-3 pt-2 text-left">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
                        Monto Inicial de Apertura ($ ARS):
                      </label>
                      <input
                        type="number"
                        required
                        value={montoAperturaInput}
                        onChange={(e) => setMontoAperturaInput(e.target.value)}
                        className="w-full h-11 border border-white/10 rounded-xl px-3 bg-black/40 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full h-11 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-xl font-bold text-sm hover:opacity-95 transition-all cursor-pointer shadow-[0_0_12px_rgba(255,85,0,0.3)] uppercase tracking-wider"
                    >
                      Abrir Caja del Día
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ledger summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="glass-card border border-white/10 rounded-2xl p-5">
                      <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Apertura (Caja Chica)</div>
                      <div className="text-xl font-mono font-bold text-white mt-1">
                        ${caja.monto_apertura.toLocaleString("es-AR")}
                      </div>
                    </div>

                    <div className="glass-card border border-white/10 rounded-2xl p-5">
                      <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex justify-between">
                        <span>Movimientos</span>
                        <span className="text-[10px] text-[#FF5500] font-bold font-mono">+${ingresos.toLocaleString("es-AR")} | -${egresos.toLocaleString("es-AR")}</span>
                      </div>
                      <div className="text-xl font-mono font-bold text-[#FF5500] mt-1 neon-orange-text">
                        +${(ingresos - egresos).toLocaleString("es-AR")}
                      </div>
                    </div>

                    <div className="glass-card border border-[#FF5500]/30 bg-[#FF5500]/5 rounded-2xl p-5">
                      <div className="text-xs text-[#FF5500] font-bold uppercase tracking-wider flex justify-between items-center neon-orange-text">
                        <span>EFECTIVO ACTUAL</span>
                        <span className="text-[9px] bg-[#FF5500]/10 text-[#FF5500] px-2 py-0.5 rounded border border-[#FF5500]/20 font-mono">Con Garantías</span>
                      </div>
                      <div className="text-2xl font-mono font-black text-white mt-1">
                        ${caja.total_efectivo_actual.toLocaleString("es-AR")}
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        Fondo de Garantías en caja: ${(total_garantias).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  {/* Manual entry + Close form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manual entry form */}
                    <div className="glass-card border border-white/10 rounded-2xl p-5 bg-black/20">
                      <h4 className="text-xs uppercase font-mono tracking-wider text-[#FF5500] border-b border-white/5 pb-2 mb-3 font-black neon-orange-text">
                        Registrar Movimiento Manual
                      </h4>
                      <form onSubmit={handleAddManualTransaction} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTxTipo("gasto_manual")}
                            className={`h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              txTipo === "gasto_manual"
                                ? "bg-red-950/30 border-red-500/25 text-red-400"
                                : "bg-black/40 border-white/5 text-zinc-400"
                            }`}
                          >
                            Egreso / Gasto
                          </button>
                          <button
                            type="button"
                            onClick={() => setTxTipo("ingreso_manual")}
                            className={`h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              txTipo === "ingreso_manual"
                                ? "bg-emerald-950/30 border-emerald-500/25 text-emerald-400"
                                : "bg-black/40 border-white/5 text-zinc-400"
                            }`}
                          >
                            Ingreso Extra
                          </button>
                        </div>

                        <div>
                          <input
                            type="number"
                            placeholder="Monto ($)"
                            required
                            value={txMonto}
                            onChange={(e) => setTxMonto(e.target.value)}
                            className="w-full h-10 border border-white/10 bg-black/40 rounded-xl px-3 text-xs font-mono text-white focus:outline-none focus:border-[#FF5500]"
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Descripción (ej: Compra de cintas reflectoras)"
                            required
                            value={txDesc}
                            onChange={(e) => setTxDesc(e.target.value)}
                            className="w-full h-10 border border-white/10 bg-black/40 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-[#FF5500]"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full h-10 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_8px_rgba(255,85,0,0.3)] uppercase tracking-wider"
                        >
                          Guardar Movimiento
                        </button>
                      </form>
                    </div>

                    {/* Close Caja Form */}
                    <div className="glass-card border border-white/10 rounded-2xl p-5 bg-black/20 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs uppercase font-mono tracking-wider text-red-400 border-b border-white/5 pb-2 mb-3 font-bold">
                          Arqueo y Cierre de Caja
                        </h4>
                        <p className="text-xs text-zinc-400 mb-3 leading-relaxed font-light">
                          Contá el efectivo real en caja física, ingresalo abajo para declarar el cierre y computar diferencias si las hubiera.
                        </p>
                      </div>

                      {caja.estado === "abierta" ? (
                        <form onSubmit={handleCloseCaja} className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                              Efectivo Contado Declarado ($):
                            </label>
                            <input
                              type="number"
                              required
                              placeholder={`Esperado: $${caja.total_efectivo_actual}`}
                              value={montoCierreInput}
                              onChange={(e) => setMontoCierreInput(e.target.value)}
                              className="w-full h-10 border border-white/10 bg-black/40 rounded-xl px-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-red-500"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_8px_rgba(220,38,38,0.3)] uppercase tracking-wider"
                          >
                            Cerrar Caja del Día
                          </button>
                        </form>
                      ) : (
                        <div className="bg-black/30 border border-white/5 text-zinc-400 rounded-xl p-4 text-center text-xs font-bold">
                          La caja de este día se encuentra CERRADA
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction history log */}
                  <div className="glass-card border border-white/10 rounded-2xl p-5">
                    <h4 className="text-xs uppercase font-mono tracking-wider text-zinc-400 border-b border-white/5 pb-2.5 mb-3 font-bold">
                      Libro Diario de Caja (Auditoría)
                    </h4>
                    
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                      {caja.transacciones.map((tx) => {
                        const isIncome = ["ingreso_saldo_efectivo", "ingreso_garantia_efectivo", "ingreso_manual", "apertura"].includes(tx.tipo);
                        const isOutcome = ["egreso_garantia_efectivo", "gasto_manual", "cierre"].includes(tx.tipo);

                        return (
                          <div key={tx.id} className="flex justify-between items-center text-xs p-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-xl transition-colors">
                            <div className="flex items-center space-x-2">
                              {isIncome ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
                              )}
                              <div>
                                <span className="font-bold text-white block">{tx.descripcion}</span>
                                <span className="text-[10px] text-zinc-500">{new Date(tx.created_at).toLocaleTimeString("es-AR")} hs</span>
                              </div>
                            </div>
                            <span className={`font-mono font-bold ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                              {isIncome ? "+" : "-"}${tx.monto.toLocaleString("es-AR")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PARTNERS METRICS */}
          {activeTab === "partners" && (
            <div className="glass-card border border-white/10 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-white uppercase tracking-wide">Métricas de Partners / Hoteles</h3>
                <p className="text-xs text-zinc-400 mt-1 font-light leading-relaxed">
                  Seguimiento de reservas originadas desde códigos QR o enlaces en las PWAs de hoteles locales para el pago de comisiones.
                </p>
              </div>

              {partnerStats.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-8">
                  Aún no hay reservas asociadas a ningún partner.
                </div>
              ) : (
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/5 text-zinc-400 font-bold">
                        <th className="p-3">Partner / Hotel</th>
                        <th className="p-3 text-center">Reservas Confirmadas</th>
                        <th className="p-3 text-right">Volumen Total Reservado</th>
                        <th className="p-3 text-right">Comisión sugerida (10%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {partnerStats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-bold text-white">{stat.partner}</td>
                          <td className="p-3 text-center font-mono font-bold text-[#FF5500] neon-orange-text">{stat.reservas_count}</td>
                          <td className="p-3 text-right font-mono text-white font-bold">
                            ${stat.total_recaudado.toLocaleString("es-AR")}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                            ${(stat.total_recaudado * 0.1).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Instructions on how to link */}
              <div className="bg-black/20 border border-white/10 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#FF5500] font-black neon-orange-text">Cómo integrar con hoteles externos</h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-light">
                  Para trackear las reservas que provienen de un hotel, simplemente proveé el enlace del sistema con el parámetro <code className="bg-black/40 border border-white/10 px-1.5 py-0.5 rounded font-mono text-[#FF5500]">partner</code> en la URL:
                </p>
                <div className="bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-mono text-[#FF5500] break-all select-all">
                  {window.location.origin}/?partner=Hotel-del-Bosque
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADJUST SETTINGS / CONFIG */}
          {activeTab === "config" && (
            <div className="glass-card border border-white/10 rounded-2xl p-6 space-y-6 max-w-md mx-auto">
              <div>
                <h3 className="text-base font-extrabold text-white uppercase tracking-wide">Ajustes Generales de Flota</h3>
                <p className="text-xs text-zinc-400 mt-1 font-light leading-relaxed">
                  Definí los precios por hora, porcentaje de seña online y montos de garantías requeridas.
                </p>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
                    Precio por Hora por Monopatín ($ ARS):
                  </label>
                  <input
                    type="number"
                    required
                    value={precioInput}
                    onChange={(e) => setPrecioInput(e.target.value)}
                    className="w-full h-11 border border-white/10 rounded-xl px-3 bg-black/40 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF5500]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
                    Monto de Garantía por Unidad ($ ARS):
                  </label>
                  <input
                    type="number"
                    required
                    value={garantiaInput}
                    onChange={(e) => setGarantiaInput(e.target.value)}
                    className="w-full h-11 border border-white/10 rounded-xl px-3 bg-black/40 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF5500]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1 font-light leading-relaxed">Este monto se recibe en efectivo al hacer check-in y se devuelve al check-out.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
                    Porcentaje de Seña a Cobrar Online (%):
                  </label>
                  <input
                    type="number"
                    required
                    max="100"
                    min="10"
                    value={senaInput}
                    onChange={(e) => setSenaInput(e.target.value)}
                    className="w-full h-11 border border-white/10 rounded-xl px-3 bg-black/40 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF5500]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-11 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(255,85,0,0.3)] uppercase tracking-wider"
                >
                  Guardar Cambios
                </button>
              </form>
            </div>
          )}

          {/* TAB 6: ANALYTICS & REPORTS */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Header block with title & download action */}
              <div className="glass-card border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#FF5500]/5 rounded-full blur-3xl pointer-events-none" />
                
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide flex items-center">
                    <TrendingUp className="w-5 h-5 text-[#FF5500] mr-2 neon-orange-text" />
                    Estadísticas & Reportes de Negocio
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 font-light leading-relaxed">
                    Visualizá la conversión, distribución de entrega de monopatines y descargá las planillas en formato .CSV para auditar en Excel o Google Sheets.
                  </p>
                </div>

                <button
                  onClick={downloadCSVReport}
                  className="flex items-center justify-center space-x-2 h-11 px-5 bg-gradient-to-r from-[#FF5500] to-[#ff6e1a] text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(255,85,0,0.3)] shrink-0 animate-pulse"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar CSV</span>
                </button>
              </div>

              {loadingAnalytics ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 glass-card rounded-2xl border border-white/10">
                  <RefreshCw className="w-8 h-8 text-[#FF5500] animate-spin" />
                  <span className="text-xs text-zinc-400 font-light">Procesando volumen de datos históricos...</span>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  {/* Grid of Key Performance Indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* KPI 1 */}
                    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                      <div className="absolute top-2 right-2 text-white/5"><DollarSign className="w-12 h-12" /></div>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Facturación Realizada</span>
                      <div className="text-2xl font-black text-white mt-1.5 font-mono">
                        ${totalFacturadoActual.toLocaleString("es-AR")}
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-1 font-mono">
                        Online: ${totalSenaOnline.toLocaleString("es-AR")} | Presencial: ${totalSaldoPresencial.toLocaleString("es-AR")}
                      </div>
                    </div>

                    {/* KPI 2 */}
                    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                      <div className="absolute top-2 right-2 text-white/5"><TrendingUp className="w-12 h-12" /></div>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Facturado Proyectado</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1.5 font-mono">
                        ${totalFacturadoProyectado.toLocaleString("es-AR")}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-1 font-light">Total de reservas confirmadas con seña</span>
                    </div>

                    {/* KPI 3 */}
                    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                      <div className="absolute top-2 right-2 text-white/5"><Activity className="w-12 h-12" /></div>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Total Monopatines</span>
                      <div className="text-2xl font-black text-[#FF5500] mt-1.5 font-mono neon-orange-text">
                        {totalMonopatinesAlquilados} u.
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-1 font-light">Unidades reservadas en total</span>
                    </div>

                    {/* KPI 4 */}
                    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
                      <div className="absolute top-2 right-2 text-white/5"><UserCheck className="w-12 h-12" /></div>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Conversión de Pago</span>
                      <div className="text-2xl font-black text-white mt-1.5 font-mono">
                        {tasaConversion}%
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-1 font-mono">
                        {totalPagadasCount} señas / {totalReservasCount} reservas tot.
                      </div>
                    </div>
                  </div>

                  {/* Logistics and Hour Peaks Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card: Logistics Distribution */}
                    <div className="glass-card border border-white/10 rounded-2xl p-5 space-y-4">
                      <div>
                        <h4 className="text-xs uppercase font-bold text-white tracking-wider flex items-center font-mono">
                          <MapPin className="w-4 h-4 text-[#FF5500] mr-1.5" />
                          Logística de Entrega & Zonas
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Distribución de reservas según modalidad de entrega.</p>
                      </div>

                      {/* Mode breakdown progress bar */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-zinc-300">
                            <span>📍 Punto de Encuentro</span>
                            <span className="font-mono text-white">{deliveryMeetingPointCount} ({totalPagadasCount > 0 ? Math.round((deliveryMeetingPointCount / totalPagadasCount) * 100) : 0}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-gradient-to-r from-[#FF5500] to-orange-400 rounded-full transition-all duration-500"
                              style={{ width: `${totalPagadasCount > 0 ? (deliveryMeetingPointCount / totalPagadasCount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-zinc-300">
                            <span>🏨 Envío a Hotel / Hospedaje</span>
                            <span className="font-mono text-white">{deliveryHotelCount} ({totalPagadasCount > 0 ? Math.round((deliveryHotelCount / totalPagadasCount) * 100) : 0}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${totalPagadasCount > 0 ? (deliveryHotelCount / totalPagadasCount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Zonas de punto de encuentro details */}
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <span className="text-[9px] font-bold text-[#FF5500] uppercase tracking-wider font-mono">Zonas Punto de Encuentro elegidas:</span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(zoneCounts).map(([zona, count]) => {
                            const pct = deliveryMeetingPointCount > 0 ? Math.round((count / deliveryMeetingPointCount) * 100) : 0;
                            return (
                              <div key={zona} className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
                                <span className="font-bold text-white text-[10px]">{zona}</span>
                                <div className="flex items-baseline justify-between mt-1">
                                  <span className="font-mono font-bold text-[#FF5500] text-sm">{count}</span>
                                  <span className="text-[9px] text-zinc-500 font-mono">{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card: Peak Renting Hours */}
                    <div className="glass-card border border-white/10 rounded-2xl p-5 space-y-4">
                      <div>
                        <h4 className="text-xs uppercase font-bold text-white tracking-wider flex items-center font-mono">
                          <Clock className="w-4 h-4 text-[#FF5500] mr-1.5" />
                          Horarios de Mayor Demanda
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Volumen total de monopatines rentados según franja horaria.</p>
                      </div>

                      <div className="space-y-3.5">
                        {sortedHours.length === 0 ? (
                          <div className="text-center text-xs text-zinc-500 py-10">Aún no hay datos de horas registrados.</div>
                        ) : (
                          sortedHours.map(([hour, qty]) => {
                            const maxQty = Math.max(...Object.values(hourCounts), 1);
                            const widthPct = Math.round((qty / maxQty) * 100);
                            return (
                              <div key={hour} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-bold text-white">{hour} hs</span>
                                  <span className="font-mono text-zinc-400 font-bold">{qty} {qty === 1 ? "unidad" : "unidades"}</span>
                                </div>
                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-[#FF5500] rounded-full transition-all duration-500"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card: Partner/Hotel Revenue Matrix */}
                  <div className="glass-card border border-white/10 rounded-2xl p-5 space-y-4">
                    <div>
                      <h4 className="text-xs uppercase font-bold text-white tracking-wider flex items-center font-mono">
                        <Building className="w-4 h-4 text-[#FF5500] mr-1.5" />
                        Desglose Comercial de Partners & Canales
                      </h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Auditoría del volumen generado por canal de reserva y liquidación de comisiones sugeridas.</p>
                    </div>

                    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-black/40 border-b border-white/5 text-zinc-400 font-bold">
                            <th className="p-3">Canal / Partner</th>
                            <th className="p-3 text-center">Cant. Reservas</th>
                            <th className="p-3 text-right">Facturación Proyectada</th>
                            <th className="p-3 text-right">Comisión Sugerida (10%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {Object.entries(partnerBreakdown).map(([partnerName, data], index) => (
                            <tr key={index} className="hover:bg-white/5 transition-colors">
                              <td className="p-3 font-bold text-white flex items-center">
                                <span className="mr-1.5">{partnerName === "Directo (PWA)" ? "📱" : "🏨"}</span>
                                {partnerName}
                              </td>
                              <td className="p-3 text-center font-mono text-[#FF5500] font-bold">{data.count}</td>
                              <td className="p-3 text-right font-mono text-white font-bold">
                                ${data.total.toLocaleString("es-AR")}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                                {partnerName === "Directo (PWA)" ? "-" : `$${(data.total * 0.1).toLocaleString("es-AR")}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
