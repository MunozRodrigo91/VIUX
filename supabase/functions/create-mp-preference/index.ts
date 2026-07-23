import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    // Leer desde variable de entorno — sin fallback, DEBE estar configurado en producción
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
    let appUrl = Deno.env.get("APP_URL") || "";
    if (appUrl.trim() === "") {
      appUrl = "http://localhost:3000";
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno de Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ error: "MP_ACCESS_TOKEN no configurado en las variables de entorno." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { reserva_id } = body;

    if (!reserva_id) {
      return new Response(
        JSON.stringify({ error: "El campo reserva_id es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("*")
      .eq("id", reserva_id)
      .single();

    if (reservaError || !reserva) {
      console.error("Error buscando reserva:", reservaError);
      return new Response(
        JSON.stringify({ error: "Reserva no encontrada: " + (reservaError?.message ?? reserva_id) }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // El campo en Supabase es monto_sena (sin tilde)
    const montoSena = Number(reserva.monto_sena ?? reserva.monto_total * 0.30);

    const preferenceBody = {
      items: [
        {
          id: reserva_id,
          title: "Sena Alquiler Scooter VIUX - " + reserva.cantidad_monopatines + " unidades - " + reserva.fecha_turno + " " + String(reserva.hora_turno).substring(0, 5) + "hs",
          description: "Reserva #" + reserva_id + " - Sena del 30% del alquiler. Cliente: " + reserva.nombre_cliente,
          quantity: 1,
          unit_price: montoSena,
          currency_id: "ARS",
        },
      ],
      payer: {
        name: reserva.nombre_cliente,
        email: reserva.email_cliente,
        phone: { number: String(reserva.telefono_cliente ?? "") },
        identification: { type: "DNI", number: String(reserva.dni_cliente ?? "") },
      },
      external_reference: reserva_id,
      back_urls: {
        success: appUrl + "/?payment=success&external_reference=" + reserva_id,
        failure: appUrl + "/?payment=failure&external_reference=" + reserva_id,
        pending: appUrl + "/?payment=pending&external_reference=" + reserva_id,
      },
      // auto_return solo es aceptado por MP si las back_urls son válidas (HTTPS).
      // Si usamos localhost en http, MP las ignora y tira error 400 si exigimos auto_return.
      auto_return: appUrl.startsWith("https") ? "approved" : undefined,
      statement_descriptor: "VIUX Scooters",
    };

    console.log("Creando preferencia MP para reserva:", reserva_id, "monto:", montoSena);

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + mpAccessToken,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpResponseText = await mpResponse.text();
    console.log("MP Response status:", mpResponse.status, "body:", mpResponseText.substring(0, 500));

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Error al crear preferencia en MercadoPago (" + mpResponse.status + "): " + mpResponseText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpData = JSON.parse(mpResponseText);

    await supabase
      .from("reservas")
      .update({ mp_preference_id: mpData.id })
      .eq("id", reserva_id);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: mpData.id,
        init_point: mpData.init_point,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error inesperado en create-mp-preference:", error);
    return new Response(
      JSON.stringify({ error: String((error as any).message ?? error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
