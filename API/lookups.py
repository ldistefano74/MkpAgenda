"""
Módulo de lookups para la API.

Centraliza toda la lógica de lookups, incluyendo:
- Excepción personalizada para lookups no encontrados
- Función de lookup genérica con filtros dinámicos
- Registro de lookups disponibles (LOOKUP_SOURCES)
- Función principal de resolución (resolve_lookup)
"""

import datetime
from decimal import Decimal
from django.db import connection
from django.db.models import F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils.duration import duration_string
import API.models as models


def _serialize_extra_value(value):
    """Formatea valores de extra_fields para que el frontend los reciba en el formato esperado."""
    if isinstance(value, datetime.timedelta):
        return duration_string(value)
    return value


class LookupNotFound(Exception):
    """Excepción lanzada cuando se solicita un lookup que no existe."""
    pass


def normalize_query_value(value):
    """
    Normaliza valores de query params para uso en filtros Django.
    Convierte strings 'true'/'false' a booleanos Python.
    """
    normaliztion = {
        'true': True,
        'false': False
    } 
    return normaliztion.get(value.lower(), value)


def direcciones_frecuentes(limit=5, base=100, **kwargs):
    """
    Obtiene las direcciones más frecuentes de los últimos eventos.

    Args:
        limit: Cantidad de direcciones a devolver
        base: Cantidad de eventos recientes a considerar

    Returns:
        Lista de direcciones ordenadas por frecuencia de uso
    """    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT direccion_servicios
            FROM (
                SELECT direccion_servicios
                FROM eventos
                WHERE direccion_servicios IS NOT NULL AND direccion_servicios != ''
                ORDER BY id DESC
                LIMIT %s
            ) ultimos
            GROUP BY direccion_servicios
            ORDER BY COUNT(*) DESC
            LIMIT %s
        """, [base, limit])
        return [row[0] for row in cursor.fetchall()]


def model_lookup(model, filter_kwargs=None, query_filters=None, allowed_filters=None, extra_fields=None):
    """
    Lookup genérico con soporte para filtros dinámicos via query params.

    Args:
        model: Modelo Django a consultar
        filter_kwargs: Filtros base (siempre se aplican y tiene que estar definido en LOOKUP_SOURCES)
        query_filters: QueryDict con los filtros de la request (sin extra_fields)
        allowed_filters: Lista de campos permitidos para filtrar via query params
        extra_fields: Lista de campos adicionales a incluir en el resultado

    Returns:
        Lista de [label, id, ...extra_fields] para cada instancia
    """
    filter_kwargs = filter_kwargs or {}
    qs = model.objects.filter(**filter_kwargs)

    if query_filters and allowed_filters:
        for param in allowed_filters:
            value = query_filters.get(param)
            if value is not None:
                qs = qs.filter(**{param: normalize_query_value(value)})

    qs = qs.distinct()

    return [
        [str(item), item.id] + [_serialize_extra_value(getattr(item, f)) for f in (extra_fields or [])]
        for item in qs
    ]


def eventos_pendientes_cobro(query_filters=None, extra_fields=None, **kwargs):
    """
    Eventos con saldo pendiente de cobro para un cliente.

    El pendiente sale de vw_cuenta_corriente: la vista ya parte el cargo entre
    el cliente de cabecera y los clientes a cargo de cada servicio, así que
    filtrar por cliente_id alcanza para quedarse con lo que le corresponde a
    ese responsable. Se suma importe_signo (cargos +, cobros -).

    Como la vista sólo genera cargos de eventos confirmados, un evento
    Pendiente no aparece acá: para imputarle una seña hay que confirmarlo
    primero. Es deliberado -- si se pudiera cobrar sobre un evento pendiente,
    quedaría fácil olvidarse de confirmarlo y después no encontrarlo donde
    corresponde.

    Filtra por ?cliente=<id> (recomendado) y/o ?evento=<id>.
    Retorna [descripcion, id, pendiente] por evento con saldo > 0 para ese cliente.
    """
    cliente = query_filters.get('cliente') if query_filters else None
    evento = query_filters.get('evento') if query_filters else None

    saldo = models.VmCuentaCorriente.objects.filter(
        evento=OuterRef('pk'), cliente__isnull=False
    )
    if cliente:
        saldo = saldo.filter(cliente_id=cliente)
    saldo_subq = (
        saldo.values('evento').annotate(total=Sum('importe_signo')).values('total')
    )

    qs = (
        models.Evento.objects
        .select_related('tipo_evento')
        .annotate(pendiente=Coalesce(Subquery(saldo_subq), Value(Decimal('0'))))
        .filter(pendiente__gt=0)
    )

    if evento:
        qs = qs.filter(id=evento)

    return [[str(e), e.id, e.pendiente] for e in qs]


def servicios_pendientes_pago(query_filters=None, extra_fields=None, **kwargs):
    """
    Servicios evento con saldo pendiente de pago al prestador.

    El pendiente sale de vw_cuenta_corriente, igual que el de cobros: se suma
    importe_signo de las filas del servicio (cargo al prestador +, pagos -).

    Como la vista sólo emite el cargo de eventos confirmados, los servicios de
    un evento Pendiente o Cancelado no se ofrecen acá: para pagarle al
    prestador hay que confirmar el evento primero.

    Filtra opcionalmente por ?prestador=<id> y/o ?servicio_evento=<id>.

    Retorna [descripcion, id, pendiente] por cada servicio con saldo > 0.
    """
    saldo_subq = (
        models.VmCuentaCorriente.objects
        .filter(servicio_evento=OuterRef('pk'), prestador__isnull=False)
        .values('servicio_evento')
        .annotate(total=Sum('importe_signo'))
        .values('total')
    )

    qs = (
        models.ServicioEvento.objects
        .select_related('servicio', 'evento', 'evento__tipo_evento')
        .annotate(pendiente=Coalesce(Subquery(saldo_subq), Value(Decimal('0'))))
        .filter(pendiente__gt=0)
    )

    if query_filters:
        prestador = query_filters.get('prestador')
        servicio_evento = query_filters.get('servicio_evento')
        if prestador:
            qs = qs.filter(prestador_id=prestador)
        if servicio_evento:
            qs = qs.filter(id=servicio_evento)

    return [
        [
            (
                f"{se.servicio.nombre} en {se.evento.tipo_evento.nombre}"
                f" el {se.evento.fecha.strftime('%d/%m/%Y')}"
            ),
            se.id,
            se.pendiente,
        ]
        for se in qs
    ]


def costorecurrente_con_defaults(query_filters=None, extra_fields=None, **kwargs):
    """
    Retorna CostoRecurrentes activos con datos del último Costo registrado para cada uno.

    Esto permite al frontend pre-completar el formulario de Costo cuando el usuario
    selecciona un costo recurrente.

    Returns:
        Lista de [nombre, id, categoria_costo_id, importe, medio_pago_id, proveedor_id, descripcion]
        donde los últimos 5 campos provienen del Costo más reciente para ese CostoRecurrente.
    """
    from django.db.models import Subquery, OuterRef

    ultimo_costo = models.Costo.objects.filter(
        costo_recurrente=OuterRef('pk')
    ).order_by('-fecha', '-id')

    qs = models.CostoRecurrente.objects.annotate(
        ultimo_categoria_costo_id=Subquery(ultimo_costo.values('categoria_costo_id')[:1]),
        ultimo_importe=Subquery(ultimo_costo.values('importe')[:1]),
        ultimo_medio_pago_id=Subquery(ultimo_costo.values('medio_pago_id')[:1]),
        ultimo_proveedor_id=Subquery(ultimo_costo.values('proveedor_id')[:1]),
        ultima_descripcion=Subquery(ultimo_costo.values('descripcion')[:1]),
    )

    if query_filters:
        activo = query_filters.get('activo')
        if activo is not None:
            qs = qs.filter(activo=normalize_query_value(activo))
        categoria_costo = query_filters.get('categoria_costo')
        if categoria_costo is not None:
            qs = qs.filter(categoria_costo=categoria_costo)

    return [
        [
            str(cr), cr.id,
            cr.ultimo_categoria_costo_id,
            str(cr.ultimo_importe) if cr.ultimo_importe is not None else None,
            cr.ultimo_medio_pago_id,
            cr.ultimo_proveedor_id,
            cr.ultima_descripcion,
        ]
        for cr in qs
    ]


def precio_servicio_lookup(query_filters=None, extra_fields=None, **kwargs):
    """Retorna el precio resuelto para (servicio, tipo_evento) con fallback jerárquico."""
    from API.services.precios import get_precio_servicio
    servicio_id = query_filters.get('servicio') if query_filters else None
    tipo_evento_id = query_filters.get('tipo_evento') if query_filters else None
    if not servicio_id:
        return {"precio": None}
    precio = get_precio_servicio(servicio_id, tipo_evento_id or None)
    return {"precio": str(precio) if precio is not None else None}


def precio_prestador_lookup(query_filters=None, extra_fields=None, **kwargs):
    """Retorna el precio resuelto para (prestador, servicio, tipo_evento) con fallback jerárquico."""
    from API.services.precios import get_precio_prestador
    prestador_id = query_filters.get('prestador') if query_filters else None
    servicio_id = query_filters.get('servicio') if query_filters else None
    tipo_evento_id = query_filters.get('tipo_evento') if query_filters else None
    if not prestador_id or not servicio_id:
        return {"precio": None}
    precio = get_precio_prestador(prestador_id, servicio_id, tipo_evento_id or None)
    return {"precio": str(precio) if precio is not None else None}


LOOKUP_SOURCES = {
    "redsocial": {
        "action": model_lookup,
        "kwargs": {
            "model": models.RedSocial,
        }
    },
    "fuentecontacto": {
        "action": model_lookup,
        "kwargs": {
            "model": models.FuenteContacto,
            "allowed_filters": ["activo"],
        }
    },
    "mediopagocobro": {
        "action": model_lookup,
        "kwargs": {
            "model": models.MedioPagoCobro,
            "allowed_filters": ["disponible_cobro", "disponible_pago", "incluye_cuotas"],
        }
    },
    "cliente": {
        "action": model_lookup,
        "kwargs": {
            "model": models.Cliente,
            "allowed_filters" : [],
        }
    },
    "servicio": {
        "action": model_lookup,
        "kwargs": {
            "model": models.Servicio,
            "allowed_filters" : ["activo"],
        }
    },
    "tiposevento": {
        "action": model_lookup,
        "kwargs": {
            "model": models.TiposEvento,
            "allowed_filters" : ["activo"],
        }
    },
    "prestador": {
        "action": model_lookup,
        "kwargs": {
            "model": models.Prestador,
            "allowed_filters": ["activo","servicios_prestador__servicio"]
        }
    },
    "servicioprestador": {
        "action": model_lookup,
        "kwargs": {
            "model": models.ServiciosPrestador,
            "allowed_filters": ["prestador", "servicio", "tipo_evento"]
        }
    },
    "precioservicio": {
        "action": precio_servicio_lookup,
        "kwargs": {}
    },
    "precioprestador": {
        "action": precio_prestador_lookup,
        "kwargs": {}
    },
    "direccionesfrecuentes": {
        "action": direcciones_frecuentes,
        "kwargs": {
            "limit": 5
        }
    },
    "eventospendientescobro": {
        "action": eventos_pendientes_cobro,
        "kwargs": {}
    },
    "serviciospendientespago": {
        "action": servicios_pendientes_pago,
        "kwargs": {}
    },
    "proveedor": {
        "action": model_lookup,
        "kwargs": {
            "model": models.Proveedor,
            "allowed_filters": ["activo"],
        }
    },
    "categoriacosto": {
        "action": model_lookup,
        "kwargs": {
            "model": models.CategoriaCosto,
            "allowed_filters": ["activo", "tipo"],
        }
    },
    "evento": {
        "action": model_lookup,
        "kwargs": {
            "model": models.Evento,
            "allowed_filters": ["estado"],
        }
    },
    "costorecurrente": {
        "action": costorecurrente_con_defaults,
        "kwargs": {}
    },
}


def resolve_lookup(name, query_params=None):
    """
    Resuelve un lookup por nombre.

    Extrae de query_params:
        - extra_fields: campos adicionales a incluir en el resultado
        - resto de parámetros: se pasan como query_filters para filtrar

    Args:
        name: Nombre del lookup (ej: 'cliente', 'prestador')
        query_params: QueryDict de la request

    Returns:
        Lista de [label, id, ...extra_fields] para cada instancia

    Raises:
        LookupNotFound: Si el lookup solicitado no existe
    """
    if name not in LOOKUP_SOURCES:
        raise LookupNotFound(f"Lookup '{name}' no definido")

    cfg = LOOKUP_SOURCES[name]
    action = cfg["action"]
    kwargs = cfg.get("kwargs", {}).copy()
    kwargs["extra_fields"] = query_params.getlist("extra_fields") if query_params else None
    if query_params:
        query_filters = query_params.copy()
        query_filters.pop("extra_fields", None)
        kwargs["query_filters"] = query_filters
    else:
        kwargs["query_filters"] = None

    return action(**kwargs)
