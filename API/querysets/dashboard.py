from django.db.models import Sum

from API.models import VmCuentaCorriente


def cobros_pendientes_qs():
    """
    Cobros pendientes por evento y cliente responsable.

    Sale entero de vw_cuenta_corriente: la vista ya parte el cargo entre el
    cliente de cabecera y los clientes a cargo de cada servicio, y ya limita
    los cargos a eventos confirmados. Agrupando por (evento, cliente) y
    sumando importe_signo (cargos +, cobros -) queda el pendiente de cada
    responsable; `pendiente > 0` descarta los saldos a favor.
    """
    return (
        VmCuentaCorriente.objects
        .filter(cliente__isnull=False, evento__isnull=False)
        .values('evento_id', 'evento__fecha', 'evento__tipo_evento__nombre', 'cliente__nombre')
        .annotate(pendiente=Sum('importe_signo'))
        .filter(pendiente__gt=0)
    )


def pagos_pendientes_qs():
    """
    Pagos pendientes al prestador, por servicio del evento.

    Igual que los cobros, sale de vw_cuenta_corriente: las filas 'S' traen
    +importe_prestador y los pagos 'M' al prestador traen -importe, así que la
    suma de importe_signo por servicio es directamente el pendiente. La vista
    ya limita las filas 'S' a eventos confirmados.

    `servicio_evento__isnull=False` deja afuera los pagos genéricos al
    prestador (sin servicio imputado), que tampoco entraban antes: el cálculo
    anterior sólo miraba movimientos atados a cada servicio_evento.
    """
    return (
        VmCuentaCorriente.objects
        .filter(prestador__isnull=False, servicio_evento__isnull=False)
        .values(
            'servicio_evento_id', 'evento_id', 'evento__fecha',
            'prestador_id', 'prestador__nombre',
            'servicio_evento__servicio__nombre', 'evento__cliente__nombre',
        )
        .annotate(pendiente=Sum('importe_signo'))
        .filter(pendiente__gt=0)
    )
