import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Manejar el preflight request de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Obtener llaves del entorno de la Edge Function
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno en el servidor de Edge Functions." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar cliente de Supabase usando el Service Role para bypass de RLS y persistencia total
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parsear el Body
    const body = await req.json();
    const {
      turno_id,
      cantidad,
      nombre_cliente,
      dni_cliente,
      telefono_cliente,
      email_cliente,
      monto_total,
      monto_sena,
      monto_saldo,
      monto_garantia,
      delivery_mode,
      nombre_hotel,
      punto_encuentro_zona,
      partner,
      source // Parámetro opcional para integraciones futuras
    } = body;

    // Validación básica de campos obligatorios
    if (!turno_id || !cantidad || !nombre_cliente || !dni_cliente || !telefono_cliente || !email_cliente) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos para procesar la reserva." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Llamar a la función atómica en PostgreSQL usando rpc
    const { data: dbResult, error: dbError } = await supabase.rpc("atomic_reserve", {
      p_turno_id: turno_id,
      p_cantidad: Number(cantidad),
      p_nombre: nombre_cliente,
      p_dni: dni_cliente,
      p_telefono: telefono_cliente,
      p_email: email_cliente,
      p_monto_total: Number(monto_total),
      p_monto_sena: Number(monto_sena),
      p_monto_saldo: Number(monto_saldo),
      p_monto_garantia: Number(monto_garantia),
      p_delivery_mode: delivery_mode || "meeting_point",
      p_nombre_hotel: nombre_hotel || null,
      p_punto_encuentro_zona: punto_encuentro_zona || null,
      p_partner: partner || null,
      p_source: source || "PWA-Local"
    });

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Error en la base de datos: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = dbResult as { success: boolean; reserva_id?: string; error?: string; source?: string };

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Retornar éxito con los detalles de la reserva y el source de tracking
    return new Response(
      JSON.stringify({ 
        success: true, 
        reserva_id: result.reserva_id, 
        message: "Reserva creada y stock bloqueado por 10 minutos con éxito.",
        source: result.source 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
