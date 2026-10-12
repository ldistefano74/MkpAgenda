"""
Vista de dashboard: devuelve cobros y pagos pendientes agrupados por mes.
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from API.models import CuotaCosto
from API.services.cuotas import get_cuotas_pendientes, preparar_pago
from API.services.dashboard import get_cobros_pagos, get_costos_recurrentes_status, parse_ventana


@api_view(['GET'])
def dashboard(request):
    return Response(get_cobros_pagos())


@api_view(['GET'])
def dashboard_cuotas_pendientes(request):
    ventana_param = request.query_params.get('ventana', 'fin_de_mes')
    _, ventana_end = parse_ventana(ventana_param)

    rows = list(get_cuotas_pendientes(ventana_end))
    result = [
        {
            'id': r['id'],
            'fecha_vencimiento': r['fecha_vencimiento'].isoformat(),
            'numero_cuota': r['numero_cuota'],
            'cantidad_cuotas': r['costo__cantidad_cuotas'],
            'importe': str(r['importe']),
            'descripcion': r['costo__descripcion'],
            'categoria_costo_nombre': r['costo__categoria_costo__nombre'],
            'costo_id': r['costo_id'],
        }
        for r in rows
    ]
    return Response(result)


@api_view(['POST'])
def marcar_cuota_pagada(request, pk):
    try:
        cuota = preparar_pago(pk)
    except CuotaCosto.DoesNotExist:
        return Response({'detail': 'Cuota no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    cuota.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def dashboard_costos_recurrentes(request):
    ventana_param = request.query_params.get('ventana', 'fin_de_mes')
    today, ventana_end = parse_ventana(ventana_param)
    return Response(get_costos_recurrentes_status(today, ventana_end))
