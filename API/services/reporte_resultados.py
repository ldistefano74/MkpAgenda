"""
Service del informe de resultados: agrupa por mes/año los ingresos, costos y
pagos, calculando el resultado neto del período.

Semántica de filtros (un filtro ausente = "todos"):
- fecha_desde / fecha_hasta: acotan el rango (inclusive).

Composición de cada columna:
- Ingresos: cobros (MovimientoCuenta 'I'), imputados a un evento o no.
- Costos: costos (modelo Costo) + egresos (MovimientoCuenta 'E') sin
  prestador asociado.
- Pagos: egresos (MovimientoCuenta 'E') con prestador asociado.
- Resultado: Ingresos - Costos - Pagos.
"""
from decimal import Decimal

from API.querysets.reporte_resultados import (
    costos_por_mes_qs,
    detalle_costos_movimientos_qs,
    detalle_costos_qs,
    detalle_ingresos_qs,
    detalle_pagos_qs,
    ingresos_por_mes_qs,
    movimientos_egreso_sin_prestador_por_mes_qs,
    pagos_por_mes_qs,
)


def get_resultados_report(fecha_desde=None, fecha_hasta=None):
    periodos = {}

    def _acumular(rows, campo):
        for row in rows:
            key = row['mes'].strftime('%Y-%m-01')
            periodo = periodos.setdefault(key, {'ingresos': Decimal('0'), 'costos': Decimal('0'), 'pagos': Decimal('0')})
            periodo[campo] += row['total'] or Decimal('0')

    _acumular(ingresos_por_mes_qs(fecha_desde, fecha_hasta), 'ingresos')
    _acumular(costos_por_mes_qs(fecha_desde, fecha_hasta), 'costos')
    _acumular(movimientos_egreso_sin_prestador_por_mes_qs(fecha_desde, fecha_hasta), 'costos')
    _acumular(pagos_por_mes_qs(fecha_desde, fecha_hasta), 'pagos')

    rows = []
    for periodo, totales in sorted(periodos.items()):
        resultado = totales['ingresos'] - totales['costos'] - totales['pagos']
        rows.append({
            'periodo': periodo[:7],
            'ingresos': str(totales['ingresos']),
            'costos': str(totales['costos']),
            'pagos': str(totales['pagos']),
            'resultado': str(resultado),
        })
    return rows


def get_resultados_detalle(periodo, tipo):
    """
    Detalle de movimientos que componen una de las 3 categorías (ingresos,
    costos, pagos) de un período puntual ("YYYY-MM"). Usado por el drilldown
    del informe de resultados.
    """
    anio, mes = (int(p) for p in periodo.split('-'))

    if tipo == 'ingresos':
        rows = [
            {
                'id': m['id'],
                'origen': 'movimiento',
                'fecha': m['fecha'].isoformat(),
                'concepto': m['concepto'],
                'medio_pago_cobro_nombre': m['medio_pago_cobro__descripcion'],
                'importe': str(m['importe']),
                'evento_id': m['evento_id'],
            }
            for m in detalle_ingresos_qs(anio, mes)
        ]
    elif tipo == 'pagos':
        rows = [
            {
                'id': m['id'],
                'origen': 'movimiento',
                'fecha': m['fecha'].isoformat(),
                'concepto': f"({m['prestador__nombre']}) {m['concepto']}",
                'medio_pago_cobro_nombre': m['medio_pago_cobro__descripcion'],
                'importe': str(m['importe']),
                'evento_id': m['evento_id'],
            }
            for m in detalle_pagos_qs(anio, mes)
        ]
    elif tipo == 'costos':
        rows = [
            {
                'id': m['id'],
                'origen': 'movimiento',
                'fecha': m['fecha'].isoformat(),
                'concepto': m['concepto'],
                'medio_pago_cobro_nombre': m['medio_pago_cobro__descripcion'],
                'importe': str(m['importe']),
                'evento_id': m['evento_id'],
            }
            for m in detalle_costos_movimientos_qs(anio, mes)
        ] + [
            {
                'id': c['id'],
                'origen': 'costo',
                'fecha': c['fecha'].isoformat(),
                'concepto': c['descripcion'],
                'medio_pago_cobro_nombre': c['medio_pago__descripcion'],
                'importe': str(c['importe']),
                'evento_id': c['evento_id'],
            }
            for c in detalle_costos_qs(anio, mes)
        ]
    else:
        raise ValueError(f"Tipo de detalle inválido: {tipo!r}")

    rows.sort(key=lambda r: (r['fecha'], r['origen'], r['id']))
    return rows
