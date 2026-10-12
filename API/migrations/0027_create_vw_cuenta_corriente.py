"""
Crea la vista vw_cuenta_corriente que combina movimientos manuales,
cargos de eventos (clientes) e importes de servicios (prestadores).
Usa CREATE OR REPLACE para manejar que la vista pueda ya existir.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0026_unify_movimientos"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP VIEW IF EXISTS vw_cuenta_corriente;
                CREATE VIEW vw_cuenta_corriente
                AS
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
                    CASE WHEN (mc.tipo = 'I' AND mc.cliente_id IS NOT NULL) OR (mc.tipo = 'E' and mc.prestador_id IS NOT NULL) THEN importe ELSE -importe END as importe_signo
                FROM movimientos_cuenta mc
                UNION ALL
                SELECT 'E'::text AS tipo_movimiento,
                    NULL::bigint AS id,
                    e.fecha::date AS fecha,
                    e.cliente_id as cliente_id,
                    NULL::bigint AS prestador_id,
                    e.id AS evento_id,
                    NULL::bigint AS servicio_evento_id,
                    'Evento'::text AS tipo,
                    sum(se.importe) AS importe,
                    te.nombre AS concepto,
                    sum(se.importe) AS importe_signo
                FROM eventos e
                    JOIN tipos_evento te ON e.tipo_evento_id = te.id
                    JOIN servicios_evento se ON e.id = se.evento_id
                GROUP BY e.fecha, e.cliente_id, e.id, se.evento_id, te.nombre
                UNION ALL
                SELECT 'S'::text AS tipo_movimiento,
                    NULL::bigint AS id,
                    e.fecha::date AS fecha,
                    NULL::bigint AS cliente_id,
                    se.prestador_id,
                    e.id AS evento_id,
                    se.id AS servicio_evento_id,
                    'Servicio'::text AS tipo,
                    se.importe_prestador as importe,
                    (s.nombre::text || ' en '::text) || te.nombre::text || ' - ' || to_char(e.fecha, 'DD/MM/YYYY HH24:MI') AS concepto,
                    se.importe_prestador AS importe_signo
                FROM servicios_evento se
                    JOIN eventos e ON se.evento_id = e.id
                    JOIN tipos_evento te ON e.tipo_evento_id = te.id
                    JOIN servicios s ON se.servicio_id = s.id;
            """,
            reverse_sql="DROP VIEW IF EXISTS vw_cuenta_corriente;",
        ),
    ]
