from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from API.lookups import resolve_lookup, LookupNotFound


@api_view(['GET'])
def lookup(request, name):
    """Vista para resolver lookups por nombre."""
    try:
        data = resolve_lookup(name, request.query_params)
        return Response(data)
    except LookupNotFound as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
