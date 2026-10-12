from rest_framework import serializers
from ..models import Configuracion
from .serializer_factory import create_serializer


ConfiguracionSerializer = create_serializer(Configuracion)


class ConfiguracionBulkSerializer(serializers.Serializer):
    """
    Serializer para operaciones bulk de Configuracion.
    Recibe una lista de items, valida cada uno, y en save():
    - Elimina registros no incluidos en la lista
    - Crea o actualiza según corresponda
    """

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError({'non_field_errors': ['Se esperaba una lista']})

        results = []
        errors = {}
        has_errors = False
        for i, item in enumerate(data):
            item_id = item.get('id')
            if item_id:
                try:
                    instance = Configuracion.objects.get(id=item_id)
                except Configuracion.DoesNotExist:
                    has_errors = True
                    errors[i] = {'id': [f'No existe configuración con id {item_id}']}
                    continue
                child = ConfiguracionSerializer(instance, data=item, partial=True)
            else:
                child = ConfiguracionSerializer(data=item)

            if child.is_valid():
                results.append({'serializer': child, 'id': item_id})
            else:
                has_errors = True
                errors[i] = child.errors

        if has_errors:
            raise serializers.ValidationError(errors)

        return results

    def save(self, **kwargs):
        return self.create(self.validated_data)

    def create(self, validated_data):
        submitted_ids = {
            item['id'] for item in validated_data if item['id']
        }

        # Eliminar registros no incluidos en la lista enviada
        Configuracion.objects.exclude(id__in=submitted_ids).delete()

        return [item['serializer'].save() for item in validated_data]
