
-- Agregar columna duracion_horas
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS duracion_horas INTEGER;

-- Reemplazar funcion atomic_reserve
CREATE OR REPLACE FUNCTION atomic_reserve(
    p_turno_id text,
    p_cantidad integer,
    p_nombre text,
    p_dni text,
    p_telefono text,
    p_email text,
    p_monto_total integer,
    p_monto_sena integer,
    p_monto_saldo integer,
    p_monto_garantia integer,
    p_delivery_mode text,
    p_nombre_hotel text,
    p_punto_encuentro_zona text,
    p_partner text,
    p_source text,
    p_duracion_horas integer DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
    v_turno record;
    v_next_turno record;
    v_reserva_id text;
    v_hora_int integer;
    v_i integer;
BEGIN
    -- 1. Bloquear y verificar el primer turno
    SELECT * INTO v_turno
    FROM public.turnos
    WHERE id = p_turno_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'El turno de inicio no existe.');
    END IF;

    IF v_turno.unidades_disponibles < p_cantidad THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay suficientes monopatines disponibles en el horario de inicio.');
    END IF;

    -- 2. Verificar disponibilidad de turnos subsecuentes
    IF p_duracion_horas IS NULL THEN
        -- Dia completo: bloquear todos los turnos del dia desde esta hora en adelante
        FOR v_next_turno IN
            SELECT * FROM public.turnos
            WHERE fecha = v_turno.fecha AND hora > v_turno.hora
            ORDER BY hora
            FOR UPDATE
        LOOP
            IF v_next_turno.unidades_disponibles < p_cantidad THEN
                RETURN jsonb_build_object('success', false, 'error', 'No hay suficientes monopatines disponibles para el día completo (conflicto a las ' || v_next_turno.hora || ').');
            END IF;
        END LOOP;
    ELSIF p_duracion_horas > 1 THEN
        v_hora_int := cast(split_part(v_turno.hora::text, ':', 1) as integer);
        FOR v_i IN 1 .. (p_duracion_horas - 1) LOOP
            DECLARE
                v_next_hora text := lpad(cast(v_hora_int + v_i as text), 2, '0') || ':00:00';
            BEGIN
                SELECT * INTO v_next_turno
                FROM public.turnos
                WHERE fecha = v_turno.fecha AND hora = v_next_hora::time
                FOR UPDATE;

                IF NOT FOUND THEN
                    RETURN jsonb_build_object('success', false, 'error', 'No hay turnos creados para la hora ' || v_next_hora || ' que requiere tu reserva.');
                END IF;

                IF v_next_turno.unidades_disponibles < p_cantidad THEN
                    RETURN jsonb_build_object('success', false, 'error', 'No hay suficientes monopatines disponibles en el turno de las ' || v_next_hora || '.');
                END IF;
            END;
        END LOOP;
    END IF;

    -- 3. Descontar stock del primer turno
    UPDATE public.turnos
    SET unidades_disponibles = unidades_disponibles - p_cantidad
    WHERE id = p_turno_id;

    -- 4. Descontar stock de turnos subsecuentes
    IF p_duracion_horas IS NULL THEN
        UPDATE public.turnos
        SET unidades_disponibles = unidades_disponibles - p_cantidad
        WHERE fecha = v_turno.fecha AND hora > v_turno.hora;
    ELSIF p_duracion_horas > 1 THEN
        v_hora_int := cast(split_part(v_turno.hora::text, ':', 1) as integer);
        FOR v_i IN 1 .. (p_duracion_horas - 1) LOOP
            DECLARE
                v_next_hora text := lpad(cast(v_hora_int + v_i as text), 2, '0') || ':00:00';
            BEGIN
                UPDATE public.turnos
                SET unidades_disponibles = unidades_disponibles - p_cantidad
                WHERE fecha = v_turno.fecha AND hora = v_next_hora::time;
            END;
        END LOOP;
    END IF;

    -- 5. Crear la reserva
    v_reserva_id := 'res_' || upper(substr(md5(random()::text), 1, 6));
    
    INSERT INTO public.reservas (
        id, turno_id, fecha_turno, hora_turno, nombre_cliente, dni_cliente,
        telefono_cliente, email_cliente, cantidad_monopatines, monto_total,
        monto_sena, monto_saldo, monto_garantia, partner, delivery_mode,
        nombre_hotel, punto_encuentro_zona, duracion_horas, estado_pago, estado_reserva
    ) VALUES (
        v_reserva_id, p_turno_id, v_turno.fecha, v_turno.hora::time, p_nombre, p_dni,
        p_telefono, p_email, p_cantidad::smallint, p_monto_total,
        p_monto_sena, p_monto_saldo, p_monto_garantia, p_partner, p_delivery_mode::delivery_mode,
        p_nombre_hotel, p_punto_encuentro_zona::zona_encuentro, p_duracion_horas, 'pendiente'::estado_pago, 'creada'::estado_reserva
    );

    RETURN jsonb_build_object('success', true, 'reserva_id', v_reserva_id, 'source', p_source);
END;
$$ LANGUAGE plpgsql;
