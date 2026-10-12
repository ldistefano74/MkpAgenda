from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from API.serializers import get_serializer_class
from API.serializers.base import BaseModelSerializer
from ..models import Prestador

@api_view(['GET'])
def serializer_new(request, serializer_name):
    """
    Devuelve el JSON de una nueva instancia vacía del serializer indicado,
    con los valores por defecto de cada campo.
    Ejemplo: GET /api/new/cliente/
    """
    try:
        serializer_class = get_serializer_class(serializer_name)

        if not serializer_class:
            return Response(
                {"error": f"Serializer '{serializer_name}' no encontrado."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Instanciar el serializer sin datos para obtener los defaults
        try:
            serializer_instance = serializer_class()
        except Exception as e:
            return Response(
                {"error": f"Error al instanciar serializer '{serializer_name}': {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Verificar que hereda de BaseModelSerializer
        if not isinstance(serializer_instance, BaseModelSerializer):
            return Response(
                {"error": f"El serializer '{serializer_name}' debe heredar de BaseModelSerializer."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(serializer_instance.get_new_instance())

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)