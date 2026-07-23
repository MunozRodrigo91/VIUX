export interface Config {
  precioPorHora: number; // e.g. 8000
  precio2Horas: number; // e.g. 14000
  precioDiaCompleto: number; // e.g. 35000
  montoGarantia: number; // e.g. 10000
  porcentajeSeña: number; // e.g. 30
  toleranciaNoShowMinutos: number; // e.g. 15
  capacidadMaximaScooters: number; // e.g. 4
}

export type DuracionTurno = 1 | 2 | null; // null = día completo

export interface Turno {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // e.g. "09:00", "10:00", "11:00", etc.
  total_unidades: number; // e.g. 4
  unidades_disponibles: number; // computed as total_unidades - sum of quantity of active reservations
  habilitado: boolean; // if false, hidden from public booking
}

export type EstadoPago = 'pendiente' | 'seña_pagada' | 'reembolsado';
export type EstadoReserva = 'creada' | 'check_in' | 'check_out' | 'no_show';

export interface Reserva {
  id: string;
  turno_id: string;
  fecha_turno: string; // YYYY-MM-DD
  hora_turno: string; // e.g. "14:00"
  nombre_cliente: string;
  dni_cliente: string; // Registrado al reservar o al hacer check-in
  telefono_cliente: string;
  email_cliente: string;
  cantidad_monopatines: number;
  monto_total: number;
  monto_sena: number; // 30% — columna real en Supabase
  monto_seña?: number; // alias legacy (server.ts local)
  monto_saldo: number; // 70%
  monto_garantia: number; // Reembolsable
  estado_pago: EstadoPago;
  estado_reserva: EstadoReserva;
  partner?: string; // Hotel/partner tracker
  delivery_mode?: 'meeting_point' | 'hotel_delivery'; // Delivery mode
  nombre_hotel?: string;
  punto_encuentro_zona?: 'Pinamar' | 'Mar de Ostende' | 'Valeria del mar' | 'Carilo';
  mp_preference_id?: string;
  duracion_horas: DuracionTurno; // Chosen by customer: 1, 2, or null
  created_at: string;
}

export type TipoTransaccion = 
  | 'ingreso_seña_mp' 
  | 'ingreso_saldo_efectivo' 
  | 'ingreso_garantia_efectivo' 
  | 'egreso_garantia_efectivo' 
  | 'gasto_manual' 
  | 'ingreso_manual' 
  | 'apertura' 
  | 'cierre';

export interface Transaccion {
  id: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion: string;
  reserva_id?: string;
  created_at: string;
}

export interface Caja {
  fecha: string; // YYYY-MM-DD
  monto_apertura: number;
  monto_cierre?: number;
  estado: 'abierta' | 'cerrada';
  transacciones: Transaccion[];
  total_efectivo_actual: number; // Computed
}

export interface PartnerStats {
  partner: string;
  reservas_count: number;
  total_recaudado: number;
}
