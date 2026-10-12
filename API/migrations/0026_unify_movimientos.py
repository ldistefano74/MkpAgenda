"""
Unifica MovimientoCliente y MovimientoPrestador en una sola tabla MovimientoCuenta.
- Crea la tabla movimientos_cuenta con importe_signo como columna generada (GENERATED ALWAYS AS)
- Migra datos existentes desde ambas tablas
- Elimina las tablas anteriores
"""

import API.models
import API.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0025_add_importe_signo_generated_columns"),
    ]

    operations = [
        # 1. Crear MovimientoCuenta: en la DB sin importe_signo (se agrega como generated column después)
        #    En el state de Django, el modelo ya tiene todos los campos.
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        CREATE TABLE movimientos_cuenta (
                            id bigserial PRIMARY KEY,
                            fecha date NOT NULL,
                            cliente_id bigint NULL REFERENCES clientes(id) ON DELETE RESTRICT,
                            prestador_id bigint NULL REFERENCES prestadores(id) ON DELETE RESTRICT,
                            evento_id bigint NULL REFERENCES eventos(id) ON DELETE RESTRICT,
                            servicio_evento_id bigint NULL REFERENCES servicios_evento(id) ON DELETE RESTRICT,
                            tipo varchar(1) NOT NULL,
                            importe numeric(10,2) NOT NULL DEFAULT 0,
                            concepto varchar(255) NOT NULL,
                            importe_signo numeric(10,2) GENERATED ALWAYS AS (
                                CASE WHEN tipo = 'I' THEN importe ELSE -importe END
                            ) STORED,
                            CONSTRAINT movimiento_cliente_o_prestador CHECK (
                                (cliente_id IS NOT NULL AND prestador_id IS NULL) OR
                                (cliente_id IS NULL AND prestador_id IS NOT NULL)
                            )
                        );
                        CREATE INDEX movimientos_cuenta_cliente_id ON movimientos_cuenta(cliente_id);
                        CREATE INDEX movimientos_cuenta_prestador_id ON movimientos_cuenta(prestador_id);
                        CREATE INDEX movimientos_cuenta_evento_id ON movimientos_cuenta(evento_id);
                        CREATE INDEX movimientos_cuenta_servicio_evento_id ON movimientos_cuenta(servicio_evento_id);
                    """,
                    reverse_sql="DROP TABLE IF EXISTS movimientos_cuenta;",
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name="MovimientoCuenta",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("fecha", models.DateField(help_text="Fecha del movimiento", verbose_name="Fecha")),
                        ("cliente", models.ForeignKey(blank=True, help_text="Cliente asociado al movimiento", null=True, on_delete=django.db.models.deletion.RESTRICT, related_name="movimientos", to="API.cliente")),
                        ("prestador", models.ForeignKey(blank=True, help_text="Prestador asociado al movimiento", null=True, on_delete=django.db.models.deletion.RESTRICT, related_name="movimientos", to="API.prestador")),
                        ("evento", models.ForeignKey(blank=True, help_text="Evento asociado al movimiento (si corresponde)", null=True, on_delete=django.db.models.deletion.RESTRICT, to="API.evento")),
                        ("servicio_evento", models.ForeignKey(blank=True, help_text="Referencia al servicio específico que generó este movimiento (si aplica)", null=True, on_delete=django.db.models.deletion.RESTRICT, to="API.servicioevento")),
                        ("tipo", models.CharField(choices=[("I", "Ingreso"), ("E", "Egreso")], help_text="Tipo de movimiento: ingreso o egreso", max_length=1, verbose_name="Tipo")),
                        ("importe", API.models.Precio(decimal_places=2, default=0, help_text="Monto recibido/pagado en este movimiento", max_digits=10, verbose_name="Importe")),
                        ("concepto", models.CharField(help_text="Descripción del movimiento", max_length=255, verbose_name="Concepto")),
                        ("importe_signo", API.models.Precio(decimal_places=2, editable=False, help_text="Importe con signo: positivo para ingresos, negativo para egresos (campo calculado)", max_digits=10, null=True, verbose_name="Importe con signo")),
                    ],
                    options={
                        "verbose_name": "Movimiento de cuenta",
                        "verbose_name_plural": "Movimientos de cuenta",
                        "db_table": "movimientos_cuenta",
                        "ordering": ["-fecha"],
                        "constraints": [
                            models.CheckConstraint(
                                check=models.Q(
                                    ("cliente__isnull", False),
                                    ("prestador__isnull", True),
                                ) | models.Q(
                                    ("cliente__isnull", True),
                                    ("prestador__isnull", False),
                                ),
                                name="movimiento_cliente_o_prestador",
                            ),
                        ],
                    },
                ),
            ],
        ),
        # 2. Migrar datos existentes
        migrations.RunSQL(
            sql="""
                INSERT INTO movimientos_cuenta (fecha, cliente_id, evento_id, tipo, importe, concepto)
                SELECT fecha, cliente_id, evento_id, tipo, importe, concepto
                FROM movimientos_cuenta_cliente;

                INSERT INTO movimientos_cuenta (fecha, prestador_id, servicio_evento_id, tipo, importe, concepto)
                SELECT fecha, prestador_id, servicio_evento_id, tipo, importe, concepto
                FROM movimientos_cuenta_prestador;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 3. Eliminar modelos anteriores
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        DROP TABLE IF EXISTS movimientos_cuenta_cliente;
                        DROP TABLE IF EXISTS movimientos_cuenta_prestador;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.DeleteModel(name="MovimientoCliente"),
                migrations.DeleteModel(name="MovimientoPrestador"),
            ],
        ),
    ]
