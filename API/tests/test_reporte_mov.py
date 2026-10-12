"""
Tarea 4 — Reporte de movimientos (`services/reporte_movimientos.py`)
vía `/api/reportes/movimientos/`.
"""
from datetime import date

from rest_framework import status

from . import factories as f
from .mixins import BaseAPITestCase


class ReporteMovimientosTests(BaseAPITestCase):
    URL = "/api/reportes/movimientos/"

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente()
        self.prestador = f.prestador()
        self.efectivo = f.medio_pago(descripcion="Efectivo")
        self.transferencia = f.medio_pago(descripcion="Transferencia")
        self.evento = f.evento(self.cliente)

        self.cobro = f.movimiento(
            tipo="I", importe="1000.00", fecha=date(2026, 8, 5),
            cliente=self.cliente, evento=self.evento, concepto="Seña",
            medio_pago_cobro=self.efectivo,
        )
        self.costo = f.costo(
            fecha=date(2026, 8, 7), importe="300.00", descripcion="Insumos",
            medio_pago=self.transferencia,
        )
        self.pago = f.movimiento(
            tipo="E", importe="500.00", fecha=date(2026, 8, 10),
            prestador=self.prestador, concepto="Pago prestador",
            medio_pago_cobro=self.transferencia,
        )

    def _claves(self, resp):
        return [(r["origen"], r["id"]) for r in resp.data]

    def test_sin_filtros_unifica_las_tres_fuentes_ordenadas_por_fecha(self):
        resp = self.client.get(self.URL)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._claves(resp),
            [("movimiento", self.cobro.id), ("costo", self.costo.id), ("movimiento", self.pago.id)],
        )
        self.assertEqual(
            [r["tipo"] for r in resp.data], ["I", "C", "E"]
        )
        self.assertEqual(
            [r["tipo_display"] for r in resp.data], ["Cobro", "Costo", "Pago"]
        )

    def test_fila_de_cobro_trae_los_valores_del_movimiento(self):
        resp = self.client.get(self.URL, {"tipo": "I"})

        fila = resp.data[0]
        self.assertEqual(fila["importe"], "1000.00")
        self.assertEqual(fila["concepto"], "Seña")
        self.assertEqual(fila["medio_pago_cobro_nombre"], "Efectivo")
        self.assertEqual(fila["fecha"], "2026-08-05")
        self.assertEqual(fila["evento_id"], self.evento.id)

    def test_fila_de_costo_usa_la_descripcion_como_concepto(self):
        resp = self.client.get(self.URL, {"tipo": "C"})

        fila = resp.data[0]
        self.assertEqual(fila["origen"], "costo")
        self.assertEqual(fila["concepto"], "Insumos")
        self.assertEqual(fila["importe"], "300.00")
        self.assertEqual(fila["medio_pago_cobro_nombre"], "Transferencia")

    def test_filtro_tipo_ingreso_excluye_costos_y_pagos(self):
        resp = self.client.get(self.URL, {"tipo": "I"})

        self.assertEqual(self._claves(resp), [("movimiento", self.cobro.id)])

    def test_filtro_tipo_egreso_excluye_costos_y_cobros(self):
        resp = self.client.get(self.URL, {"tipo": "E"})

        self.assertEqual(self._claves(resp), [("movimiento", self.pago.id)])

    def test_filtro_tipo_costo_devuelve_solo_costos(self):
        resp = self.client.get(self.URL, {"tipo": "C"})

        self.assertEqual(self._claves(resp), [("costo", self.costo.id)])

    def test_fecha_desde_es_inclusiva(self):
        resp = self.client.get(self.URL, {"fecha_desde": "2026-08-07"})

        self.assertEqual(
            self._claves(resp),
            [("costo", self.costo.id), ("movimiento", self.pago.id)],
        )

    def test_fecha_hasta_es_inclusiva(self):
        resp = self.client.get(self.URL, {"fecha_hasta": "2026-08-07"})

        self.assertEqual(
            self._claves(resp),
            [("movimiento", self.cobro.id), ("costo", self.costo.id)],
        )

    def test_filtro_medio_pago_cobro_aplica_a_movimientos_y_costos(self):
        resp = self.client.get(self.URL, {"medio_pago_cobro": self.transferencia.id})

        self.assertEqual(
            self._claves(resp),
            [("costo", self.costo.id), ("movimiento", self.pago.id)],
        )

    def test_combina_rango_de_fechas_y_tipo(self):
        resp = self.client.get(
            self.URL, {"fecha_desde": "2026-08-06", "fecha_hasta": "2026-08-09", "tipo": "C"}
        )

        self.assertEqual(self._claves(resp), [("costo", self.costo.id)])
