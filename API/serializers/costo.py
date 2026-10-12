from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from ..models import CostoRecurrente, Costo, CuotaCosto
from .base import BaseModelSerializer


class CostoRecurrenteListSerializer(BaseModelSerializer):
    """Serializer para la lista de costos recurrentes con nombres de relaciones"""
    categoria_costo_nombre = serializers.CharField(read_only=True, source='categoria_costo.nombre', label="Categoría de costo")
    proveedor_nombre = serializers.CharField(read_only=True, source='proveedor.nombre', label="Proveedor", allow_null=True)
    recurrencia_display = serializers.CharField(read_only=True, source='get_recurrencia_display', label="Recurrencia")

    class Meta:
        model = CostoRecurrente
        fields = ['id', 'nombre', 'categoria_costo_nombre', 'proveedor_nombre', 'recurrencia_display', 'activo']


class CostoListSerializer(BaseModelSerializer):
    """Serializer para la lista de costos con nombres de relaciones"""
    categoria_costo_nombre = serializers.CharField(read_only=True, source='categoria_costo.nombre', label="Categoría")
    medio_pago_nombre = serializers.CharField(read_only=True, source='medio_pago.descripcion', label="Medio de pago", allow_null=True)
    evento_display = serializers.CharField(read_only=True, source='evento', label="Evento", allow_null=True)
    proveedor_nombre = serializers.CharField(read_only=True, source='proveedor.nombre', label="Proveedor", allow_null=True)

    class Meta:
        model = Costo
        fields = [
            'id', 'fecha', 'categoria_costo_nombre', 'descripcion', 'importe',
            'medio_pago_nombre', 'evento_display', 'proveedor_nombre',
            # ids de las relaciones: necesarios para editar desde grillas embebidas (CostosTab)
            'categoria_costo', 'medio_pago', 'proveedor', 'evento',
        ]


class CuotaCostoSerializer(BaseModelSerializer):
    id = serializers.IntegerField(required=False, validators=[])

    class Meta:
        model = CuotaCosto
        exclude = ['costo']


class CostoDetailSerializer(BaseModelSerializer):
    """Serializer detallado para Costo que incluye sus cuotas"""
    cuotas = CuotaCostoSerializer(many=True, required=False)
    medio_pago_incluye_cuotas = serializers.BooleanField(
        read_only=True, source='medio_pago.incluye_cuotas', allow_null=True
    )

    class Meta:
        model = Costo
        fields = '__all__'

    def validate(self, data):
        data = super().validate(data)

        medio_pago = data.get('medio_pago') if 'medio_pago' in data else (
            self.instance.medio_pago if self.instance else None
        )
        importe = data.get('importe') if 'importe' in data else (
            self.instance.importe if self.instance else None
        )
        cuotas = data.get('cuotas', None)

        incluye = bool(medio_pago and getattr(medio_pago, 'incluye_cuotas', False))

        if incluye:
            # En creación o cuando se envían cuotas en update: debe haber al menos 1 y sumar = importe
            if cuotas is None and self.instance is None:
                raise serializers.ValidationError({
                    'cuotas': 'Debe especificar al menos una cuota para este medio de pago.'
                })
            if cuotas is not None:
                if len(cuotas) == 0:
                    raise serializers.ValidationError({
                        'cuotas': 'Debe especificar al menos una cuota.'
                    })
                total = sum((c.get('importe') or Decimal('0')) for c in cuotas)
                if importe is not None and Decimal(total) != Decimal(importe):
                    raise serializers.ValidationError({
                        'cuotas': f'La suma de las cuotas ({total}) debe ser igual al importe del costo ({importe}).'
                    })
        else:
            # Si el medio de pago no incluye cuotas, no se aceptan cuotas
            if cuotas:
                raise serializers.ValidationError({
                    'cuotas': 'El medio de pago seleccionado no permite cuotas.'
                })

        return data

    def create(self, validated_data):
        cuotas_data = validated_data.pop('cuotas', [])
        with transaction.atomic():
            instance = Costo.objects.create(**validated_data)
            for item in cuotas_data:
                item.pop('id', None)
                CuotaCosto.objects.create(costo=instance, **item)
        return instance

    def update(self, instance, validated_data):
        cuotas_data = validated_data.pop('cuotas', None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)

            # Si el medio de pago no incluye cuotas, limpiar cualquier cuota existente
            medio_pago = instance.medio_pago
            if not (medio_pago and medio_pago.incluye_cuotas):
                instance.cuotas.all().delete()
            elif cuotas_data is not None:
                incoming_ids = {item['id'] for item in cuotas_data if 'id' in item}
                existing_map = {c.id: c for c in instance.cuotas.all()}
                to_delete = set(existing_map.keys()) - incoming_ids
                if to_delete:
                    instance.cuotas.filter(id__in=to_delete).delete()

                for item in cuotas_data:
                    item_id = item.pop('id', None)
                    if item_id and item_id in existing_map:
                        CuotaCosto.objects.filter(id=item_id).update(**item)
                    else:
                        CuotaCosto.objects.create(costo=instance, **item)

        return instance
