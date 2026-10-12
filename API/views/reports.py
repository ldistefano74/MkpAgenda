from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from API.services.presupuesto import generate_presupuesto_pdf
from API.services.reporte_movimientos import get_movimientos_report
from API.services.reporte_resultados import get_resultados_detalle, get_resultados_report


@api_view(['GET'])
def movimientos(request):
    params = request.query_params
    data = get_movimientos_report(
        fecha_desde=params.get('fecha_desde') or None,
        fecha_hasta=params.get('fecha_hasta') or None,
        tipo=params.get('tipo') or None,
        medio_pago_cobro=params.get('medio_pago_cobro') or None,
    )
    return Response(data)


@api_view(['GET'])
def resultados(request):
    params = request.query_params
    data = get_resultados_report(
        fecha_desde=params.get('fecha_desde') or None,
        fecha_hasta=params.get('fecha_hasta') or None,
    )
    return Response(data)


@api_view(['GET'])
def resultados_detalle(request):
    params = request.query_params
    periodo = params.get('periodo')
    tipo = params.get('tipo')
    if not periodo or tipo not in ('ingresos', 'costos', 'pagos'):
        return Response({'error': 'Parámetros periodo/tipo inválidos'}, status=400)
    data = get_resultados_detalle(periodo, tipo)
    return Response(data)


@api_view(['GET'])
def presupuesto(request, evento_id):
    try:
        pdf_bytes = generate_presupuesto_pdf(evento_id)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="presupuesto_{evento_id}.pdf"'
    return response
