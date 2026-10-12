import fitz
from pathlib import Path
from django.conf import settings
from decimal import Decimal

from API.models import Evento, ServicioEvento
from API import config
from API.services.precios import get_precio_servicio

TEMPLATES_REPORTS_DIR = Path(settings.BASE_DIR) / 'API' / 'templates' / 'reports'
PLACEHOLDER_PREFIX = 'PRESUPUESTO_SERVICIO_'

def _get_importe_servicio(evento, servicio_id):
    """Obtiene el importe de un servicio para un evento."""
    importe = ServicioEvento.objects.filter(
        evento=evento,
        servicio_id=servicio_id,
    ).order_by('-importe').values_list('importe', flat=True).first()

    if importe is None:
        return None
    return importe


def _format_currency(value):
    """Formatea un valor numérico como moneda (estilo argentino)."""
    if value is None:
        return "(Solicitar cotización)"
    if isinstance(value, Decimal):
        value = float(value)
    return f"$ {value:,.0f}.-".replace(",", ".")


def build_presupuesto_context(evento_id):
    """Construye el diccionario de reemplazos {token: importe} para el PDF."""
    evento = Evento.objects.select_related('cliente', 'tipo_evento').get(id=evento_id)

    tipo_evento = evento.tipo_evento
    if not tipo_evento or not tipo_evento.template_presupuesto:
        raise ValueError(f"El tipo de evento '{tipo_evento}' no tiene template de presupuesto configurado.")

    context = {}
    configs = config.get_configs(startsWith=PLACEHOLDER_PREFIX)

    for key, servicio_id_str in configs.items():
        try:
            servicio_id = int(servicio_id_str)
            token = "{{" + key.replace(PLACEHOLDER_PREFIX, '') + "}}"
            importe = _get_importe_servicio(evento, servicio_id)
            context[token] = _format_currency(importe)
        except (ValueError, TypeError):
            continue

    return context


def generate_presupuesto_pdf(evento_id):
    """Genera el PDF de presupuesto reemplazando tokens con importes. Retorna bytes."""
    evento = Evento.objects.select_related('tipo_evento').get(id=evento_id)
    context = build_presupuesto_context(evento_id)

    template_name = evento.tipo_evento.template_presupuesto
    template_path = TEMPLATES_REPORTS_DIR / f'{template_name}.pdf'

    if not template_path.exists():
        raise FileNotFoundError(f"Template PDF no encontrado: {template_path}")

    doc = fitz.open(str(template_path))

    for page in doc:
        for placeholder, value in context.items():
            matches = page.search_for(placeholder)

            for rect in matches:
                margin_x = rect.width * -0.03
                margin_y = rect.height * 0.15

                fill_rect = fitz.Rect(
                    rect.x0 + margin_x,
                    rect.y0 + margin_y,
                    rect.x1 - margin_x,
                    rect.y1 - margin_y,
                )

                # Tapar placeholder con color beige (similar al PDF original)
                page.draw_rect(
                    fill_rect,
                    color=(1.0, 0.976, 0.953),
                    fill=(1.0, 0.976, 0.953),
                )

                # Escribir el valor nuevo
                fontsize = 22
                text_y = rect.y0 + ((rect.height - fontsize) / 2) + fontsize - 2

                page.insert_text(
                    (rect.x0, text_y),
                    value,
                    fontsize=fontsize,
                    fontname="tibo",
                    color=(65/255, 75/255, 59/255),
                )

    pdf_bytes = doc.write()
    doc.close()

    return pdf_bytes
