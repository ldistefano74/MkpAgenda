from collections import defaultdict

from django.db import IntegrityError
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    if isinstance(exc, (ProtectedError, RestrictedError)):
        counts = defaultdict(int)
        objects = exc.protected_objects if isinstance(exc, ProtectedError) else exc.restricted_objects
        for obj in objects:
            counts[obj._meta.verbose_name_plural or obj._meta.verbose_name] += 1
        parts = [f"{count} {name}" for name, count in counts.items()]
        detail = "No se puede eliminar porque tiene registros relacionados:\n" + "\n".join(f"- {p}" for p in parts)
        return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)

    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "No se puede eliminar porque el registro está en uso."},
            status=status.HTTP_409_CONFLICT,
        )

    return exception_handler(exc, context)
