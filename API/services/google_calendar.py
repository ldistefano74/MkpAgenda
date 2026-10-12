import logging
from datetime import timedelta
from django.db.models import Q
from google.auth import default
from google.auth.exceptions import DefaultCredentialsError
from googleapiclient.discovery import build
from API.models import Evento
from API.config import get_config, GOOGLE_CALENDAR_ID

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/calendar']


def get_calendar_service():
    try:
        credentials, _ = default(scopes=SCOPES)
        return build('calendar', 'v3', credentials=credentials)
    except DefaultCredentialsError:
        logger.error('Google ADC no configurado — sincronización con Calendar deshabilitada')
        return None


def _build_event_body(evento):
    estado_label = dict(evento.ESTADOS_EVENTO).get(evento.estado, evento.estado)
    duracion = evento.duracion or timedelta(hours=1)
    end_dt = evento.fecha + duracion
    body = {
        'summary': f'{evento.tipo_evento.nombre} - {evento.cliente} ({estado_label})',
        'start': {'dateTime': evento.fecha.isoformat(), 'timeZone': 'America/Buenos_Aires'},
        'end': {'dateTime': end_dt.isoformat(), 'timeZone': 'America/Buenos_Aires'},
    }
    if evento.direccion_servicios:
        body['location'] = evento.direccion_servicios
    if evento.observaciones:
        body['description'] = evento.observaciones
    return body


def _get_service_and_calendar():
    """Retorna (service, calendar_id) o (None, None) si falta configuración."""
    calendar_id = get_config(GOOGLE_CALENDAR_ID)
    if not calendar_id:
        return None, None
    service = get_calendar_service()
    if not service:
        return None, None
    return service, calendar_id


def _get_comparable_fields(evento):
    """Extrae todos los campos relevantes para Google Calendar en un dict comparable."""
    return {
        'tipo_evento_id': evento.tipo_evento_id,
        'cliente_id': evento.cliente_id,
        'estado': evento.estado,
        'fecha': evento.fecha,
        'duracion': evento.duracion,
        'direccion_servicios': evento.direccion_servicios,
        'observaciones': evento.observaciones,
    }


def _has_gcal_fields_changed(current_evento, saved_evento):
    """Compara si algún campo relevante para GCal cambió entre saved y current."""
    print('Comparando eventos para GCal:')
    print('Saved:', _get_comparable_fields(saved_evento))
    print('Current:', _get_comparable_fields(current_evento))
    return _get_comparable_fields(current_evento) != _get_comparable_fields(saved_evento)


def sync_evento(evento, saved_evento=None):
    """Crea o actualiza el evento en Google Calendar. Retorna None si ok, mensaje de error si falla.
    saved_evento: estado del evento antes del update (para comparar cambios); si no se provee se lee de BD."""
    if evento.estado == 'X':
        return delete_evento(evento)

    service, calendar_id = _get_service_and_calendar()
    if not service:
        msg = 'Google Calendar no configurado'
        logger.error('Evento %s: %s', evento.pk, msg)
        return msg

    # Si el evento ya existe en GCal, verificar si cambió algo relevante
    if evento.google_calendar_event_id and evento.pk:
        try:
            pre_save = saved_evento or Evento.objects.get(pk=evento.pk)
            if not _has_gcal_fields_changed(evento, pre_save):
                logger.debug('Evento %s: sin cambios relevantes, no sincronizar', evento.pk)
                return None
        except Evento.DoesNotExist:
            pass

    body = _build_event_body(evento)
    try:
        if evento.google_calendar_event_id:
            service.events().update(
                calendarId=calendar_id,
                eventId=evento.google_calendar_event_id,
                body=body,
            ).execute()
        else:
            result = service.events().insert(calendarId=calendar_id, body=body).execute()
            type(evento).objects.filter(pk=evento.pk).update(google_calendar_event_id=result['id'])
            evento.google_calendar_event_id = result['id']
        return None
    except Exception as e:
        logger.exception('Error sincronizando evento %s con Google Calendar', evento.pk)
        return str(e)


def _pendientes_queryset():
    """Eventos que requieren acción en GCal:
    (a) no cancelados sin google_calendar_event_id → crear
    (b) cancelados con google_calendar_event_id → borrar"""
    return Evento.objects.filter(
        Q(google_calendar_event_id__isnull=True) & ~Q(estado='X')
        | Q(google_calendar_event_id__isnull=False) & Q(estado='X')
    )


def sync_pendientes():
    """Sincroniza eventos pendientes (creación o borrado).
    Retorna (synced: int, errors: list[{id, error}])."""
    synced = 0
    errors = []
    for evento in _pendientes_queryset():
        error = sync_evento(evento)
        if error:
            errors.append({'id': evento.pk, 'error': error})
        else:
            synced += 1
    return synced, errors


def contar_pendientes():
    """Retorna la cantidad de eventos pendientes (creación o borrado)."""
    return _pendientes_queryset().count()


def delete_evento(evento):
    """Elimina el evento de Google Calendar y limpia el id en BD.
    Retorna None si ok, mensaje de error si falla."""
    if not evento.google_calendar_event_id:
        return None
    service, calendar_id = _get_service_and_calendar()
    if not service:
        msg = 'Google Calendar no configurado'
        logger.error('Evento %s: %s', evento.pk, msg)
        return msg
    try:
        service.events().delete(
            calendarId=calendar_id,
            eventId=evento.google_calendar_event_id,
        ).execute()
        type(evento).objects.filter(pk=evento.pk).update(google_calendar_event_id=None)
        evento.google_calendar_event_id = None
        return None
    except Exception as e:
        logger.exception('Error eliminando evento %s de Google Calendar', evento.pk)
        return str(e)
