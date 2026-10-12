import calendar
from datetime import date, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta

from API.models import Costo, CostoRecurrente
from API.querysets.dashboard import cobros_pendientes_qs, pagos_pendientes_qs

_RECURRENCIA_DELTA = {
    'S': timedelta(days=7),
    'Q': timedelta(days=15),
    'M': relativedelta(months=1),
    'B': relativedelta(months=2),
    'T': relativedelta(months=3),
    '6': relativedelta(months=6),
    'A': relativedelta(months=12),
}


def month_buckets(n=6):
    today = date.today()
    buckets = []
    for i in range(n):
        total_months = today.month - 1 + i
        year = today.year + total_months // 12
        month = total_months % 12 + 1
        _, last_day = calendar.monthrange(year, month)
        buckets.append({
            'mes': f"{year:04d}-{month:02d}",
            'start': date(year, month, 1),
            'end': date(year, month, last_day),
        })
    return buckets


def parse_ventana(ventana_param):
    today = date.today()
    if ventana_param == '30_dias':
        return today, today + timedelta(days=30)
    _, last_day = calendar.monthrange(today.year, today.month)
    return today, date(today.year, today.month, last_day)


def _bucket_pendientes(rows, today, buckets, fecha_key, detalle_fn):
    """Acumula el 'pendiente' de cada fila en vencidos o en el bucket de mes que
    corresponda a su fecha, adjuntando el detalle (evento/servicio) de cada fila."""
    vencidos_total = Decimal('0')
    vencidos_detalle = []
    forecast = [{'mes': b['mes'], 'total': Decimal('0'), 'detalle': []} for b in buckets]

    for row in rows:
        row_date = row[fecha_key].date()
        detalle = detalle_fn(row)
        if row_date < today:
            vencidos_total += row['pendiente']
            vencidos_detalle.append(detalle)
        else:
            for i, b in enumerate(buckets):
                if b['start'] <= row_date <= b['end']:
                    forecast[i]['total'] += row['pendiente']
                    forecast[i]['detalle'].append(detalle)
                    break

    return vencidos_total, vencidos_detalle, forecast


def _detalle_cobro(row):
    return {
        'evento_id': row['evento_id'],
        'fecha': row['evento__fecha'].date().isoformat(),
        'cliente_nombre': row['cliente__nombre'],
        'tipo_evento_nombre': row['evento__tipo_evento__nombre'],
        'pendiente': row['pendiente'],
    }


def _detalle_pago(row):
    return {
        'servicio_evento_id': row['servicio_evento_id'],
        'evento_id': row['evento_id'],
        'fecha': row['evento__fecha'].date().isoformat(),
        'servicio_nombre': row['servicio_evento__servicio__nombre'],
        'cliente_nombre': row['evento__cliente__nombre'],
        'pendiente': row['pendiente'],
    }


def get_cobros_pagos():
    today = date.today()
    buckets = month_buckets(6)

    vencidos_cobros, vencidos_cobros_detalle, forecast_cobros = _bucket_pendientes(
        cobros_pendientes_qs(), today, buckets, 'evento__fecha', _detalle_cobro,
    )

    filas_por_prestador = {}
    for row in pagos_pendientes_qs():
        pid = row['prestador_id']
        filas_por_prestador.setdefault(pid, {'nombre': row['prestador__nombre'], 'rows': []})
        filas_por_prestador[pid]['rows'].append(row)

    pagos = []
    for pid, data in filas_por_prestador.items():
        vencidos, vencidos_detalle, forecast = _bucket_pendientes(
            data['rows'], today, buckets, 'evento__fecha', _detalle_pago,
        )
        pagos.append({
            'prestador_id': pid,
            'prestador_nombre': data['nombre'],
            'vencidos': vencidos,
            'vencidos_detalle': vencidos_detalle,
            'forecast': forecast,
        })

    return {
        'cobros': {
            'vencidos': vencidos_cobros,
            'vencidos_detalle': vencidos_cobros_detalle,
            'forecast': forecast_cobros,
        },
        'pagos': pagos,
    }


def get_costos_recurrentes_status(today, ventana_end):
    # Para cada costo recurrente activo, buscamos el último costo asociado. Con esa fecha, calculamos la próxima fecha y determinamos si está vencido o por vencer.
    # TODO: En la UI se muestran todos juntos, asi que esto podría simplificarse a una sola consulta, pero lo dejo así por si sirve a futuros desarrollos.
    recurrentes = list(
        CostoRecurrente.objects
        .filter(activo=True)
        .select_related('categoria_costo')
        .order_by('nombre')
    )

    if not recurrentes:
        return {'vencidos': [], 'por_vencer': []}

    costs_qs = (
        Costo.objects
        .filter(costo_recurrente__in=[cr.id for cr in recurrentes])
        .values('costo_recurrente_id', 'fecha', 'categoria_costo_id', 'importe', 'cantidad_cuotas', 'medio_pago_id', 'proveedor_id', 'descripcion')
        .order_by('costo_recurrente_id', '-fecha')
    )
    last_cost_map = {}
    for cost in costs_qs:
        cr_id = cost['costo_recurrente_id']
        if cr_id not in last_cost_map:
            last_cost_map[cr_id] = cost

    vencidos = []
    por_vencer = []

    for cr in recurrentes:
        last = last_cost_map.get(cr.id)
        delta = _RECURRENCIA_DELTA[cr.recurrencia]

        base = {
            'id': cr.id,
            'nombre': cr.nombre,
            'recurrencia': cr.get_recurrencia_display(),
            'categoria_costo_nombre': cr.categoria_costo.nombre,
            'fill_costo_recurrente': cr.id,
            'fill_categoria_costo': None,
            'fill_importe': None,
            'fill_cantidad_cuotas': None,
            'fill_medio_pago': None,
            'fill_proveedor': None,
            'fill_descripcion': None,
        }

        if last is None:
            base.update({
                'ultima_fecha': None,
                'proxima_fecha': None,
                'fill_categoria_costo': cr.categoria_costo_id,
                'fill_proveedor': cr.proveedor_id,
            })
            vencidos.append(base)
        else:
            ultima_fecha = last['fecha']
            proxima_fecha = ultima_fecha + delta
            base.update({
                'ultima_fecha': ultima_fecha.isoformat(),
                'proxima_fecha': proxima_fecha.isoformat(),
                'fill_categoria_costo': last['categoria_costo_id'],
                'fill_importe': str(last['importe']) if last['importe'] is not None else None,
                'fill_cantidad_cuotas': last['cantidad_cuotas'],
                'fill_medio_pago': last['medio_pago_id'],
                'fill_proveedor': last['proveedor_id'],
                'fill_descripcion': last['descripcion'],
            })
            if proxima_fecha < today:
                vencidos.append(base)
            elif proxima_fecha <= ventana_end:
                por_vencer.append(base)

    return {'vencidos': vencidos, 'por_vencer': por_vencer}
