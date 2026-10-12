"""
Service del informe de movimientos: unifica cobros, pagos y costos en una sola
lista de filas ordenada por fecha, aplicando los filtros recibidos.

Semántica de filtros (un filtro ausente = "todos"):
- fecha_desde / fecha_hasta: acotan el rango (inclusive).
- tipo: 'I' (cobros), 'E' (pagos), 'C' (costos). Vacío = las tres fuentes.
- medio_pago_cobro: id de MedioPagoCobro.
"""
from API.querysets.reporte_movimientos import costos_qs, movimientos_qs

TIPO_DISPLAY = {'I': 'Cobro', 'E': 'Pago', 'C': 'Costo'}


def get_movimientos_report(fecha_desde=None, fecha_hasta=None, tipo=None, medio_pago_cobro=None):
    rows = []

    # Cobros y pagos (MovimientoCuenta). Se excluyen si el filtro pide solo costos.
    if tipo != 'C':
        movimiento_tipo = tipo if tipo in ('I', 'E') else None
        for m in movimientos_qs(fecha_desde, fecha_hasta, movimiento_tipo, medio_pago_cobro):
            rows.append({
                'id': m['id'],
                'origen': 'movimiento',
                'fecha': m['fecha'].isoformat(),
                'tipo': m['tipo'],
                'tipo_display': TIPO_DISPLAY.get(m['tipo'], m['tipo']),
                'concepto': m['concepto'],
                'medio_pago_cobro_nombre': m['medio_pago_cobro__descripcion'],
                'importe': str(m['importe']),
                'evento_id': m['evento_id'],
            })

    # Costos. Se incluyen solo si el filtro no acota a cobros/pagos.
    if tipo in (None, '', 'C'):
        for c in costos_qs(fecha_desde, fecha_hasta, medio_pago_cobro):
            rows.append({
                'id': c['id'],
                'origen': 'costo',
                'fecha': c['fecha'].isoformat(),
                'tipo': 'C',
                'tipo_display': TIPO_DISPLAY['C'],
                'concepto': c['descripcion'],
                'medio_pago_cobro_nombre': c['medio_pago__descripcion'],
                'importe': str(c['importe']),
            })

    # Orden por fecha; origen + id como desempate estable.
    rows.sort(key=lambda r: (r['fecha'], r['origen'], r['id']))
    return rows
