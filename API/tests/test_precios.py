"""
Tarea 5 — Resolución de precios (`services/precios.py`), contra la DB real.
Se testean las funciones directamente y también los lookups HTTP que las exponen.
"""
from decimal import Decimal

from django.test import TestCase
from rest_framework import status

from API.services.precios import get_precio_prestador, get_precio_servicio
from . import factories as f
from .mixins import BaseAPITestCase


class GetPrecioServicioTests(TestCase):
    """Cascada: PreciosServicio(servicio, tipo_evento) → precio_referencia → None."""

    def setUp(self):
        self.tipo = f.tipo_evento()
        self.otro_tipo = f.tipo_evento()

    def test_usa_el_precio_del_tipo_de_evento(self):
        servicio = f.servicio(precio_referencia=Decimal("100.00"))
        f.precio_servicio(servicio, self.tipo, "250.00")

        self.assertEqual(get_precio_servicio(servicio.id, self.tipo.id), Decimal("250.00"))

    def test_cae_al_precio_de_referencia_si_no_hay_precio_para_ese_tipo(self):
        servicio = f.servicio(precio_referencia=Decimal("100.00"))
        f.precio_servicio(servicio, self.otro_tipo, "250.00")

        self.assertEqual(get_precio_servicio(servicio.id, self.tipo.id), Decimal("100.00"))

    def test_sin_tipo_de_evento_usa_el_precio_de_referencia(self):
        servicio = f.servicio(precio_referencia=Decimal("100.00"))
        f.precio_servicio(servicio, self.tipo, "250.00")

        self.assertEqual(get_precio_servicio(servicio.id, None), Decimal("100.00"))

    def test_sin_precio_de_referencia_devuelve_none(self):
        servicio = f.servicio()

        self.assertIsNone(get_precio_servicio(servicio.id, self.tipo.id))

    def test_servicio_inexistente_devuelve_none(self):
        self.assertIsNone(get_precio_servicio(999999, self.tipo.id))


class GetPrecioPrestadorTests(TestCase):
    """Cascada: tipo_evento exacto → tipo_evento nulo → None (sin fallback al servicio)."""

    def setUp(self):
        self.tipo = f.tipo_evento()
        self.prestador = f.prestador()
        self.servicio = f.servicio(precio_referencia=Decimal("999.00"))

    def test_prefiere_el_match_exacto_por_tipo_de_evento(self):
        f.servicio_prestador(self.prestador, self.servicio, None, "100.00")
        f.servicio_prestador(self.prestador, self.servicio, self.tipo, "200.00")

        precio = get_precio_prestador(self.prestador.id, self.servicio.id, self.tipo.id)

        self.assertEqual(precio, Decimal("200.00"))

    def test_cae_al_registro_con_tipo_de_evento_nulo(self):
        otro_tipo = f.tipo_evento()
        f.servicio_prestador(self.prestador, self.servicio, None, "100.00")
        f.servicio_prestador(self.prestador, self.servicio, otro_tipo, "200.00")

        precio = get_precio_prestador(self.prestador.id, self.servicio.id, self.tipo.id)

        self.assertEqual(precio, Decimal("100.00"))

    def test_ignora_registros_sin_precio_de_referencia(self):
        f.servicio_prestador(self.prestador, self.servicio, self.tipo, None)
        f.servicio_prestador(self.prestador, self.servicio, None, "100.00")

        precio = get_precio_prestador(self.prestador.id, self.servicio.id, self.tipo.id)

        self.assertEqual(precio, Decimal("100.00"))

    def test_sin_registros_devuelve_none_sin_caer_al_precio_del_servicio(self):
        precio = get_precio_prestador(self.prestador.id, self.servicio.id, self.tipo.id)

        self.assertIsNone(precio)

    def test_no_toma_el_precio_de_otro_prestador(self):
        otro = f.prestador()
        f.servicio_prestador(otro, self.servicio, self.tipo, "500.00")

        precio = get_precio_prestador(self.prestador.id, self.servicio.id, self.tipo.id)

        self.assertIsNone(precio)


class PreciosLookupTests(BaseAPITestCase):
    """Los lookups HTTP que exponen la resolución de precios al frontend."""

    def setUp(self):
        super().setUp()
        self.tipo = f.tipo_evento()
        self.servicio = f.servicio(precio_referencia=Decimal("100.00"))
        self.prestador = f.prestador()

    def test_lookup_precio_servicio(self):
        f.precio_servicio(self.servicio, self.tipo, "250.00")

        resp = self.client.get(
            "/api/lookup/precioservicio/",
            {"servicio": self.servicio.id, "tipo_evento": self.tipo.id},
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {"precio": "250.00"})

    def test_lookup_precio_servicio_sin_servicio_devuelve_none(self):
        resp = self.client.get("/api/lookup/precioservicio/")

        self.assertEqual(resp.data, {"precio": None})

    def test_lookup_precio_prestador(self):
        f.servicio_prestador(self.prestador, self.servicio, self.tipo, "180.00")

        resp = self.client.get(
            "/api/lookup/precioprestador/",
            {
                "prestador": self.prestador.id,
                "servicio": self.servicio.id,
                "tipo_evento": self.tipo.id,
            },
        )

        self.assertEqual(resp.data, {"precio": "180.00"})

    def test_lookup_precio_prestador_sin_datos_devuelve_none(self):
        resp = self.client.get(
            "/api/lookup/precioprestador/",
            {"prestador": self.prestador.id, "servicio": self.servicio.id},
        )

        self.assertEqual(resp.data, {"precio": None})
