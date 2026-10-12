"""
Querysets para el informe de resultados: agrupa ingresos, costos y pagos por
mes/año a partir de movimientos de cuenta y costos.
"""
from django.db.models import Sum
from django.db.models.functions import TruncMonth

from API.models import Costo, MovimientoCuenta


def ingresos_por_mes_qs(fecha_desde=None, fecha_hasta=None):
    """Cobros (MovimientoCuenta tipo 'I'), imputados a un evento o no."""
    qs = MovimientoCuenta.objects.filter(tipo='I')
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    return (
        qs.annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('importe'))
        .values('mes', 'total')
    )


def pagos_por_mes_qs(fecha_desde=None, fecha_hasta=None):
    """Pagos a prestadores (MovimientoCuenta tipo 'E' con prestador)."""
    qs = MovimientoCuenta.objects.filter(tipo='E', prestador__isnull=False)
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    return (
        qs.annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('importe'))
        .values('mes', 'total')
    )


def movimientos_egreso_sin_prestador_por_mes_qs(fecha_desde=None, fecha_hasta=None):
    """Egresos (MovimientoCuenta tipo 'E') sin prestador asociado: se tratan
    como costos generales, no como pago a un prestador."""
    qs = MovimientoCuenta.objects.filter(tipo='E', prestador__isnull=True)
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    return (
        qs.annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('importe'))
        .values('mes', 'total')
    )


def costos_por_mes_qs(fecha_desde=None, fecha_hasta=None):
    """Costos individuales (modelo Costo)."""
    qs = Costo.objects.all()
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    return (
        qs.annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('importe'))
        .values('mes', 'total')
    )


# --- Detalle de movimientos de un período puntual (usado por el drilldown) ---

def detalle_ingresos_qs(anio, mes):
    """Movimientos que componen los ingresos de un mes puntual."""
    return (
        MovimientoCuenta.objects
        .filter(tipo='I', fecha__year=anio, fecha__month=mes)
        .values('id', 'fecha', 'concepto', 'importe', 'medio_pago_cobro__descripcion', 'evento_id')
    )


def detalle_pagos_qs(anio, mes):
    """Movimientos que componen los pagos a prestadores de un mes puntual."""
    return (
        MovimientoCuenta.objects
        .filter(tipo='E', prestador__isnull=False, fecha__year=anio, fecha__month=mes)
        .values('id', 'fecha', 'concepto', 'importe', 'medio_pago_cobro__descripcion', 'evento_id', 'prestador__nombre')
    )


def detalle_costos_movimientos_qs(anio, mes):
    """Egresos sin prestador (tratados como costo) de un mes puntual."""
    return (
        MovimientoCuenta.objects
        .filter(tipo='E', prestador__isnull=True, fecha__year=anio, fecha__month=mes)
        .values('id', 'fecha', 'concepto', 'importe', 'medio_pago_cobro__descripcion', 'evento_id')
    )


def detalle_costos_qs(anio, mes):
    """Costos individuales de un mes puntual."""
    return (
        Costo.objects
        .filter(fecha__year=anio, fecha__month=mes)
        .values('id', 'fecha', 'descripcion', 'importe', 'medio_pago__descripcion', 'evento_id')
    )
