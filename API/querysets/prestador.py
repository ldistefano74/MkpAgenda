from .base import BaseQuerySet
from ..models import Prestador


class PrestadorQuerySet(BaseQuerySet):
    model = Prestador

    def get_queryset(self, action=None, **kwargs):
        if action in ['retrieve', 'create', 'update', 'partial_update']:
            return self.para_detalle()
        return self.get_base_queryset()

    def para_detalle(self):
        return self.get_base_queryset().prefetch_related("servicios_prestador__servicio")
