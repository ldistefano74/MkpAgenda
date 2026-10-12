"""
Recordatorio de eventos — `services/recordatorio.py` y
`/api/eventos/<id>/recordatorio/` (GET arma el mensaje, POST lo marca enviado).
"""
from datetime import timedelta
from urllib.parse import quote

from django.test import TestCase
from django.utils import timezone
from rest_framework import status

from API import config
from API.models import Configuracion, Evento
from API.services.recordatorio import (
    MENSAJE_DEFAULT,
    build_mensaje_recordatorio,
    build_whatsapp_url,
)
from . import factories as f
from .mixins import BaseAPITestCase


def _fecha_en_dias(dias, hora=18):
    """DateTime aware ubicado `dias` días después de hoy, a la hora indicada."""
    fecha = timezone.localtime(timezone.now()) + timedelta(days=dias)
    return fecha.replace(hour=hora, minute=0, second=0, microsecond=0)


def _plantilla(valor):
    """Fija MENSAJE_RECORDATORIO (la migración de datos ya crea la fila)."""
    Configuracion.objects.update_or_create(
        clave=config.MENSAJE_RECORDATORIO, defaults={'valor': valor}
    )


class BuildMensajeRecordatorioTests(TestCase):
    """Reemplazo de tags y formato relativo de la fecha."""

    def setUp(self):
        self.cliente = f.cliente(nombre="Ana", telefono="2235550000")
        self.tipo = f.tipo_evento(nombre="Casamiento")

    def _evento(self, dias=5, **kwargs):
        return f.evento(
            cliente_obj=self.cliente,
            tipo_evento_obj=self.tipo,
            fecha=_fecha_en_dias(dias),
            **kwargs,
        )

    def test_reemplaza_todos_los_tags_de_la_plantilla(self):
        evento = self._evento(direccion_servicios="Av. Colón 1234")
        f.servicio_evento(evento, f.servicio(nombre="Maquillaje"))
        _plantilla("{{CLIENTE}}|{{TIPO_EVENTO}}|{{FECHA}}|{{HORA}}|{{DIRECCION}}|{{SERVICIOS}}")

        partes = build_mensaje_recordatorio(evento).split('|')

        self.assertEqual(partes[0], "Ana")
        self.assertEqual(partes[1], "casamiento")
        self.assertEqual(partes[3], "18:00")
        self.assertEqual(partes[4], "Av. Colón 1234")
        self.assertEqual(partes[5], "- Maquillaje")

    def test_fecha_de_manana_se_escribe_manana(self):
        _plantilla("{{FECHA}}")
        self.assertEqual(build_mensaje_recordatorio(self._evento(dias=1)), "mañana")

    def test_fecha_de_hoy_se_escribe_hoy(self):
        _plantilla("{{FECHA}}")
        self.assertEqual(build_mensaje_recordatorio(self._evento(dias=0)), "hoy")

    def test_fecha_lejana_usa_dia_de_semana_y_fecha(self):
        _plantilla("{{FECHA}}")
        evento = self._evento(dias=10)
        esperado = timezone.localtime(evento.fecha).strftime('%d/%m')

        mensaje = build_mensaje_recordatorio(evento)

        self.assertTrue(mensaje.startswith("el "))
        self.assertTrue(mensaje.endswith(esperado))

    def test_agrupa_servicios_repetidos_y_omite_los_inactivos(self):
        evento = self._evento()
        maquillaje = f.servicio(nombre="Maquillaje")
        f.servicio_evento(evento, maquillaje)
        f.servicio_evento(evento, maquillaje)
        f.servicio_evento(evento, f.servicio(nombre="Peinado"), activo=False)
        _plantilla("{{SERVICIOS}}")

        self.assertEqual(build_mensaje_recordatorio(evento), "- Maquillaje (x2)")

    def test_lista_cada_servicio_en_una_linea(self):
        evento = self._evento()
        f.servicio_evento(evento, f.servicio(nombre="Maquillaje"))
        f.servicio_evento(evento, f.servicio(nombre="Peinado"))
        _plantilla("{{SERVICIOS}}")

        self.assertEqual(build_mensaje_recordatorio(evento), "- Maquillaje\n- Peinado")

    def test_sin_config_cae_en_el_mensaje_por_defecto_del_servicio(self):
        Configuracion.objects.filter(clave=config.MENSAJE_RECORDATORIO).delete()

        mensaje = build_mensaje_recordatorio(self._evento())

        self.assertIn("Ana", mensaje)
        self.assertNotIn("{{", mensaje)
        self.assertTrue(MENSAJE_DEFAULT.startswith(mensaje.split('Ana')[0]))


class BuildWhatsAppUrlTests(TestCase):

    def test_agrega_el_prefijo_54_y_codifica_el_mensaje(self):
        url = build_whatsapp_url("223 555-0000", "Hola Ana")

        self.assertEqual(url, f"https://wa.me/542235550000?text={quote('Hola Ana')}")

    def test_no_duplica_el_prefijo_54(self):
        self.assertTrue(build_whatsapp_url("542235550000", "x").startswith("https://wa.me/542235550000"))

    def test_sin_telefono_devuelve_none(self):
        self.assertIsNone(build_whatsapp_url("", "x"))
        self.assertIsNone(build_whatsapp_url(None, "x"))


class RecordatorioAPITests(BaseAPITestCase):
    """Endpoint `/api/eventos/<id>/recordatorio/`."""

    def setUp(self):
        super().setUp()
        self.evento = f.evento(fecha=_fecha_en_dias(1))

    def test_get_devuelve_mensaje_y_link_de_whatsapp(self):
        response = self.client.get(f"/api/eventos/{self.evento.id}/recordatorio/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("mañana", response.data['mensaje'])
        self.assertTrue(response.data['whatsapp_url'].startswith("https://wa.me/"))
        self.assertIsNone(response.data['recordatorio_enviado'])

    def test_get_sin_telefono_del_cliente_devuelve_400(self):
        self.evento.cliente.telefono = ""
        self.evento.cliente.save()

        response = self.client.get(f"/api/eventos/{self.evento.id}/recordatorio/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_sella_la_fecha_de_envio(self):
        response = self.client.post(f"/api/eventos/{self.evento.id}/recordatorio/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.evento.refresh_from_db()
        self.assertIsNotNone(self.evento.recordatorio_enviado)

    def test_el_campo_es_read_only_en_el_detalle_del_evento(self):
        response = self.client.patch(
            f"/api/eventos/{self.evento.id}/",
            {'recordatorio_enviado': timezone.now().isoformat()},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(Evento.objects.get(id=self.evento.id).recordatorio_enviado)
