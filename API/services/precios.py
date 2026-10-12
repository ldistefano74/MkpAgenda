from django.db.models import F, Q

from API.models import PreciosServicio, Servicio, ServiciosPrestador


def get_precio_servicio(servicio_id, tipo_evento_id):
    """
    Resuelve el precio sugerido de un servicio dado un tipo de evento.
    1. PreciosServicio(servicio, tipo_evento)
    2. Servicio.precio_referencia
    """
    if tipo_evento_id:
        try:
            precio = PreciosServicio.objects.get(
                servicio_id=servicio_id,
                tipo_evento_id=tipo_evento_id,
            )
            return precio.precio
        except PreciosServicio.DoesNotExist:
            pass

    try:
        return Servicio.objects.values_list('precio_referencia', flat=True).get(id=servicio_id)
    except Servicio.DoesNotExist:
        return None


def get_precio_prestador(prestador_id, servicio_id, tipo_evento_id):
    """
    Resuelve el precio de referencia de un prestador para un servicio y tipo de evento.
    1. ServiciosPrestador(prestador, servicio, tipo_evento exacto)  — si tiene precio
    2. ServiciosPrestador(prestador, servicio, tipo_evento=null)    — si tiene precio
    3. None (sin fallback al precio del servicio)
    """
    qs = ServiciosPrestador.objects.filter(
        prestador_id=prestador_id,
        servicio_id=servicio_id,
    )

    sp = (
        qs
        .filter(
            Q(tipo_evento_id=tipo_evento_id) | Q(tipo_evento__isnull=True),
            precio_referencia__isnull=False,
        )
        .order_by(F('tipo_evento_id').asc(nulls_last=True))
        .first()
    )
    
    return sp.precio_referencia if sp else None
