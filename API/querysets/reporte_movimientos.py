"""
Querysets para el informe de movimientos (cobros, pagos y costos).

Cada función devuelve los `.values()` normalizados de su fuente, aplicando los
filtros recibidos. La unificación y el orden final se resuelven en el service.
"""
from API.models import Costo, MovimientoCuenta


def movimientos_qs(fecha_desde=None, fecha_hasta=None, tipo=None, medio_pago_cobro=None):
    """Movimientos de cuenta (cobros 'I' y pagos 'E')."""
    qs = MovimientoCuenta.objects.all()
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    if tipo:
        qs = qs.filter(tipo=tipo)
    if medio_pago_cobro:
        qs = qs.filter(medio_pago_cobro_id=medio_pago_cobro)
    return qs.values(
        'id', 'fecha', 'tipo', 'concepto', 'importe', 'medio_pago_cobro__descripcion',
        'evento_id',
    )


def costos_qs(fecha_desde=None, fecha_hasta=None, medio_pago_cobro=None):
    """Costos individuales."""
    qs = Costo.objects.all()
    if fecha_desde:
        qs = qs.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha__lte=fecha_hasta)
    if medio_pago_cobro:
        qs = qs.filter(medio_pago_id=medio_pago_cobro)
    return qs.values(
        'id', 'fecha', 'descripcion', 'importe', 'medio_pago__descripcion',
    )
