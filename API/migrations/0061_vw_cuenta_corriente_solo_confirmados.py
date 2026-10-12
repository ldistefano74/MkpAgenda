"""
Restringe los cargos de vw_cuenta_corriente a eventos confirmados.

Hasta ahora la vista sumaba a la cuenta corriente los servicios de cualquier
evento, sin mirar `estado`: un evento apenas cargado (Pendiente) o uno Cancelado
generaba deuda igual. Los cargos ('E' por cliente de cabecera, 'E' por
cliente_cuenta y 'S' al prestador) pasan a filtrar `e.estado = 'C'`.

Los movimientos ('M') siguen entrando siempre: son plata que efectivamente se
movió. Por eso una seña cobrada sobre un evento que después se cancela queda
como saldo a favor del cliente, hasta que se borre el movimiento o se cargue
uno contrario.

Mismo criterio que ya usaba el dashboard (API/querysets/dashboard.py).
El set de columnas no cambia, así que alcanza con CREATE OR REPLACE.
"""
from django.db import migrations


NEW_VIEW_SQL = r"""
CREATE OR REPLACE VIEW vw_cuenta_corriente AS
-- Movimientos manuales / cobros / pagos
SELECT 'M'::text AS tipo_movimiento,
    mc.id,
    mc.fecha,
    mc.cliente_id,
    mc.prestador_id,
    mc.evento_id,
    mc.servicio_evento_id,
    CASE WHEN mc.tipo = 'I' THEN 'Ingreso' ELSE 'Egreso' END AS tipo,
    mc.importe,
    mc.concepto,
    mc.medio_pago_cobro_id,
    CASE WHEN ((mc.tipo = 'I' AND mc.cliente_id IS NOT NULL) OR (mc.tipo = 'E' AND mc.prestador_id IS NOT NULL))
        THEN -mc.importe ELSE mc.importe END AS importe_signo
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
WHERE se.cliente_cuenta_id IS NULL AND e.estado = 'C'
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
WHERE se.cliente_cuenta_id IS NOT NULL AND e.estado = 'C'
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
    se.importe_prestador AS importe,
    (s.nombre::text || ' en '::text) || te.nombre::text || ' para ' || c.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY HH24:MI') AS concepto,
    NULL::bigint AS medio_pago_cobro_id,
    se.importe_prestador AS importe_signo
FROM servicios_evento se
    JOIN eventos e ON se.evento_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    JOIN servicios s ON se.servicio_id = s.id
WHERE e.estado = 'C';
"""

# Vista previa (0057): idéntica pero sin el filtro por estado en los tres bloques de cargos.
OLD_VIEW_SQL = r"""
CREATE OR REPLACE VIEW vw_cuenta_corriente AS
SELECT 'M'::text AS tipo_movimiento,
    mc.id, mc.fecha, mc.cliente_id, mc.prestador_id, mc.evento_id, mc.servicio_evento_id,
    CASE WHEN mc.tipo = 'I' THEN 'Ingreso' ELSE 'Egreso' END AS tipo,
    mc.importe, mc.concepto, mc.medio_pago_cobro_id,
    CASE WHEN ((mc.tipo = 'I' AND mc.cliente_id IS NOT NULL) OR (mc.tipo = 'E' AND mc.prestador_id IS NOT NULL))
        THEN -mc.importe ELSE mc.importe END AS importe_signo
FROM movimientos_cuenta mc
UNION ALL
SELECT 'E'::text, NULL::bigint, e.fecha::date, e.cliente_id, NULL::bigint, e.id, NULL::bigint,
    'Evento'::text, sum(se.importe),
    te.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY') || ' para ' || c.nombre,
    NULL::bigint, sum(se.importe)
FROM eventos e
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    JOIN servicios_evento se ON e.id = se.evento_id
    JOIN clientes c ON e.cliente_id = c.id
WHERE se.cliente_cuenta_id IS NULL
GROUP BY e.fecha, e.cliente_id, e.id, te.nombre, c.nombre
UNION ALL
SELECT 'E'::text, NULL::bigint, e.fecha::date, se.cliente_cuenta_id, NULL::bigint, e.id, NULL::bigint,
    'Servicio'::text, sum(se.importe),
    s.nombre || ' en ' || te.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY') || ' (evento de ' || c.nombre || ')',
    NULL::bigint, sum(se.importe)
FROM eventos e
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    JOIN servicios_evento se ON e.id = se.evento_id
    JOIN servicios s ON se.servicio_id = s.id
    JOIN clientes c ON e.cliente_id = c.id
WHERE se.cliente_cuenta_id IS NOT NULL
GROUP BY e.fecha, se.cliente_cuenta_id, e.id, te.nombre, c.nombre, s.nombre
UNION ALL
SELECT 'S'::text, NULL::bigint, e.fecha::date, NULL::bigint, se.prestador_id, e.id, se.id,
    'Servicio'::text, se.importe_prestador,
    (s.nombre::text || ' en '::text) || te.nombre::text || ' para ' || c.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY HH24:MI'),
    NULL::bigint, se.importe_prestador
FROM servicios_evento se
    JOIN eventos e ON se.evento_id = e.id
    JOIN clientes c ON e.cliente_id = c.id
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    JOIN servicios s ON se.servicio_id = s.id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0060_alter_configuracion_valor"),
    ]

    operations = [
        migrations.RunSQL(sql=NEW_VIEW_SQL, reverse_sql=OLD_VIEW_SQL),
    ]
