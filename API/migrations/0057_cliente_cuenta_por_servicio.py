"""
Mueve cliente_cuenta de Evento a ServicioEvento (granularidad por servicio).
Propaga los datos existentes y redefine vw_cuenta_corriente para partir el
cargo del evento entre el cliente de cabecera y los clientes a cargo de cada servicio.
"""
from django.db import migrations, models
import django.db.models.deletion


NEW_VIEW_SQL = r"""
-- DROP explícito: la vista previa (0027) tiene otro set de columnas, por lo que
-- CREATE OR REPLACE fallaría al reconstruirla desde cero (base de test).
DROP VIEW IF EXISTS vw_cuenta_corriente;
CREATE VIEW vw_cuenta_corriente AS
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
WHERE se.cliente_cuenta_id IS NULL
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
  WHERE se.cliente_cuenta_id IS NOT NULL
  GROUP BY e.fecha, se.cliente_cuenta_id, e.id, te.nombre, c.nombre, s.nombre
UNION ALL
-- Servicio: importe a pagar al prestador (sin cambios)
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
    JOIN servicios s ON se.servicio_id = s.id;
"""

# Vista anterior (para reverse_sql): estado previo al cambio, con un solo bloque
# 'E' usando COALESCE(e.cliente_cuenta_id, e.cliente_id).
OLD_VIEW_SQL = r"""
CREATE OR REPLACE VIEW vw_cuenta_corriente AS
SELECT 'M'::text AS tipo_movimiento, mc.id, mc.fecha, mc.cliente_id, mc.prestador_id,
    mc.evento_id, mc.servicio_evento_id,
    CASE WHEN mc.tipo = 'I' THEN 'Ingreso' ELSE 'Egreso' END AS tipo,
    mc.importe, mc.concepto, mc.medio_pago_cobro_id,
    CASE WHEN ((mc.tipo = 'I' AND mc.cliente_id IS NOT NULL) OR (mc.tipo = 'E' AND mc.prestador_id IS NOT NULL))
        THEN -mc.importe ELSE mc.importe END AS importe_signo
FROM movimientos_cuenta mc
UNION ALL
SELECT 'E'::text, NULL::bigint, e.fecha::date, COALESCE(e.cliente_cuenta_id, e.cliente_id),
    NULL::bigint, e.id, NULL::bigint, 'Evento'::text, sum(se.importe),
    te.nombre || ' el ' || to_char(e.fecha, 'DD/MM/YYYY') || ' para ' || c.nombre,
    NULL::bigint, sum(se.importe)
FROM eventos e
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    JOIN servicios_evento se ON e.id = se.evento_id
    JOIN clientes c ON e.cliente_id = c.id
GROUP BY e.fecha, e.cliente_id, e.id, te.nombre, c.nombre
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


def propagar_cliente_cuenta(apps, schema_editor):
    """Copia Evento.cliente_cuenta a todos los ServicioEvento del evento."""
    Evento = apps.get_model('API', 'Evento')
    ServicioEvento = apps.get_model('API', 'ServicioEvento')
    for ev in Evento.objects.filter(cliente_cuenta__isnull=False).values('id', 'cliente_cuenta_id'):
        ServicioEvento.objects.filter(evento_id=ev['id']).update(
            cliente_cuenta_id=ev['cliente_cuenta_id']
        )


def reverse_propagar(apps, schema_editor):
    """No-op: la reconstrucción exacta de Evento.cliente_cuenta no es determinística."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0056_cliente_unique_cliente_telefono"),
    ]

    operations = [
        migrations.AddField(
            model_name='servicioevento',
            name='cliente_cuenta',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name='servicios_a_cargo',
                to='API.cliente',
                verbose_name='A cargo de',
                help_text='Cliente responsable del pago de este servicio (si difiere del cliente del evento)',
            ),
        ),
        migrations.RunPython(propagar_cliente_cuenta, reverse_propagar),
        migrations.RunSQL(sql=NEW_VIEW_SQL, reverse_sql=OLD_VIEW_SQL),
        migrations.RemoveField(model_name='evento', name='cliente_cuenta'),
    ]
