from ..models import *
from ..serializers import *
from ..querysets import *
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from django.utils.dateparse import parse_datetime, parse_duration
from django.utils import timezone
from API.services.google_calendar import sync_evento, delete_evento
from API.services.recordatorio import get_recordatorio, marcar_recordatorio_enviado

class ServicioViewSet(viewsets.ModelViewSet):
    queryset = Servicio.objects.all()
    _qs = ServicioQuerySet()

    def get_queryset(self):
        return self._qs.get_queryset(action=self.action)

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return ServicioDetailSerializer
        return create_serializer(Servicio)

class RedesViewSet(viewsets.ModelViewSet):
    queryset = RedSocialQuerySet().get_queryset()
    serializer_class = create_serializer(RedSocial)

class TiposEventoViewSet(viewsets.ModelViewSet):
    queryset = TiposEventoQuerySet().get_queryset()
    serializer_class = create_serializer(TiposEvento)

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = ClienteQuerySet().get_queryset()
    serializer_class = create_serializer(Cliente)

class FuenteContactoViewSet(viewsets.ModelViewSet):
    queryset = FuenteContactoQuerySet().get_queryset()
    serializer_class = create_serializer(FuenteContacto)

class MedioPagoCobroViewSet(viewsets.ModelViewSet):
    queryset = MedioPagoCobroQuerySet().get_queryset()
    serializer_class = create_serializer(MedioPagoCobro)

class PrestadorViewSet(viewsets.ModelViewSet):
    queryset = Prestador.objects.all()
    _qs = PrestadorQuerySet()

    def get_queryset(self):
        return self._qs.get_queryset(action=self.action)

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return PrestadorDetailSerializer
        return create_serializer(Prestador)


class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.all()
    _qs = EventoQuerySet()

    def get_queryset(self):
        return self._qs.get_queryset(
            action=self.action,
            fecha_desde=self.request.query_params.get('fecha_desde'),
            fecha_hasta=self.request.query_params.get('fecha_hasta'),
            estado=self.request.query_params.get('estado'),
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return EventoListSerializer
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return EventoDetailSerializer
        return create_serializer(Evento)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        instance = Evento.objects.get(pk=response.data['id'])
        error = sync_evento(instance)
        if error:
            response.data['gcal_warning'] = error
        return response

    def update(self, request, *args, **kwargs):
        saved_evento = self.get_object()
        response = super().update(request, *args, **kwargs)
        instance = Evento.objects.get(pk=response.data['id'])
        error = sync_evento(instance, saved_evento=saved_evento)
        if error:
            response.data['gcal_warning'] = error
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        error = delete_evento(instance)
        if error:
            return Response({'gcal_warning': error}, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def check_conflicts(self, request):
        fecha_str = request.query_params.get('fecha')
        duracion_str = request.query_params.get('duracion')
        exclude_id = request.query_params.get('exclude_id')

        if not fecha_str:
            return Response({'conflicts': []})

        fecha = parse_datetime(fecha_str)
        if fecha is None:
            return Response({'error': 'Fecha inválida'}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.is_naive(fecha):
            fecha = timezone.make_aware(fecha)

        duracion = parse_duration(duracion_str if duracion_str else "00:30:00")  # Duración por defecto de 30 minutos
        conflicts = self._qs.get_conflicts(fecha, duracion, exclude_id)
        return Response({'conflicts': conflicts})

    @action(detail=True, methods=['get', 'post'])
    def recordatorio(self, request, pk=None):
        """GET: arma el mensaje y el link de WhatsApp. POST: marca el recordatorio como enviado."""
        if request.method == 'POST':
            enviado = marcar_recordatorio_enviado(pk)
            return Response({'recordatorio_enviado': enviado})

        data = get_recordatorio(pk)
        if not data['whatsapp_url']:
            return Response(
                {'error': 'El cliente no tiene un teléfono cargado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(data)


class MovimientoCuentaViewSet(viewsets.ModelViewSet):
    queryset = MovimientoCuenta.objects.all()
    serializer_class = MovimientoCuentaSerializer
    _qs = MovimientoCuentaQuerySet()

    def get_queryset(self):
        return self._qs.get_queryset(
            cliente=self.request.query_params.get('cliente'),
            prestador=self.request.query_params.get('prestador'),
            evento=self.request.query_params.get('evento'),
            tipo=self.request.query_params.get('tipo'),
        )


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = create_serializer(Proveedor)

    def get_queryset(self):
        return ProveedorQuerySet().get_queryset()


class CategoriaCostoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaCosto.objects.all()
    serializer_class = create_serializer(CategoriaCosto)

    def get_queryset(self):
        return CategoriaCostoQuerySet().get_queryset()


class CostoRecurrenteViewSet(viewsets.ModelViewSet):
    queryset = CostoRecurrente.objects.all()

    def get_queryset(self):
        return CostoRecurrenteQuerySet().get_queryset()

    def get_serializer_class(self):
        if self.action == 'list':
            return CostoRecurrenteListSerializer
        return create_serializer(CostoRecurrente)


class CostoViewSet(viewsets.ModelViewSet):
    queryset = Costo.objects.all()

    def get_queryset(self):
        return CostoQuerySet().get_queryset(
            evento=self.request.query_params.get('evento'),
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return CostoListSerializer
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CostoDetailSerializer
        return create_serializer(Costo)


class ConfiguracionViewSet(viewsets.ModelViewSet):
    serializer_class = ConfiguracionSerializer

    def get_queryset(self):
        return Configuracion.objects.all().order_by('clave')

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        serializer = ConfiguracionBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instances = serializer.save()
        return Response(ConfiguracionSerializer(instances, many=True).data)


class CuentaCorrienteViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CuentaCorrienteSerializer
    _qs = CuentaCorrienteQuerySet()

    def get_queryset(self):
        return self._qs.get_queryset(
            cliente=self.request.query_params.get('cliente'),
            prestador=self.request.query_params.get('prestador'),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        saldo = queryset.aggregate(saldo=Sum('importe_signo'))['saldo'] or 0
        return Response({
            'movimientos': serializer.data,
            'saldo': saldo,
        })
