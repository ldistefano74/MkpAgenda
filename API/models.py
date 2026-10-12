from django.core.exceptions import ValidationError
from django.db import models
from .validators import validar_cuit_cuil

class Precio(models.DecimalField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_digits", 10)
        kwargs.setdefault("decimal_places", 2)
        kwargs.setdefault("verbose_name", "Precio")
        super().__init__(*args, **kwargs)
        # Metadata para el frontend
        self.input_mask = "currency"
        self.mask_options = {
            "prefix": "$",
            "thousandsSeparator": ".",
            "decimalSeparator": ","
        }

class CUITField(models.CharField):
    """Campo para CUIT/CUIL con formato XX-XXXXXXXX-X"""
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_length", 13)
        kwargs.setdefault("verbose_name", "CUIT/CUIL")
        kwargs.setdefault("help_text", "Formato: XX-XXXXXXXX-X")
        if "validators" not in kwargs:
            kwargs["validators"] = []
        if validar_cuit_cuil not in kwargs["validators"]:
            kwargs["validators"].append(validar_cuit_cuil)
        super().__init__(*args, **kwargs)
        # Metadata para el frontend
        self.input_mask = "99-99999999-9"
        self.mask_options = {
            "placeholder": "__-________-_"
        }

class DNIField(models.CharField):
    """Campo para DNI argentino (hasta 8 dígitos)"""
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_length", 10)
        # kwargs.setdefault("decimal_places", 0)
        kwargs.setdefault("verbose_name", "DNI")
        kwargs.setdefault("help_text", "Documento Nacional de Identidad (8 dígitos)")
        super().__init__(*args, **kwargs)
        # Metadata para el frontend
        self.input_mask = "99.999.999"
        self.mask_options = {
            "placeholder": "__.___.___"
        }

class FacturaField(models.CharField):
    """Campo para número de factura con formato XXXX-XXXXXXXX"""
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_length", 13)
        kwargs.setdefault("verbose_name", "Nro de factura")
        kwargs.setdefault("help_text", "Número de factura (formato: 9999-99999999)")
        super().__init__(*args, **kwargs)
        # Metadata para el frontend
        self.input_mask = "9999-99999999"
        self.mask_options = {
            "placeholder": "____-________"
        }

class RedSocial(models.Model):
    nombre = models.CharField(max_length=50, unique=True, verbose_name="Nombre", null=False)
    inputmask = models.CharField(max_length=50, null=True, blank=True, verbose_name="Formato", help_text="Máscara de entrada para validación del usuario en esta red")

    def __str__(self):
        return self.nombre

    class Meta:
        db_table = "redes_sociales"
        ordering = ["nombre"]
        verbose_name = "Red social"
        verbose_name_plural = "Redes sociales"

class Persona(models.Model):
    CONDICIONES_FISCALES = [
        ("CF", "Consumidor Final"),
        ("RI", "Responsable Inscripto"),
        ("M", "Monotributo")
    ]
    nombre = models.CharField(max_length=50, verbose_name="Nombre", null=False)
    telefono = models.CharField(max_length=20, verbose_name="Teléfono", help_text="Número de contacto principal")
    email = models.EmailField(max_length=50, null=True, blank=True, verbose_name="Email", help_text="Correo electrónico de contacto")
    direccion = models.CharField(max_length=50, verbose_name="Dirección", null=True, blank=True, help_text="Requerido si no es Consumidor Final")
    dni = DNIField(blank=True, null=True)
    condicion_fiscal = models.CharField(max_length=2, choices=CONDICIONES_FISCALES, default="CF", verbose_name="Condición fiscal", help_text="Situación ante ARCA")
    cuit_cuil = CUITField(null=True, blank=True, help_text="Requerido si no es Consumidor Final")
    red_social = models.ForeignKey(RedSocial, null=True, blank=True, on_delete=models.RESTRICT, verbose_name="Red social", help_text="Red social de contacto preferida")

    class Meta:
        abstract = True
    
    def clean(self):
        if self.condicion_fiscal != "CF" and not self.cuit_cuil:
            raise ValidationError({"__all__": "Debe indicar CUIT/CUIL cuando la condición fiscal no es Consumidor Final."})
        if self.condicion_fiscal != "CF" and not self.direccion:
            raise ValidationError({"__all__": "Debe indicar Dirección cuando la condición fiscal no es Consumidor Final."})
        super().clean()
        
    def __str__(self):
        return self.nombre

class Cliente(Persona):
    fecha_nacimiento = models.DateField(blank=True, null=True, verbose_name="Fecha de nacimiento", help_text="Para enviar saludos o promociones especiales")
    fuente_contacto = models.ForeignKey('FuenteContacto', null=True, blank=True, on_delete=models.RESTRICT, verbose_name="Fuente de contacto")
    favorito = models.BooleanField(default=False, verbose_name="Favorito", help_text="Marcar para destacar en la lista de clientes")

    class Meta:
        db_table = "clientes"
        verbose_name = "Cliente"
        ordering = ["-favorito","nombre"]   # ojo, esto se usa en eventos para mostrar primero los favoritos
        constraints = [
            models.UniqueConstraint(fields=["telefono"], name="unique_cliente_telefono")
        ]

class TiposEvento(models.Model):
    nombre = models.CharField(max_length=50, verbose_name="Nombre", null=False)
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos eventos")
    template_presupuesto = models.CharField(max_length=50, null=True, blank=True, verbose_name="Template Presupuesto", help_text="Nombre del template de presupuesto (ej: presupuesto_boda)")

    class Meta:
        db_table = "tipos_evento"
        verbose_name = "Tipo de evento"
        ordering = ["nombre"]
        verbose_name_plural = "Tipos de eventos"

    def __str__(self):  
        return self.nombre

class Servicio(models.Model):
    nombre = models.CharField(max_length=50, verbose_name="Nombre", null=False, help_text="Nombre del servicio")
    precio_referencia = Precio(verbose_name="Precio de referencia", null=True, blank=True, help_text="Precio base sugerido para este servicio")
    duracion_estimada = models.DurationField(verbose_name="Duración estimada", null=True, blank=True, help_text="Tiempo aproximado del servicio (HH:MM)")
    descripcion = models.TextField(verbose_name="Descripción", null=True, blank=True, help_text="Detalles adicionales del servicio")
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos eventos")

    class Meta:
        db_table = "servicios"
        verbose_name = "Servicio"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

class PreciosServicio(models.Model):
    servicio = models.ForeignKey(Servicio, on_delete=models.CASCADE, null=False, related_name="precios", verbose_name="Servicio")
    tipo_evento = models.ForeignKey(TiposEvento, on_delete=models.CASCADE, null=False, verbose_name="Tipo de evento")
    precio = Precio(null=False, default=0.00, verbose_name="Precio", help_text="Precio sugerido para este servicio según tipo de evento")

    class Meta:
        db_table = "precios_servicio"
        verbose_name = "Precio de servicio"
        verbose_name_plural = "Precios de servicio"
        ordering = ["servicio", "tipo_evento"]
        constraints = [
            models.UniqueConstraint(
                fields=["servicio", "tipo_evento"],
                name="uniq_precio_servicio_tipo_evento"
            )
        ]

    def __str__(self):
        return f"{self.servicio} - {self.tipo_evento}"

class Prestador(Persona):
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos eventos")
    class Meta:
        db_table = "prestadores"
        verbose_name = "Prestador"
        verbose_name_plural = "Prestadores"
        ordering = ["nombre"]

class ServiciosPrestador(models.Model):
    prestador = models.ForeignKey(Prestador, on_delete=models.CASCADE, null=False, related_name="servicios_prestador")
    servicio = models.ForeignKey(Servicio, on_delete=models.RESTRICT, null=False)
    tipo_evento = models.ForeignKey(TiposEvento, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Tipo de evento", help_text="Tipo de evento al que aplica este precio (opcional)")
    precio_referencia = Precio(blank=True, null=True, verbose_name="Precio de referencia", help_text="Precio específico de este prestador (si difiere del servicio)")

    class Meta:
        db_table = "servicios_prestador"
        verbose_name = "Servicios por Prestador"
        verbose_name_plural = "Servicios por Prestador"
        ordering = ["prestador", "servicio"]
        constraints = [
            models.UniqueConstraint(
                fields=["prestador", "servicio", "tipo_evento"],
                name="uniq_prestador_servicio_tipo_evento",
                nulls_distinct=False,
            )
        ]
    def __str__(self):
        return f"{self.prestador} - {self.servicio}"

class Evento(models.Model):
    ESTADOS_EVENTO = [
        ("P", "Pendiente"),
        ("C", "Confirmado"),
        ("X", "Cancelado")
    ]
    cliente = models.ForeignKey(Cliente, on_delete=models.RESTRICT, null=False, help_text="Cliente que contrata el evento")
    tipo_evento = models.ForeignKey(TiposEvento, on_delete=models.RESTRICT, null=False, verbose_name="Tipo de evento", help_text="Categoría del evento")
    fecha = models.DateTimeField(verbose_name="Fecha", null=False, help_text="Fecha y hora de inicio del evento")
    duracion = models.DurationField(verbose_name="Duración total", null=True, blank=True, help_text="Duración estimada del evento (HH:MM:SS)")
    estado = models.CharField(max_length=1, choices=ESTADOS_EVENTO, default="P", verbose_name="Estado", help_text="Estado del evento")
    observaciones = models.TextField(verbose_name="Observaciones", null=True, blank=True, help_text="Notas internas sobre el evento")
    direccion_servicios = models.CharField(max_length=100, verbose_name="Dirección", null=True, blank=True, help_text="Lugar donde se realizarán los servicios")
    nro_factura_emitida = FacturaField(null=True, blank=True)
    google_calendar_event_id = models.CharField(max_length=200, null=True, blank=True)
    recordatorio_enviado = models.DateTimeField(verbose_name="Recordatorio enviado", null=True, blank=True, help_text="Fecha y hora en que se envió el recordatorio al cliente (null = no enviado)")

    def __str__(self):
        return f"{self.tipo_evento.nombre} el {self.fecha.strftime('%d/%m/%Y')}"

    class Meta:
        db_table = "eventos"
        verbose_name = "Evento"
        ordering = ["-fecha"]

class ServicioEvento(models.Model):
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, null=False, related_name='servicios_evento')
    servicio = models.ForeignKey(Servicio, on_delete=models.RESTRICT, null=False, verbose_name="Servicio", related_name="eventos_servicio")
    descripcion = models.CharField(verbose_name="Descripción", max_length=100, null=True, blank=True, help_text="Detalle específico del servicio para este evento")
    prestador = models.ForeignKey(Prestador, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Prestador", related_name="eventos_prestador", help_text="Prestador asignado a este servicio")
    lugar = models.CharField(max_length=100, verbose_name="Lugar", null=True, blank=True, help_text="Si difiere de la dirección del evento")
    duracion = models.DurationField(verbose_name="Duración", null=True, blank=True, help_text="Duración específica de este servicio (HH:MM)")
    importe = Precio(verbose_name="Importe", null=False, default=0.00, help_text="Monto a cobrar por este servicio")
    importe_prestador = Precio(verbose_name="Importe al prestador", null=True, blank=True, help_text="Monto a pagar al prestador por este servicio")
    cliente_cuenta = models.ForeignKey(Cliente, on_delete=models.RESTRICT, null=True, blank=True, related_name="servicios_a_cargo", verbose_name="A cargo de", help_text="Cliente responsable del pago de este servicio (si difiere del cliente del evento)")
    activo = models.BooleanField(verbose_name="Activo", null=False, default=True, help_text="Desmarcar si el servicio fue cancelado")
    presupuesto = models.CharField(max_length=200, verbose_name="Presupuesto", help_text="Referencia al presupuesto asociado", null=True, blank=True)
    observaciones = models.TextField(verbose_name="Observaciones", null=True, blank=True, help_text="Notas adicionales del servicio")

    class Meta:
        db_table = "servicios_evento"
        verbose_name = "Servicios por evento"
        ordering = ["evento", "servicio", "prestador"]

class MovimientoCuenta(models.Model):
    fecha = models.DateField(verbose_name="Fecha", null=False, help_text="Fecha del movimiento")
    cliente = models.ForeignKey(Cliente, on_delete=models.RESTRICT, null=True, blank=True, related_name="movimientos", help_text="Cliente asociado al movimiento")
    prestador = models.ForeignKey(Prestador, on_delete=models.RESTRICT, null=True, blank=True, related_name="movimientos", help_text="Prestador asociado al movimiento")
    evento = models.ForeignKey(Evento, on_delete=models.RESTRICT, null=True, blank=True, help_text="Evento asociado al movimiento (si corresponde)")
    servicio_evento = models.ForeignKey(ServicioEvento, on_delete=models.RESTRICT, null=True, blank=True, help_text="Referencia al servicio específico que generó este movimiento (si aplica)")
    tipo = models.CharField(max_length=1, verbose_name="Tipo", null=False, help_text="Tipo de movimiento: ingreso o egreso", choices=[("I", "Ingreso"), ("E", "Egreso")])
    importe = Precio(verbose_name="Importe", default=0, help_text="Monto recibido/pagado en este movimiento")
    concepto = models.CharField(max_length=255, verbose_name="Concepto", null=False, help_text="Descripción del movimiento")
    medio_pago_cobro = models.ForeignKey('MedioPagoCobro', on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Medio de pago/cobro", help_text="Medio utilizado para este movimiento")

    class Meta:
        db_table = "movimientos_cuenta"
        verbose_name = "Movimiento de cuenta"
        verbose_name_plural = "Movimientos de cuenta"
        ordering = ["-fecha"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(cliente__isnull=False, prestador__isnull=True) |
                    models.Q(cliente__isnull=True, prestador__isnull=False)
                ),
                name="movimiento_cliente_o_prestador"
            )
        ]

    def __str__(self):
        persona = self.cliente or self.prestador
        return f"{self.fecha} - {persona} - {self.concepto}"


class FuenteContacto(models.Model):
    descripcion = models.CharField(max_length=50, verbose_name="Descripción", null=False)
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos registros")

    class Meta:
        db_table = "fuentes_contacto"
        verbose_name = "Fuente de contacto"
        verbose_name_plural = "Fuentes de contacto"
        ordering = ["descripcion"]

    def __str__(self):
        return self.descripcion


class Configuracion(models.Model):
    clave = models.CharField(max_length=50, unique=True, verbose_name="Clave", null=False, help_text="Identificador único de la configuración")
    valor = models.TextField(verbose_name="Valor", null=True, blank=True, help_text="Valor de la configuración")
    descripcion = models.CharField(max_length=100, verbose_name="Descripción", null=True, blank=True, help_text="Explicación del propósito de esta configuración")

    class Meta:
        db_table = "configuracion"
        verbose_name = "Configuración"
        verbose_name_plural = "Configuraciones"

    def __str__(self):
        return f"{self.clave}: {self.valor}"


class MedioPagoCobro(models.Model):
    descripcion = models.CharField(max_length=50, verbose_name="Descripción", null=False)
    disponible_cobro = models.BooleanField(default=True, verbose_name="Disponible en cobro", null=False, help_text="Habilitado como medio de cobro a clientes")
    disponible_pago = models.BooleanField(default=True, verbose_name="Disponible en pago", null=False, help_text="Habilitado como medio de pago a prestadores")
    incluye_cuotas = models.BooleanField(default=False, verbose_name="Incluye cuotas", null=False, help_text="Si está activo, los costos pagados con este medio se financian en cuotas")

    @property
    def incluye_cuotas_label(self):
        return "Cuotas" if self.incluye_cuotas else ""

    class Meta:
        db_table = "medios_pago_cobro"
        verbose_name = "Medio de Pago/Cobro"
        verbose_name_plural = "Medios de Pago/Cobro"
        ordering = ["descripcion"]

    def __str__(self):
        return self.descripcion

    
class Proveedor(Persona):
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos registros")

    class Meta:
        db_table = "proveedores"
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"
        ordering = ["nombre"]


class CategoriaCosto(models.Model):
    nombre = models.CharField(max_length=50, verbose_name="Nombre", null=False)
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos registros")

    class Meta:
        db_table = "categorias_costo"
        verbose_name = "Categoría de costo"
        verbose_name_plural = "Categorías de costo"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class CostoRecurrente(models.Model):
    RECURRENCIAS = [
        ("S", "Semanal"),
        ("Q", "Quincenal"),
        ("M", "Mensual"),
        ("B", "Bimensual"),
        ("T", "Trimestral"),
        ("6", "Semestral"),
        ("A", "Anual"),
    ]
    nombre = models.CharField(max_length=50, verbose_name="Nombre", null=False)
    categoria_costo = models.ForeignKey(CategoriaCosto, on_delete=models.RESTRICT, null=False, verbose_name="Categoría de costo")
    proveedor = models.ForeignKey(Proveedor, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Proveedor predeterminado", help_text="Proveedor habitual para este costo recurrente (opcional)")
    recurrencia = models.CharField(max_length=1, choices=RECURRENCIAS, verbose_name="Recurrencia", null=False, help_text="Periodicidad del costo")
    activo = models.BooleanField(default=True, verbose_name="Activo", null=False, help_text="Desmarcar para ocultar en nuevos registros")

    class Meta:
        db_table = "costos_recurrentes"
        verbose_name = "Costo recurrente"
        verbose_name_plural = "Costos recurrentes"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Costo(models.Model):
    fecha = models.DateField(verbose_name="Fecha", null=False, help_text="Fecha del costo")
    costo_recurrente = models.ForeignKey(CostoRecurrente, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Costo recurrente", help_text="Costo recurrente al que pertenece este costo (opcional)")
    categoria_costo = models.ForeignKey(CategoriaCosto, on_delete=models.RESTRICT, null=False, verbose_name="Categoría")
    descripcion = models.CharField(max_length=255, verbose_name="Descripción", null=False, help_text="Detalle del costo")
    importe = Precio(verbose_name="Importe", null=False, default=0.00, help_text="Monto del costo")
    cantidad_cuotas = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Cantidad de cuotas", help_text="Cantidad de cuotas en que se financia el costo (sólo aplica cuando el medio de pago incluye cuotas)")
    medio_pago = models.ForeignKey(MedioPagoCobro, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Medio de pago", help_text="Medio utilizado para este pago")
    evento = models.ForeignKey(Evento, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Evento", help_text="Evento asociado al costo (opcional)")
    proveedor = models.ForeignKey(Proveedor, on_delete=models.RESTRICT, null=True, blank=True, verbose_name="Proveedor", help_text="Proveedor al que corresponde el costo (opcional)")

    class Meta:
        db_table = "costos"
        verbose_name = "Costo"
        verbose_name_plural = "Costos"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.fecha} - {self.descripcion}"


class CuotaCosto(models.Model):
    costo = models.ForeignKey(Costo, on_delete=models.CASCADE, related_name="cuotas", verbose_name="Costo")
    numero_cuota = models.PositiveSmallIntegerField(default=1, verbose_name="Número de cuota", help_text="Número de cuota dentro del financiamiento (1, 2, 3, ...)")
    fecha_vencimiento = models.DateField(verbose_name="Vencimiento", help_text="Fecha en que la cuota impacta en el cashflow")
    importe = Precio(verbose_name="Importe", null=False, default=0.00)
    pagada = models.BooleanField(default=False, verbose_name="Pagada")

    class Meta:
        db_table = "cuotas_costo"
        verbose_name = "Cuota de costo"
        verbose_name_plural = "Cuotas de costo"
        ordering = ["fecha_vencimiento"]

    def __str__(self):
        return f"{self.costo_id} - Cuota {self.fecha_vencimiento}"


class VmCuentaCorriente(models.Model):
    TIPO_MOVIMIENTO_CHOICES = [
        ("M", "Movimiento"),
        ("E", "Evento (cliente)"),
        ("S", "Servicio (prestador)"),
    ]
    tipo_movimiento = models.CharField(max_length=1, choices=TIPO_MOVIMIENTO_CHOICES, verbose_name="Tipo de movimiento")
    fecha = models.DateField(verbose_name="Fecha")
    cliente = models.ForeignKey(Cliente, on_delete=models.DO_NOTHING, null=True, blank=True)
    prestador = models.ForeignKey(Prestador, on_delete=models.DO_NOTHING, null=True, blank=True)
    evento = models.ForeignKey(Evento, on_delete=models.DO_NOTHING, null=True, blank=True, verbose_name="Evento")
    servicio_evento = models.ForeignKey(ServicioEvento, on_delete=models.DO_NOTHING, null=True, blank=True, verbose_name="Servicio en evento")
    tipo = models.CharField(max_length=20, verbose_name="Tipo")
    importe = Precio(verbose_name="Importe")
    concepto = models.CharField(max_length=255, verbose_name="Concepto")
    medio_pago_cobro = models.ForeignKey(MedioPagoCobro, on_delete=models.DO_NOTHING, null=True, blank=True, verbose_name="Medio de Pago/Cobro")
    importe_signo = Precio(verbose_name="Importe con signo")

    class Meta:
        managed = False
        db_table = "vw_cuenta_corriente"
        verbose_name = "Cuenta corriente"
        verbose_name_plural = "Cuenta corriente"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.fecha} - {self.tipo_movimiento} - {self.concepto}"


