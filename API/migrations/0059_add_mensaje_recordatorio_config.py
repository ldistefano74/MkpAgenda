from django.db import migrations

MENSAJE_DEFAULT = (
    "¡Hola {{CLIENTE}}!\n\n"
    "Te recuerdo tu evento {{FECHA}} a las {{HORA}} hs.\n"
    "Lugar: {{DIRECCION}}\n\n"
    "Servicios:\n"
    "{{SERVICIOS}}\n\n"
    "Cualquier cosa escribime por acá. ¡Nos vemos!"
)


def add_mensaje_recordatorio(apps, schema_editor):
    Configuracion = apps.get_model('API', 'Configuracion')
    Configuracion.objects.get_or_create(
        clave='MENSAJE_RECORDATORIO',
        defaults={
            'valor': MENSAJE_DEFAULT,
            'descripcion': (
                'Recordatorio por WhatsApp. Tags: CLIENTE, TIPO_EVENTO, FECHA, HORA, '
                'DIRECCION, SERVICIOS'
            ),
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('API', '0058_evento_recordatorio_enviado'),
    ]

    operations = [
        migrations.RunPython(add_mensaje_recordatorio, migrations.RunPython.noop),
    ]
