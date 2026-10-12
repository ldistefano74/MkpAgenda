from API.models import *
from .prestador import PrestadorDetailSerializer, ServicioPrestadorSerializer
from .evento import EventoListSerializer, EventoDetailSerializer, ServicioEventoSerializer
from .movimiento import MovimientoCuentaSerializer
from .cuenta_corriente import CuentaCorrienteSerializer
from .costo import CostoRecurrenteListSerializer, CostoListSerializer, CostoDetailSerializer, CuotaCostoSerializer
from .configuracion import ConfiguracionSerializer, ConfiguracionBulkSerializer
from .servicio import ServicioDetailSerializer, PrecioServicioSerializer
from .serializer_factory import create_serializer


__all__ = [
    'create_serializer',
    'get_serializer_class',
    'CLASS_REGISTRY',
    'PrestadorDetailSerializer',
    'ServicioPrestadorSerializer',
    'EventoListSerializer',
    'EventoDetailSerializer',
    'ServicioEventoSerializer',
    'MovimientoCuentaSerializer',
    'CuentaCorrienteSerializer',
    'CostoRecurrenteListSerializer',
    'CostoListSerializer',
    'CostoDetailSerializer',
    'CuotaCostoSerializer',
    'ConfiguracionSerializer',
    'ConfiguracionBulkSerializer',
    'ServicioDetailSerializer',
    'PrecioServicioSerializer',
]

CLASS_REGISTRY = {
    'cliente': create_serializer(Cliente),
    'prestador': create_serializer(Prestador),
    'redsocial': create_serializer(RedSocial),
    'servicio': create_serializer(Servicio),
    'serviciodetailserializer': ServicioDetailSerializer,
    'tiposevento': create_serializer(TiposEvento),
    'fuentecontacto': create_serializer(FuenteContacto),
    'mediopagocobro': create_serializer(MedioPagoCobro),
    'eventolistserializer': EventoListSerializer,
    'eventodetailserializer': EventoDetailSerializer,
    'prestadordetailserializer': PrestadorDetailSerializer,
    'movimientocuentaserializer': MovimientoCuentaSerializer,
    'cuentacorrienteserializer': CuentaCorrienteSerializer,
    'proveedor': create_serializer(Proveedor),
    'categoriacosto': create_serializer(CategoriaCosto),
    'costorecurrente': create_serializer(CostoRecurrente),
    'costorecurrentelistserializer': CostoRecurrenteListSerializer,
    'costo': create_serializer(Costo),
    'costolistserializer': CostoListSerializer,
    'costodetailserializer': CostoDetailSerializer,
    'cuotacosto': CuotaCostoSerializer,
    'configuracion': ConfiguracionSerializer,
}

def get_serializer_class(serializer_name):
    """
    Devuelve la clase Serializer correspondiente al nombre dado (case-insensitive).
    """
    return CLASS_REGISTRY.get(serializer_name.lower(), None)