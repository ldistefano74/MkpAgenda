-- View: public.vw_cuenta_corriente

-- DROP VIEW public.vw_cuenta_corriente;

CREATE OR REPLACE VIEW public.vw_cuenta_corriente
 AS
-- Movimientos manuales / cobros / pagos
 SELECT 'M'::text AS tipo_movimiento,
    mc.id,
    mc.fecha,
    mc.cliente_id,
    mc.prestador_id,
    mc.evento_id,
    mc.servicio_evento_id,
    CASE WHEN mc.tipo = 'I' THEN 'Ingreso' ELSE 'Egreso' END as tipo,
    mc.importe,
    mc.concepto,
	mc.medio_pago_cobro_id,
    CASE WHEN ((mc.tipo = 'I' AND mc.cliente_id is not NULL) OR (mc.tipo = 'E' and mc.prestador_id is not NULL))
		THEN -mc.importe ELSE mc.importe END as importe_signo
   FROM movimientos_cuenta mc
UNION ALL
-- Evento: servicios a cargo del cliente de la cabecera (sin cliente_cuenta)
 SELECT 'E'::text AS tipo_movimiento,
    NULL::bigint AS id,
    e.fecha::date AS fecha,
    e.cliente_id AS cliente_id,
    NULL::bigint AS prestador_id,
    e.id AS evento_id,
    NULL::bigint AS servicio_evento_id,
    'Evento'::text AS tipo,
    sum(se.importe) AS importe,
    te.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY') || ' para ' || c.nombre AS concepto,
	NULL::bigint AS medio_pago_cobro_id,
    sum(se.importe) AS importe_signo
   FROM eventos e
     JOIN tipos_evento te ON e.tipo_evento_id = te.id
     JOIN servicios_evento se ON e.id = se.evento_id
	 JOIN clientes c ON e.cliente_id = c.id
  WHERE se.cliente_cuenta_id IS NULL and e.estado = 'C'
  GROUP BY e.fecha, e.cliente_id, e.id, te.nombre, c.nombre
UNION ALL
-- Evento: servicios con cliente_cuenta propio (a cargo de otro cliente)
 SELECT 'E'::text AS tipo_movimiento,
    NULL::bigint AS id,
    e.fecha::date AS fecha,
    se.cliente_cuenta_id AS cliente_id,
    NULL::bigint AS prestador_id,
    e.id AS evento_id,
    NULL::bigint AS servicio_evento_id,
    'Servicio'::text AS tipo,
    sum(se.importe) AS importe,
    s.nombre || ' en ' || te.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY') || ' (evento de ' || c.nombre || ')' AS concepto,
	NULL::bigint AS medio_pago_cobro_id,
    sum(se.importe) AS importe_signo
   FROM eventos e
     JOIN tipos_evento te ON e.tipo_evento_id = te.id
     JOIN servicios_evento se ON e.id = se.evento_id
     JOIN servicios s ON se.servicio_id = s.id
	 JOIN clientes c ON e.cliente_id = c.id
  WHERE se.cliente_cuenta_id IS NOT NULL and e.estado = 'C'
  GROUP BY e.fecha, se.cliente_cuenta_id, e.id, te.nombre, c.nombre, s.nombre
UNION ALL
-- Servicio: importe a pagar al prestador
 SELECT 'S'::text AS tipo_movimiento,
    NULL::bigint AS id,
    e.fecha::date AS fecha,
    NULL::bigint AS cliente_id,
    se.prestador_id,
    e.id AS evento_id,
    se.id AS servicio_evento_id,
    'Servicio'::text AS tipo,
    se.importe_prestador as importe,
    (s.nombre::text || ' en '::text) || te.nombre::text || ' para ' || c.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY HH24:MI') AS concepto,
	NULL::bigint AS medio_pago_cobro_id,
    se.importe_prestador AS importe_signo
   FROM servicios_evento se
     JOIN eventos e ON se.evento_id = e.id
	 JOIN clientes c ON e.cliente_id = c.id
     JOIN tipos_evento te ON e.tipo_evento_id = te.id
     JOIN servicios s ON se.servicio_id = s.id
  WHERE e.estado = 'C';

ALTER TABLE public.vw_cuenta_corriente
    OWNER TO postgres;
