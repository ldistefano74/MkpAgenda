"""
Servicio de armado del mensaje de recordatorio de eventos (WhatsApp).

El texto base se guarda en la tabla de Configuracion bajo la clave
MENSAJE_RECORDATORIO y admite tags {{TAG}} que se reemplazan con datos
del evento (ver TAGS_DISPONIBLES).
"""
from urllib.parse import quote

from django.utils import timezone

from API import config
from API.models import Evento

DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

MENSAJE_DEFAULT = (
    "¡Hola {{CLIENTE}}!\n\n"
    "Te recuerdo tu {{TIPO_EVENTO}} {{FECHA}} a las {{HORA}} hs.\n"
    "Lugar: {{DIRECCION}}\n\n"
    "Servicios:\n"
    "{{SERVICIOS}}\n\n"
    "Cualquier cosa escribime por acá. ¡Nos vemos!"
)

TAGS_DISPONIBLES = ['CLIENTE', 'TIPO_EVENTO', 'FECHA', 'HORA', 'DIRECCION', 'SERVICIOS']


def _formatear_fecha(fecha_local):
    """
    Devuelve la fecha en lenguaje natural relativo al día de hoy:
    'hoy', 'mañana', o 'el sábado 12/09'.
    """
    hoy = timezone.localdate()
    dias = (fecha_local.date() - hoy).days
    if dias == 0:
        return 'hoy'
    if dias == 1:
        return 'mañana'
    return f"el {DIAS_SEMANA[fecha_local.weekday()]} {fecha_local.strftime('%d/%m')}"


def _formatear_servicios(evento):
    """
    Lista los servicios activos del evento, uno por línea y precedidos por '- ',
    agrupando los repetidos ('- Maquillaje (x2)').
    """
    nombres = []
    conteo = {}
    for se in evento.servicios_evento.filter(activo=True).select_related('servicio'):
        nombre = se.servicio.nombre
        if nombre not in conteo:
            conteo[nombre] = 0
            nombres.append(nombre)
        conteo[nombre] += 1
    return '\n'.join(
        f"- {n} (x{conteo[n]})" if conteo[n] > 1 else f"- {n}"
        for n in nombres
    )


def build_contexto_recordatorio(evento):
    """Construye el diccionario {tag: valor} para reemplazar en el mensaje."""
    fecha_local = timezone.localtime(evento.fecha)
    return {
        'CLIENTE': evento.cliente.nombre if evento.cliente else '',
        'TIPO_EVENTO': evento.tipo_evento.nombre.lower() if evento.tipo_evento else '',
        'FECHA': _formatear_fecha(fecha_local),
        'HORA': fecha_local.strftime('%H:%M'),
        'DIRECCION': evento.direccion_servicios or '',
        'SERVICIOS': _formatear_servicios(evento),
    }


def build_mensaje_recordatorio(evento):
    """Devuelve el mensaje de recordatorio con los tags ya reemplazados."""
    plantilla = config.get_config(config.MENSAJE_RECORDATORIO) or MENSAJE_DEFAULT
    contexto = build_contexto_recordatorio(evento)
    mensaje = plantilla
    for tag, valor in contexto.items():
        mensaje = mensaje.replace('{{' + tag + '}}', valor)
    return mensaje


def build_whatsapp_url(telefono, mensaje):
    """
    Arma la URL click-to-chat de WhatsApp. Devuelve None si no hay teléfono.
    El mensaje NO se codifica acá: el frontend lo hace al abrir el link.
    """
    digitos = ''.join(c for c in (telefono or '') if c.isdigit())
    if not digitos:
        return None
    numero = digitos if digitos.startswith('54') else f'54{digitos}'
    return f'https://wa.me/{numero}?text={quote(mensaje)}'


def get_recordatorio(evento_id):
    """Devuelve los datos necesarios para enviar el recordatorio de un evento."""
    evento = Evento.objects.select_related('cliente', 'tipo_evento').get(id=evento_id)
    mensaje = build_mensaje_recordatorio(evento)
    telefono = evento.cliente.telefono if evento.cliente else None
    return {
        'mensaje': mensaje,
        'telefono': telefono,
        'whatsapp_url': build_whatsapp_url(telefono, mensaje),
        'recordatorio_enviado': evento.recordatorio_enviado,
    }


def marcar_recordatorio_enviado(evento_id):
    """Sella el evento con la fecha/hora actual de envío del recordatorio."""
    evento = Evento.objects.get(id=evento_id)
    evento.recordatorio_enviado = timezone.now()
    evento.save(update_fields=['recordatorio_enviado'])
    return evento.recordatorio_enviado
