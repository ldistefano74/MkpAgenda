from rest_framework import serializers
from ..models import Evento, FuenteContacto, ServicioEvento, Cliente, MovimientoCuenta
from .. import config
from django.db import transaction
from .base import BaseModelSerializer
from .validators import model_validator
from .serializer_factory import create_serializer


class NuevoClienteSerializer(serializers.Serializer):
    """Serializer para crear un cliente básico junto con el evento"""
    nombre = serializers.CharField(max_length=50)
    telefono = serializers.CharField(max_length=20)
    email = serializers.EmailField(max_length=50, required=False, allow_blank=True, allow_null=True)
    fuente_contacto = serializers.IntegerField(required=False, allow_null=True)


class EventoListSerializer(BaseModelSerializer):
    """Serializer para la lista de eventos con nombres de relaciones"""
    cliente_nombre = serializers.CharField(read_only=True, source='cliente.nombre', label="Cliente")
    cliente_telefono = serializers.CharField(read_only=True, source='cliente.telefono')
    tipo_evento_nombre = serializers.CharField(read_only=True, source='tipo_evento.nombre', label="Tipo de evento")
    estado_display = serializers.CharField(read_only=True, source='get_estado_display', label="Estado")
    importe_total = serializers.DecimalField(read_only=True, max_digits=10, decimal_places=2, label="Importe total")
    saldo_a_cobrar = serializers.DecimalField(read_only=True, max_digits=10, decimal_places=2, label="Saldo a cobrar")

    class Meta:
        model = Evento
        fields = ['id', 'fecha', 'duracion', 'direccion_servicios', 'cliente', 'cliente_nombre', 'cliente_telefono', 'tipo_evento_nombre', 'estado', 'estado_display', 'importe_total', 'saldo_a_cobrar', 'recordatorio_enviado']


class ServicioEventoSerializer(BaseModelSerializer):
    """Serializer para los servicios de un evento"""
    id = serializers.IntegerField(required=False, validators=[])  # Writable; validators=[] evita el UniqueValidator automático de DRF
    servicio_nombre = serializers.CharField(read_only=True, source='servicio.nombre')
    prestador_nombre = serializers.CharField(read_only=True, source='prestador.nombre')
    cliente_cuenta_nombre = serializers.CharField(read_only=True, source='cliente_cuenta.nombre', allow_null=True)

    class Meta:
        model = ServicioEvento
        exclude = ['evento']


class EventoDetailSerializer(BaseModelSerializer):
    """Serializer detallado para Evento que incluye sus servicios"""
    servicios_evento = ServicioEventoSerializer(many=True, required=False)
    nuevo_cliente = NuevoClienteSerializer(write_only=True, required=False, allow_null=True)
    # Sobrescribir cliente para permitir que sea opcional cuando se envía nuevo_cliente
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        required=False,
        allow_null=True
    )
    cliente_nombre = serializers.CharField(read_only=True, source='cliente.nombre', allow_null=True)
    tipo_evento_nombre = serializers.CharField(read_only=True, source='tipo_evento.nombre', allow_null=True)

    class Meta:
        model = Evento
        fields = '__all__'
        read_only_fields = ['google_calendar_event_id', 'recordatorio_enviado']

    def validate(self, data):
        """
        Valida que se proporcione cliente o nuevo_cliente, pero no ambos.
        En creación: uno de los dos es obligatorio.
        En edición: cliente no puede ser nulo.
        """
        if self.instance is None:
            # Creación: debe haber exactamente uno de cliente o nuevo_cliente
            has_cliente = 'cliente' in data and data['cliente'] is not None
            has_nuevo_cliente = 'nuevo_cliente' in data and data['nuevo_cliente'] is not None

            if has_cliente and has_nuevo_cliente:
                raise serializers.ValidationError({
                    'cliente': 'No puede especificar un cliente existente y crear uno nuevo al mismo tiempo.'
                })

            if not has_cliente and not has_nuevo_cliente:
                raise serializers.ValidationError({
                    'cliente': 'Debe seleccionar un cliente o crear uno nuevo.'
                })
        else:
            # Edición: no se puede dejar el cliente en nulo
            if 'cliente' in data and data['cliente'] is None:
                raise serializers.ValidationError({
                    'cliente': 'El cliente es obligatorio.'
                })

        return data

    def create(self, validated_data):
        servicios_data = validated_data.pop('servicios_evento', [])
        nuevo_cliente_data = validated_data.pop('nuevo_cliente', None)

        with transaction.atomic():
            # Si se está creando un nuevo cliente, crearlo primero
            if nuevo_cliente_data:
                ClienteSerializer = create_serializer(Cliente)
                cliente_serializer = ClienteSerializer(data=nuevo_cliente_data)
                cliente_serializer.is_valid(raise_exception=True)
                cliente = cliente_serializer.save()
                validated_data['cliente'] = cliente

            instance = Evento.objects.create(**validated_data)

            for item in servicios_data:
                ServicioEvento.objects.create(evento=instance, **item)

        return instance

    def update(self, instance, validated_data):
        servicios_data = validated_data.pop('servicios_evento', None)
        # Ignorar nuevo_cliente en updates (solo aplica en creación)
        validated_data.pop('nuevo_cliente', None)

        with transaction.atomic():
            instance = super().update(instance, validated_data)

            if servicios_data is not None:
                incoming_ids = {item['id'] for item in servicios_data if 'id' in item}
                existing_map = {se.id: se for se in instance.servicios_evento.all()}
                to_delete_ids = set(existing_map.keys()) - incoming_ids

                if to_delete_ids:
                    # Verificar si alguno está referenciado por movimientos de cuenta
                    referenced_ids = set(
                        MovimientoCuenta.objects
                        .filter(servicio_evento_id__in=to_delete_ids)
                        .values_list('servicio_evento_id', flat=True)
                    )
                    if referenced_ids:
                        srvs = ServicioEvento.objects.filter(
                            id__in=referenced_ids
                        ).select_related('servicio', 'prestador')
                        names = [
                            f"{se.servicio.nombre}" + (f" ({se.prestador.nombre})" if se.prestador else "")
                            for se in srvs
                        ]
                        raise serializers.ValidationError({
                            'servicios_evento': (
                                'No se pueden eliminar los siguientes servicios porque tienen '
                                f'movimientos de cuenta asociados: {", ".join(names)}.'
                            )
                        })
                    instance.servicios_evento.filter(id__in=to_delete_ids).delete()

                for item in servicios_data:
                    item_id = item.pop('id', None)
                    if item_id and item_id in existing_map:
                        ServicioEvento.objects.filter(id=item_id).update(**item)
                    else:
                        ServicioEvento.objects.create(evento=instance, **item)

        return instance

    def get_new_instance(self):
        """Sobrescribe para agregar el default de direccion_servicios desde Configuracion"""
        instance = super().get_new_instance()
        instance['direccion_servicios'] = config.get_config(config.DEFAULT_DIRECCION_EVENTO)
        return instance
