"""
Helpers simples para crear las entidades base de los tests.

No se usa factory_boy: son funciones que arman objetos con los mínimos campos
requeridos y aceptan overrides por kwargs. Los campos únicos (teléfono de
Cliente) se autoincrementan con un contador de módulo para que cada llamada
genere un valor distinto.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from itertools import count

from django.utils import timezone

from API.models import (
    CategoriaCosto,
    Cliente,
    Configuracion,
    Costo,
    CostoRecurrente,
    CuotaCosto,
    Evento,
    FuenteContacto,
    MedioPagoCobro,
    MovimientoCuenta,
    PreciosServicio,
    Prestador,
    Proveedor,
    RedSocial,
    Servicio,
    ServicioEvento,
    ServiciosPrestador,
    TiposEvento,
)

_secuencia = count(1)


def _siguiente():
    return next(_secuencia)


def telefono():
    """Devuelve un teléfono único (Cliente.telefono tiene UniqueConstraint)."""
    return f"11{_siguiente():08d}"


def fecha_aware(anio=2026, mes=8, dia=1, hora=15, minuto=0):
    """DateTime con timezone, para el campo `fecha` de Evento."""
    return timezone.make_aware(datetime(anio, mes, dia, hora, minuto))


# --- Personas -------------------------------------------------------------

def cliente(**kwargs):
    kwargs.setdefault('nombre', f"Cliente {_siguiente()}")
    kwargs.setdefault('telefono', telefono())
    return Cliente.objects.create(**kwargs)


def prestador(**kwargs):
    kwargs.setdefault('nombre', f"Prestador {_siguiente()}")
    kwargs.setdefault('telefono', telefono())
    return Prestador.objects.create(**kwargs)


def proveedor(**kwargs):
    kwargs.setdefault('nombre', f"Proveedor {_siguiente()}")
    kwargs.setdefault('telefono', telefono())
    return Proveedor.objects.create(**kwargs)


def red_social(**kwargs):
    kwargs.setdefault('nombre', f"Red {_siguiente()}")
    return RedSocial.objects.create(**kwargs)


def fuente_contacto(**kwargs):
    kwargs.setdefault('descripcion', f"Fuente {_siguiente()}")
    return FuenteContacto.objects.create(**kwargs)


# --- Catálogos ------------------------------------------------------------

def tipo_evento(**kwargs):
    kwargs.setdefault('nombre', f"Tipo {_siguiente()}")
    return TiposEvento.objects.create(**kwargs)


def servicio(**kwargs):
    kwargs.setdefault('nombre', f"Servicio {_siguiente()}")
    return Servicio.objects.create(**kwargs)


def precio_servicio(servicio_obj, tipo_evento_obj, precio):
    return PreciosServicio.objects.create(
        servicio=servicio_obj, tipo_evento=tipo_evento_obj, precio=Decimal(precio)
    )


def servicio_prestador(prestador_obj, servicio_obj, tipo_evento_obj=None, precio_referencia=None):
    return ServiciosPrestador.objects.create(
        prestador=prestador_obj,
        servicio=servicio_obj,
        tipo_evento=tipo_evento_obj,
        precio_referencia=None if precio_referencia is None else Decimal(precio_referencia),
    )


def medio_pago(**kwargs):
    kwargs.setdefault('descripcion', f"Medio {_siguiente()}")
    return MedioPagoCobro.objects.create(**kwargs)


def configuracion(clave, valor):
    return Configuracion.objects.create(clave=clave, valor=valor)


# --- Eventos --------------------------------------------------------------

def evento(cliente_obj=None, tipo_evento_obj=None, **kwargs):
    kwargs.setdefault('cliente', cliente_obj or cliente())
    kwargs.setdefault('tipo_evento', tipo_evento_obj or tipo_evento())
    kwargs.setdefault('fecha', fecha_aware())
    return Evento.objects.create(**kwargs)


def servicio_evento(evento_obj, servicio_obj=None, **kwargs):
    kwargs.setdefault('servicio', servicio_obj or servicio())
    if 'importe' in kwargs:
        kwargs['importe'] = Decimal(kwargs['importe'])
    if kwargs.get('importe_prestador') is not None:
        kwargs['importe_prestador'] = Decimal(kwargs['importe_prestador'])
    return ServicioEvento.objects.create(evento=evento_obj, **kwargs)


# --- Movimientos ----------------------------------------------------------

def movimiento(tipo='I', importe='1000.00', fecha=None, **kwargs):
    """
    Movimiento de cuenta. Recordar el CheckConstraint: exactamente uno de
    `cliente` / `prestador` debe estar seteado.
    """
    kwargs.setdefault('concepto', f"Movimiento {_siguiente()}")
    return MovimientoCuenta.objects.create(
        tipo=tipo,
        importe=Decimal(importe),
        fecha=fecha or date(2026, 8, 1),
        **kwargs,
    )


# --- Costos ---------------------------------------------------------------

def categoria_costo(**kwargs):
    kwargs.setdefault('nombre', f"Categoría {_siguiente()}")
    return CategoriaCosto.objects.create(**kwargs)


def costo_recurrente(categoria=None, **kwargs):
    kwargs.setdefault('nombre', f"Recurrente {_siguiente()}")
    kwargs.setdefault('recurrencia', 'M')
    kwargs.setdefault('categoria_costo', categoria or categoria_costo())
    return CostoRecurrente.objects.create(**kwargs)


def costo(categoria=None, **kwargs):
    kwargs.setdefault('categoria_costo', categoria or categoria_costo())
    kwargs.setdefault('descripcion', f"Costo {_siguiente()}")
    kwargs.setdefault('fecha', date(2026, 8, 1))
    kwargs['importe'] = Decimal(kwargs.get('importe', '1000.00'))
    return Costo.objects.create(**kwargs)


def cuota(costo_obj, numero_cuota=1, fecha_vencimiento=None, importe='500.00', pagada=False):
    return CuotaCosto.objects.create(
        costo=costo_obj,
        numero_cuota=numero_cuota,
        fecha_vencimiento=fecha_vencimiento or (date.today() + timedelta(days=1)),
        importe=Decimal(importe),
        pagada=pagada,
    )
