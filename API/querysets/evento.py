from django.db.models import Sum, Subquery, OuterRef, Value, DecimalField, F, ExpressionWrapper, DateTimeField, Case, When
from django.db.models.functions import Coalesce

from .base import BaseQuerySet
from ..models import Evento, ServicioEvento, VmCuentaCorriente


class EventoQuerySet(BaseQuerySet):
    model = Evento

    def get_queryset(self, action=None, **kwargs):
        if action in ['retrieve', 'create', 'update', 'partial_update', 'destroy']:
            return self.para_detalle()
        if action == 'list':
            return self.para_lista(
                fecha_desde=kwargs.get('fecha_desde'),
                fecha_hasta=kwargs.get('fecha_hasta'),
                estado=kwargs.get('estado'),
            )
        return self.get_base_queryset()

    def para_lista(self, fecha_desde=None, fecha_hasta=None, estado=None):
        qs = self.get_base_queryset().select_related(
            "cliente", "tipo_evento"
        ).annotate(
            **self._totales_annotations()
        )
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def para_detalle(self):
        return self.get_base_queryset().select_related(
            "cliente", "tipo_evento"
        ).prefetch_related(
            "servicios_evento__servicio",
            "servicios_evento__prestador"
        )

    def get_conflicts(self, fecha, duracion=None, exclude_id=None):
        """
        Retorna lista de strings "TipoEvento - Cliente" para eventos no cancelados
        que se solapan con el intervalo [fecha, fecha+duracion] (o el punto fecha si no hay duracion).
        Condición: FDP <= FHE AND FDE <= FHP
        """
        fdp = fecha
        fhp = fecha if duracion is None else fecha + duracion

        fhe_expr = Case(
            When(duracion__isnull=False, then=ExpressionWrapper(F('fecha') + F('duracion'), output_field=DateTimeField())),
            default=F('fecha'),
            output_field=DateTimeField()
        )

        qs = self.get_base_queryset().exclude(estado='X').select_related('tipo_evento', 'cliente')
        if exclude_id:
            qs = qs.exclude(pk=exclude_id)

        return [
            f"{evento.tipo_evento} - {evento.cliente}"
            for evento in qs.annotate(fhe=fhe_expr).filter(fecha__lt=fhp, fhe__gt=fdp)
        ]

    def _totales_annotations(self):
        decimal_field = DecimalField(max_digits=10, decimal_places=2)

        # Valor bruto del evento: lo que valen sus servicios, sin importar el
        # estado ni lo ya cobrado. Es una columna informativa de la grilla.
        importe_total_sq = Coalesce(
            Subquery(
                ServicioEvento.objects.filter(
                    evento=OuterRef('pk'), activo=True
                ).values('evento').annotate(total=Sum('importe')).values('total')
            ),
            Value(0), output_field=decimal_field
        )

        # El saldo sale de vw_cuenta_corriente en lugar de recalcularse acá:
        # la vista ya decide qué genera cargo (sólo eventos confirmados) y ya
        # lleva el signo de cada fila. Nos quedamos con el lado cliente
        # (cliente_id no nulo excluye el cargo al prestador y sus pagos) y
        # sumamos importe_signo: cargos en positivo, cobros en negativo.
        # Un evento cancelado con seña cobrada da negativo = saldo a favor.
        saldo_sq = Coalesce(
            Subquery(
                VmCuentaCorriente.objects.filter(
                    evento=OuterRef('pk'), cliente__isnull=False
                ).values('evento').annotate(total=Sum('importe_signo')).values('total')
            ),
            Value(0), output_field=decimal_field
        )
        return {'importe_total': importe_total_sq, 'saldo_a_cobrar': saldo_sq}
