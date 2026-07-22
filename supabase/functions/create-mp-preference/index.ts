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
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno de Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ error: "Falta la variable de entorno MP_ACCESS_TOKEN en la Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parsear el Body
    const body = await req.json();
    const { reserva_id } = body;

    if (!reserva_id) {
      return new Response(
        JSON.stringify({ error: "El campo reserva_id es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Obtener la reserva desde Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("*")
      .eq("id", reserva_id)
      .single();

    if (reservaError || !reserva) {
      return new Response(
        JSON.stringify({ error: "Reserva no encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Construir el cuerpo de la Preferencia de MercadoPago
    // El monto a cobrar es el 30% de la seña (ya calculado en monto_seña)
    const montoSeña = Number(reserva.monto_seña);

    const preferenceBody = {
      items: [
        {
          id: reserva_id,
          title: `Seña Alquiler Scooter VIUX — ${reserva.cantidad_monopatines} unidad(es) — ${reserva.fecha_turno} ${reserva.hora_turno}hs`,
          description: `Reserva #${reserva_id} — Seña del 30% del alquiler. Cliente: ${reserva.nombre_cliente}`,
          quantity: 1,
          unit_price: montoSeña,
          currency_id: "ARS",
        },
      ],
      payer: {
        name: reserva.nombre_cliente,
        email: reserva.email_cliente,
        phone: {
          number: reserva.telefono_cliente,
        },
        identification: {
          type: "DNI",
          number: reserva.dni_cliente,
        },
      },
      external_reference: reserva_id,
      back_urls: {
        success: `${appUrl}/?payment=success&external_reference=${reserva_id}`,
        failure: `${appUrl}/?payment=failure&external_reference=${reserva_id}`,
        pending: `${appUrl}/?payment=pending&external_reference=${reserva_id}`,
      },
      auto_return: "approved",
      statement_descriptor: "VIUX Scooters",
      expires: false,
    };

    // 5. Llamar a la API de MercadoPago para crear la preferencia
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();
      console.error("Error de MercadoPago:", mpError);
      return new Response(
        JSON.stringify({ error: `Error al crear preferencia en MercadoPago: ${mpError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpData = await mpResponse.json();

    // 6. Guardar el preference_id real en la reserva
    await supabase
      .from("reservas")
      .update({ mp_preference_id: mpData.id })
      .eq("id", reserva_id);

    // 7. Retornar el init_point y el preference_id al frontend
    return new Response(
      JSON.stringify({
        success: true,
        preference_id: mpData.id,
        init_point: mpData.init_point,           // URL para producción
        sandbox_init_point: mpData.sandbox_init_point, // URL para pruebas/sandbox
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error inesperado:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
