"""
Presupuesto — `services/presupuesto.py` y `/api/reports/presupuesto/<evento_id>/`.

Se testea `build_presupuesto_context()` (lógica de tokens/importes) sin llegar al
render real: `generate_presupuesto_pdf` se mockea, así que ningún test abre
PyMuPDF ni lee el template del disco.
"""
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework import status

from API.services.presupuesto import PLACEHOLDER_PREFIX, build_presupuesto_context
from . import factories as f
from .mixins import BaseAPITestCase


class BuildPresupuestoContextTests(TestCase):
    """Mapeo config → token → importe del servicio en el evento."""

    def setUp(self):
        self.tipo = f.tipo_evento(nombre="Casamiento", template_presupuesto="presupuesto_boda")
        self.evento = f.evento(tipo_evento_obj=self.tipo)
        self.maquillaje = f.servicio(nombre="Maquillaje")
        self.peinado = f.servicio(nombre="Peinado")

    def _config_servicio(self, token, servicio):
        f.configuracion(f"{PLACEHOLDER_PREFIX}{token}", str(servicio.id))

    def test_arma_un_token_por_cada_config_con_el_importe_del_evento(self):
        self._config_servicio("IMPORTE_MKP", self.maquillaje)
        self._config_servicio("IMPORTE_PEINADO", self.peinado)
        f.servicio_evento(self.evento, self.maquillaje, importe="25000.00")
        f.servicio_evento(self.evento, self.peinado, importe="1500.00")

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(
            context,
            {"{{IMPORTE_MKP}}": "$ 25.000.-", "{{IMPORTE_PEINADO}}": "$ 1.500.-"},
        )

    def test_servicio_no_contratado_muestra_solicitar_cotizacion(self):
        self._config_servicio("IMPORTE_MKP", self.maquillaje)

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(context, {"{{IMPORTE_MKP}}": "(Solicitar cotización)"})

    def test_toma_el_importe_mas_alto_si_el_servicio_se_repite_en_el_evento(self):
        self._config_servicio("IMPORTE_MKP", self.maquillaje)
        f.servicio_evento(self.evento, self.maquillaje, importe="10000.00")
        f.servicio_evento(self.evento, self.maquillaje, importe="18000.00")

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(context, {"{{IMPORTE_MKP}}": "$ 18.000.-"})

    def test_ignora_el_importe_de_otros_eventos(self):
        self._config_servicio("IMPORTE_MKP", self.maquillaje)
        otro_evento = f.evento(tipo_evento_obj=self.tipo)
        f.servicio_evento(otro_evento, self.maquillaje, importe="99000.00")

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(context, {"{{IMPORTE_MKP}}": "(Solicitar cotización)"})

    def test_ignora_configs_con_valor_no_numerico(self):
        f.configuracion(f"{PLACEHOLDER_PREFIX}ROTO", "no-es-un-id")
        self._config_servicio("IMPORTE_MKP", self.maquillaje)
        f.servicio_evento(self.evento, self.maquillaje, importe="25000.00")

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(context, {"{{IMPORTE_MKP}}": "$ 25.000.-"})

    def test_ignora_configuraciones_ajenas_al_presupuesto(self):
        f.configuracion("DEFAULT_DIRECCION_EVENTO", "Av. Siempreviva 742")

        context = build_presupuesto_context(self.evento.id)

        self.assertEqual(context, {})

    def test_tipo_de_evento_sin_template_lanza_value_error(self):
        evento = f.evento(tipo_evento_obj=f.tipo_evento(nombre="Cumpleaños"))

        with self.assertRaises(ValueError) as ctx:
            build_presupuesto_context(evento.id)

        self.assertIn("template de presupuesto", str(ctx.exception))

    def test_evento_inexistente_lanza_does_not_exist(self):
        from API.models import Evento

        with self.assertRaises(Evento.DoesNotExist):
            build_presupuesto_context(999999)


class PresupuestoEndpointTests(BaseAPITestCase):
    """El endpoint devuelve el PDF o traduce cualquier error a 400."""

    def setUp(self):
        super().setUp()
        self.tipo = f.tipo_evento(template_presupuesto="presupuesto_boda")
        self.evento = f.evento(tipo_evento_obj=self.tipo)

    def test_devuelve_el_pdf_generado(self):
        with patch(
            "API.views.reports.generate_presupuesto_pdf", return_value=b"%PDF-1.4 fake"
        ) as mock_pdf:
            resp = self.client.get(f"/api/reports/presupuesto/{self.evento.id}/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertEqual(
            resp["Content-Disposition"],
            f'inline; filename="presupuesto_{self.evento.id}.pdf"',
        )
        self.assertEqual(resp.content, b"%PDF-1.4 fake")
        mock_pdf.assert_called_once_with(self.evento.id)

    def test_error_al_generar_devuelve_400(self):
        with patch(
            "API.views.reports.generate_presupuesto_pdf",
            side_effect=FileNotFoundError("Template PDF no encontrado"),
        ):
            resp = self.client.get(f"/api/reports/presupuesto/{self.evento.id}/")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Template PDF no encontrado", resp.data["error"])
