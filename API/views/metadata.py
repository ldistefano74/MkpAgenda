from django.apps import apps
from API.serializers.base import BaseModelSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework import serializers as drf_serializers
import importlib
import inspect
from API.serializers.serializer_factory import create_serializer
from API.serializers import get_serializer_class
from django.views.decorators.cache import cache_page
from django.conf import settings


def conditional_cache(view_func):
    if settings.DEBUG:
        return view_func
    return cache_page(60 * 60)(view_func)


@conditional_cache
@api_view(['GET'])
def serializer_metadata(request, serializer_name):
    """
    Devuelve información de la estructura del serializer indicado.
    Parámetros query:
    - depth: nivel de profundidad para expandir serializers anidados (default=1).
    Ejemplo: GET /api/metadata/PrestadorDetailSerializer/?depth=1
    """
    metadata = None
    try:
        # Obtener depth de los parámetros de consulta
        depth = int(request.query_params.get('depth', '1'))
        
        serializer_class = get_serializer_class(serializer_name)

        if not serializer_class:
            return Response(
                {"error": f"Serializer '{serializer_name}' no encontrado y no se encontró modelo para generar uno."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Instanciar el serializer para usar métodos de instancia
        try:
            serializer_instance = serializer_class()
        except Exception as e:
            return Response(
                {"error": f"Error al instanciar serializer '{serializer_name}': {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Verificar si la instancia heredó de BaseModelSerializer
        if isinstance(serializer_instance, BaseModelSerializer):
            # Usar el método de instancia del serializer
            metadata = serializer_instance.get_metadata(depth=depth)
            
        else:
            # Fallback: construir metadata manualmente para serializers
            # que no heredan de BaseModelSerializer
            return Response(
                {"error": f"El serializer '{serializer_name}' debe heredar de BaseModelSerializer para soportar metadata."},
                status=status.HTTP_400_BAD_REQUEST
            )
            

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(metadata)