"""
Módulo de acceso centralizado a la tabla de Configuracion.
"""
from .models import Configuracion


def get_config(clave, default=None):
    """
    Obtiene un valor de configuración por su clave.

    Args:
        clave: La clave de configuración a buscar
        default: Valor por defecto si no se encuentra la clave

    Returns:
        El valor de la configuración o el default si no existe
    """
    try:
        config = Configuracion.objects.filter(clave=clave).first()
        return config.valor if config else default
    except Exception:
        return default


def get_configs(startsWith=None):
    """
    Obtiene configuraciones como diccionario {clave: valor}, opcionalmente filtradas por patrón.

    Args:
        startsWith: Patrón de búsqueda por prefijo (ej: 'PRESUPUESTO_SERVICIO_').
                   Si es None, retorna todas las configuraciones.
                   La búsqueda es case-sensitive y usa prefijo exacto.

    Returns:
        Diccionario {clave: valor} de configuraciones
    """
    try:
        query = Configuracion.objects
        if startsWith:
            query = query.filter(clave__startswith=startsWith)
        return {config.clave: config.valor for config in query}
    except Exception:
        return {}


# Constantes de claves de configuración
DEFAULT_DIRECCION_EVENTO = 'DEFAULT_DIRECCION_EVENTO'
GOOGLE_CALENDAR_ID = 'GOOGLE_CALENDAR_ID'
MENSAJE_RECORDATORIO = 'MENSAJE_RECORDATORIO'

# Presupuesto - Token → Servicio mapping
# Claves de formato: PRESUPUESTO_SERVICIO_XXXX donde XXXX es el token en el PDF (sin llaves)
# Valor: ID del servicio a usar para obtener el importe
# Ejemplo: PRESUPUESTO_SERVICIO_IMPORTE_MKP = 1 (busca {{IMPORTE_MKP}} en el PDF y lo reemplaza con el importe del servicio con id=1)
# Nota: Se busca primero en ServicioEvento (específico del evento), luego en precio_referencia del Servicio
