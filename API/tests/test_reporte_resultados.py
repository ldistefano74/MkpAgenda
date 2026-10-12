"""
Tarea 4bis — Reporte de resultados (`services/reporte_resultados.py`) vía
`/api/reportes/resultados/` y `/api/reportes/resultados/detalle/`.
"""
from datetime import date

from rest_framework import status

from . import factories as f
from .mixins import BaseAPITestCase


class ReporteResultadosTests(BaseAPITestCase):
    URL = "/api/reportes/resultados/"

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente()
        self.prestador = f.prestador(nombre="Sofía")

        # Agosto 2026
        self.ingreso = f.movimiento(
            tipo="I", importe="1000.00", fecha=date(2026, 8, 5),
            cliente=self.cliente, concepto="Cobro evento",
        )
        self.pago_prestador = f.movimiento(
            tipo="E", importe="300.00", fecha=date(2026, 8, 6),
            prestador=self.prestador, concepto="Pago servicio",
        )
        self.egreso_sin_prestador = f.movimiento(
            tipo="E", importe="200.00", fecha=date(2026, 8, 7),
            cliente=self.cliente, concepto="Reintegro",
        )
        self.costo = f.costo(fecha=date(2026, 8, 8), importe="150.00", descripcion="Insumos")

        # Septiembre 2026
        self.ingreso_sept = f.movimiento(
            tipo="I", importe="500.00", fecha=date(2026, 9, 3),
            cliente=self.cliente, concepto="Cobro septiembre",
        )

    def _por_periodo(self, resp):
        return {r["periodo"]: r for r in resp.data}

    def test_agrupa_por_mes_y_calcula_el_resultado(self):
        resp = self.client.get(self.URL)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([r["periodo"] for r in resp.data], ["2026-08", "2026-09"])
        agosto = self._por_periodo(resp)["2026-08"]
        self.assertEqual(agosto["ingresos"], "1000.00")
        # costos = Costo (150) + egreso sin prestador (200)
        self.assertEqual(agosto["costos"], "350.00")
        self.assertEqual(agosto["pagos"], "300.00")
        self.assertEqual(agosto["resultado"], "350.00")

    def test_egreso_con_prestador_no_contamina_costos(self):
        # Un único egreso con prestador: debe caer sólo en `pagos`.
        self.egreso_sin_prestador.delete()
        self.costo.delete()

        resp = self.client.get(self.URL, {"fecha_desde": "2026-08-01", "fecha_hasta": "2026-08-31"})

        agosto = self._por_periodo(resp)["2026-08"]
        self.assertEqual(agosto["costos"], "0")
        self.assertEqual(agosto["pagos"], "300.00")

    def test_egreso_sin_prestador_no_contamina_pagos(self):
        self.pago_prestador.delete()

        resp = self.client.get(self.URL, {"fecha_desde": "2026-08-01", "fecha_hasta": "2026-08-31"})

        agosto = self._por_periodo(resp)["2026-08"]
        self.assertEqual(agosto["costos"], "350.00")
        self.assertEqual(agosto["pagos"], "0")

    def test_filtros_de_fecha_son_inclusivos(self):
        resp = self.client.get(self.URL, {"fecha_desde": "2026-08-08", "fecha_hasta": "2026-09-03"})

        periodos = self._por_periodo(resp)
        self.assertEqual(sorted(periodos), ["2026-08", "2026-09"])
        # Sólo queda el costo del 08/08 en agosto.
        self.assertEqual(periodos["2026-08"]["ingresos"], "0")
        self.assertEqual(periodos["2026-08"]["costos"], "150.00")
        self.assertEqual(periodos["2026-08"]["resultado"], "-150.00")
        self.assertEqual(periodos["2026-09"]["ingresos"], "500.00")
        self.assertEqual(periodos["2026-09"]["resultado"], "500.00")

    def test_sin_movimientos_devuelve_lista_vacia(self):
        resp = self.client.get(self.URL, {"fecha_desde": "2027-01-01"})

        self.assertEqual(resp.data, [])


class ReporteResultadosDetalleTests(BaseAPITestCase):
    URL = "/api/reportes/resultados/detalle/"

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente()
        self.prestador = f.prestador(nombre="Sofía")
        self.evento = f.evento(self.cliente)
        self.efectivo = f.medio_pago(descripcion="Efectivo")

        self.ingreso = f.movimiento(
            tipo="I", importe="1000.00", fecha=date(2026, 8, 5),
            cliente=self.cliente, evento=self.evento, concepto="Cobro evento",
            medio_pago_cobro=self.efectivo,
        )
        self.pago_prestador = f.movimiento(
            tipo="E", importe="300.00", fecha=date(2026, 8, 6),
            prestador=self.prestador, concepto="Pago servicio",
        )
        self.egreso_sin_prestador = f.movimiento(
            tipo="E", importe="200.00", fecha=date(2026, 8, 7),
            cliente=self.cliente, concepto="Reintegro",
        )
        self.costo = f.costo(fecha=date(2026, 8, 7), importe="150.00", descripcion="Insumos")
        # Fuera del período consultado
        f.movimiento(
            tipo="I", importe="999.00", fecha=date(2026, 9, 1),
            cliente=self.cliente, concepto="Otro mes",
        )

    def test_detalle_de_ingresos(self):
        resp = self.client.get(self.URL, {"periodo": "2026-08", "tipo": "ingresos"})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        fila = resp.data[0]
        self.assertEqual(fila["id"], self.ingreso.id)
        self.assertEqual(fila["origen"], "movimiento")
        self.assertEqual(fila["concepto"], "Cobro evento")
        self.assertEqual(fila["importe"], "1000.00")
        self.assertEqual(fila["medio_pago_cobro_nombre"], "Efectivo")
        self.assertEqual(fila["evento_id"], self.evento.id)

    def test_detalle_de_pagos_prefija_el_nombre_del_prestador(self):
        resp = self.client.get(self.URL, {"periodo": "2026-08", "tipo": "pagos"})

        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["concepto"], "(Sofía) Pago servicio")
        self.assertEqual(resp.data[0]["importe"], "300.00")

    def test_detalle_de_costos_combina_egresos_y_costos_ordenados(self):
        resp = self.client.get(self.URL, {"periodo": "2026-08", "tipo": "costos"})

        self.assertEqual(len(resp.data), 2)
        # Misma fecha (07/08): desempata `origen` ('costo' antes que 'movimiento').
        self.assertEqual(
            [(r["origen"], r["id"]) for r in resp.data],
            [("costo", self.costo.id), ("movimiento", self.egreso_sin_prestador.id)],
        )
        self.assertEqual(resp.data[0]["concepto"], "Insumos")
        self.assertEqual(resp.data[1]["concepto"], "Reintegro")

    def test_tipo_invalido_da_400(self):
        resp = self.client.get(self.URL, {"periodo": "2026-08", "tipo": "otros"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)

    def test_sin_periodo_da_400(self):
        resp = self.client.get(self.URL, {"tipo": "ingresos"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)
