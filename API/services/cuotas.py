from API.models import CuotaCosto


def get_cuotas_pendientes(ventana_end):
    return (
        CuotaCosto.objects
        .filter(pagada=False, fecha_vencimiento__lte=ventana_end)
        .select_related('costo__categoria_costo')
        .order_by('fecha_vencimiento')
        .values(
            'id',
            'numero_cuota',
            'fecha_vencimiento',
            'importe',
            'costo_id',
            'costo__cantidad_cuotas',
            'costo__descripcion',
            'costo__categoria_costo__nombre',
        )
    )


def preparar_pago(cuota_id):
    """Retorna la instancia con pagada=True lista para ser guardada por la vista."""
    cuota = CuotaCosto.objects.get(id=cuota_id)
    if cuota.pagada:
        raise ValueError("La cuota ya está marcada como pagada.")
    cuota.pagada = True
    return cuota
