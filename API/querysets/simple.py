from .base import BaseQuerySet
from ..models import RedSocial, TiposEvento, Cliente, FuenteContacto, MedioPagoCobro, Proveedor, CategoriaCosto, CostoRecurrente, Costo


class RedSocialQuerySet(BaseQuerySet):
    model = RedSocial


class TiposEventoQuerySet(BaseQuerySet):
    model = TiposEvento


class ClienteQuerySet(BaseQuerySet):
    model = Cliente


class FuenteContactoQuerySet(BaseQuerySet):
    model = FuenteContacto


class MedioPagoCobroQuerySet(BaseQuerySet):
    model = MedioPagoCobro


class ProveedorQuerySet(BaseQuerySet):
    model = Proveedor


class CategoriaCostoQuerySet(BaseQuerySet):
    model = CategoriaCosto


class CostoRecurrenteQuerySet(BaseQuerySet):
    model = CostoRecurrente

    def get_queryset(self, **filters):
        return self.get_base_queryset().select_related('categoria_costo', 'proveedor')

class CostoQuerySet(BaseQuerySet):
    model = Costo

    def get_queryset(self, evento=None, **filters):
        qs = self.get_base_queryset().select_related('categoria_costo', 'medio_pago', 'evento__tipo_evento', 'proveedor')
        if evento:
            qs = qs.filter(evento_id=evento)
        return qs
