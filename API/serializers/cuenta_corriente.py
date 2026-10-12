from rest_framework import serializers
from ..models import VmCuentaCorriente
from .base import BaseModelSerializer


class CuentaCorrienteSerializer(BaseModelSerializer):
    """Serializer read-only para la vista de cuenta corriente"""
    medio_pago_cobro = serializers.StringRelatedField(allow_null=True)
    medio_pago_cobro_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = VmCuentaCorriente
        fields = '__all__'
        read_only_fields = [f.name for f in VmCuentaCorriente._meta.get_fields()]
