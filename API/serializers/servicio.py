from rest_framework import serializers
from django.db import transaction
from ..models import Servicio, PreciosServicio
from .base import BaseModelSerializer


class PrecioServicioSerializer(BaseModelSerializer):
    tipo_evento_nombre = serializers.CharField(read_only=True, source='tipo_evento.nombre')

    class Meta:
        model = PreciosServicio
        exclude = ['servicio']


class ServicioDetailSerializer(BaseModelSerializer):
    precios = PrecioServicioSerializer(many=True, required=False)

    class Meta:
        model = Servicio
        fields = '__all__'

    def create(self, validated_data):
        precios_data = validated_data.pop('precios', [])
        with transaction.atomic():
            instance = Servicio.objects.create(**validated_data)
            for item in precios_data:
                PreciosServicio.objects.create(servicio=instance, **item)
        return instance

    def update(self, instance, validated_data):
        precios_data = validated_data.pop('precios', None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if precios_data is not None:
                instance.precios.all().delete()
                PreciosServicio.objects.bulk_create([
                    PreciosServicio(servicio=instance, **item)
                    for item in precios_data
                ])
        return instance
