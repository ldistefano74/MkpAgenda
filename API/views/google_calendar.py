from rest_framework.decorators import api_view
from rest_framework.response import Response
from API.services.google_calendar import (
    get_calendar_service,
    sync_pendientes,
    contar_pendientes,
)
from API.config import get_config, GOOGLE_CALENDAR_ID


@api_view(['GET'])
def health(request):
    calendar_id = get_config(GOOGLE_CALENDAR_ID)
    if not calendar_id:
        return Response({'ok': False, 'error': 'GOOGLE_CALENDAR_ID no configurado'})
    service = get_calendar_service()
    if not service:
        return Response({'ok': False, 'error': 'ADC no configurado'})
    try:
        result = service.calendars().get(calendarId=calendar_id).execute()
        return Response({'ok': True, 'calendar': result.get('summary'), 'timeZone': result.get('timeZone')})
    except Exception as e:
        return Response({'ok': False, 'error': str(e)})


@api_view(['GET'])
def status(request):
    return Response({'pending': contar_pendientes()})


@api_view(['POST'])
def sync(request):
    synced, errors = sync_pendientes()
    return Response({'synced': synced, 'errors': errors})
