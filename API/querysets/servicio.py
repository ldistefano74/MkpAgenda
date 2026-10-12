from .base import BaseQuerySet
from ..models import Servicio


class ServicioQuerySet(BaseQuerySet):
    model = Servicio

    def get_queryset(self, action=None, **kwargs):
        if action in ['retrieve', 'create', 'update', 'partial_update']:
            return self.para_detalle()
        return self.get_base_queryset()

    def para_detalle(self):
        return self.get_base_queryset().prefetch_related("precios__tipo_evento")
