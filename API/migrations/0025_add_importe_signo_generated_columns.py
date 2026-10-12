import API.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("API", "0024_remove_movimientocuenta_cliente_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE movimientos_cuenta_cliente
                        ADD COLUMN importe_signo numeric(10,2)
                        GENERATED ALWAYS AS (
                            CASE
                                WHEN tipo = 'I' THEN importe
                                ELSE -importe
                            END
                        ) STORED;
                    """,
                    reverse_sql="""
                        ALTER TABLE movimientos_cuenta_cliente
                        DROP COLUMN importe_signo;
                    """,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="movimientocliente",
                    name="importe_signo",
                    field=API.models.Precio(
                        editable=False,
                        help_text="Importe con signo: positivo para ingresos, negativo para egresos (campo calculado)",
                        null=True,
                        verbose_name="Importe con signo",
                    ),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE movimientos_cuenta_prestador
                        ADD COLUMN importe_signo numeric(10,2)
                        GENERATED ALWAYS AS (
                            CASE
                                WHEN tipo = 'I' THEN importe
                                ELSE -importe
                            END
                        ) STORED;
                    """,
                    reverse_sql="""
                        ALTER TABLE movimientos_cuenta_prestador
                        DROP COLUMN importe_signo;
                    """,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="movimientoprestador",
                    name="importe_signo",
                    field=API.models.Precio(
                        editable=False,
                        help_text="Importe con signo: positivo para ingresos, negativo para egresos (campo calculado)",
                        null=True,
                        verbose_name="Importe con signo",
                    ),
                ),
            ],
        ),
    ]
