from .base import BaseQuerySet
from ..models import MovimientoCuenta, VmCuentaCorriente


class MovimientoCuentaQuerySet(BaseQuerySet):
    model = MovimientoCuenta

    def get_queryset(self, cliente=None, prestador=None, evento=None, tipo=None, **kwargs):
        qs = self.get_base_queryset().select_related("cliente", "prestador", "evento", "medio_pago_cobro", "servicio_evento__servicio")
        if cliente:
            qs = qs.filter(cliente_id=cliente)
        if prestador:
            qs = qs.filter(prestador_id=prestador)
        if evento:
            qs = qs.filter(evento_id=evento)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs


class CuentaCorrienteQuerySet(BaseQuerySet):
    model = VmCuentaCorriente

    def get_queryset(self, cliente=None, prestador=None, **kwargs):
        qs = self.get_base_queryset()
        if cliente:
            qs = qs.filter(cliente_id=cliente)
        elif prestador:
            qs = qs.filter(prestador_id=prestador)
        return qs
