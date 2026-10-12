from rest_framework import serializers
from ..models import MovimientoCuenta
from .base import BaseModelSerializer


class MovimientoCuentaSerializer(BaseModelSerializer):
    """Serializer para CRUD de movimientos manuales de cuenta corriente"""
    medio_pago_cobro_nombre = serializers.StringRelatedField(source='medio_pago_cobro', read_only=True, allow_null=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True, allow_null=True)
    prestador_nombre = serializers.CharField(source='prestador.nombre', read_only=True, allow_null=True)
    servicio_evento_nombre = serializers.CharField(source='servicio_evento.servicio.nombre', read_only=True, allow_null=True)

    class Meta:
        model = MovimientoCuenta
        fields = '__all__'

    def validate(self, data):
        data = super().validate(data)

        cliente = data.get('cliente')
        prestador = data.get('prestador')

        if (not cliente and not prestador) or (cliente and prestador):
            raise serializers.ValidationError(
                "Debe indicar un cliente o un prestador."
            )

        return data
