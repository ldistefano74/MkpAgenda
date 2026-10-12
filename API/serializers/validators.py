from rest_framework import serializers
from django.core.exceptions import ValidationError
from ..models import *

def model_validator(model, data, instance=None):
    new_instance = model()
    # Si se está actualizando, asignar el PK para que validate_unique()
    # excluya el registro actual de la verificación de unicidad.
    if instance and instance.pk:
        new_instance.pk = instance.pk
        new_instance._state.adding = False
    excluded_fields = []

    # Aplicar attrs sobre la instancia y detectar campos ausentes
    for field in model._meta.get_fields():
        if not getattr(field, 'concrete', False):
            continue

        if field.primary_key:
            # Nunca validar unicidad del PK en una instancia nueva (evita falsos positivos al editar)
            excluded_fields.append(field.name)
        elif field.name in data:
            setattr(new_instance, field.name, data[field.name])
        else:
            # Campo no presente en data (ej: excluido en serializer anidado)
            excluded_fields.append(field.name)

    try:
        new_instance.full_clean(exclude=excluded_fields)
    except ValidationError as e:
        raise serializers.ValidationError(e.message_dict)
