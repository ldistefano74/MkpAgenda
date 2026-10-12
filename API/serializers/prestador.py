from rest_framework import serializers
from ..models import Prestador, ServiciosPrestador, Servicio
from django.db import transaction
from rest_framework.validators import UniqueTogetherValidator, UniqueValidator
from django.core.exceptions import ValidationError
from .validators import model_validator
from .base import BaseModelSerializer

class ServicioPrestadorSerializer(BaseModelSerializer):
    """Serializer para los servicios de un prestador con su precio específico"""
    servicio_nombre = serializers.CharField(read_only=True, source='servicio.nombre')
    tipo_evento_nombre = serializers.CharField(read_only=True, source='tipo_evento.nombre', default=None)

    class Meta:
        model = ServiciosPrestador
        exclude = ['prestador']
        
class PrestadorDetailSerializer(BaseModelSerializer):
    """Serializer detallado para Prestador que incluye sus servicios"""
    servicios_prestador = ServicioPrestadorSerializer(many=True, required=False)

    class Meta:
        model = Prestador
        fields = '__all__'
    
    def validate_servicios_prestador(self, value):
        seen = set()
        for item in value:
            tipo_evento_id = item['tipo_evento'].id if item.get('tipo_evento') else None
            key = (item['servicio'].id, tipo_evento_id)
            if key in seen:
                raise serializers.ValidationError(
                    "No se puede repetir la combinación de servicio y tipo de evento."
                )
            seen.add(key)
        return value

    def create(self, validated_data):
        servicios_data = validated_data.pop('servicios_prestador', [])
        
        with transaction.atomic():
            instance = Prestador.objects.create(**validated_data)
            
            # Crear relaciones con servicios
            for item in servicios_data:
                ServiciosPrestador.objects.create(prestador=instance, **item)
        
        return instance
    
    def update(self, instance, validated_data):
        servicios_data = validated_data.pop('servicios_prestador', None)
        
        with transaction.atomic():
            # Actualizar campos del prestador
            instance = super().update(instance, validated_data)
            
            # Eliminar servicios existentes
            instance.servicios_prestador.all().delete()
            
            # Crear nuevos servicios
            if servicios_data:
                ServiciosPrestador.objects.bulk_create([
                    ServiciosPrestador(prestador=instance, **item)
                    for item in servicios_data
                ])
        
        return instance

