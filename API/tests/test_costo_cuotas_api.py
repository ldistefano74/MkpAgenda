"""
Tarea 2 — Costo con cuotas (`CostoDetailSerializer`).
Tarea 7 — Cuotas pendientes / marcar pagada (`API/views/dashboard.py`).
"""
from datetime import date, timedelta
from decimal import Decimal

from rest_framework import status

from API.models import Costo, CuotaCosto
from . import factories as f
from .mixins import BaseAPITestCase


class CostoConCuotasCreacionTests(BaseAPITestCase):
    """Validación cruzada entre el medio de pago, el importe y las cuotas."""

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo()
        self.con_cuotas = f.medio_pago(descripcion="Tarjeta", incluye_cuotas=True)
        self.sin_cuotas = f.medio_pago(descripcion="Efectivo", incluye_cuotas=False)

    def _payload(self, medio, importe="3000.00", cuotas=None):
        payload = {
            "fecha": "2026-08-01",
            "categoria_costo": self.categoria.id,
            "descripcion": "Compra de insumos",
            "importe": importe,
            "medio_pago": medio.id,
        }
        if cuotas is not None:
            payload["cuotas"] = cuotas
        return payload

    def test_crea_costo_con_cuotas_que_suman_el_importe(self):
        payload = self._payload(self.con_cuotas, importe="3000.00", cuotas=[
            {"numero_cuota": 1, "fecha_vencimiento": "2026-09-01", "importe": "1000.00"},
            {"numero_cuota": 2, "fecha_vencimiento": "2026-10-01", "importe": "1000.00"},
            {"numero_cuota": 3, "fecha_vencimiento": "2026-11-01", "importe": "1000.00"},
        ])

        resp = self.client.post("/api/costos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        costo = Costo.objects.get(pk=resp.data["id"])
        cuotas = costo.cuotas.order_by("numero_cuota")
        self.assertEqual(cuotas.count(), 3)
        self.assertEqual(
            sum(c.importe for c in cuotas), Decimal("3000.00")
        )
        self.assertEqual([c.numero_cuota for c in cuotas], [1, 2, 3])

    def test_suma_de_cuotas_distinta_al_importe_da_400(self):
        payload = self._payload(self.con_cuotas, importe="3000.00", cuotas=[
            {"numero_cuota": 1, "fecha_vencimiento": "2026-09-01", "importe": "1000.00"},
            {"numero_cuota": 2, "fecha_vencimiento": "2026-10-01", "importe": "1000.00"},
        ])

        resp = self.client.post("/api/costos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuotas", resp.data)
        self.assertEqual(Costo.objects.count(), 0)
        self.assertEqual(CuotaCosto.objects.count(), 0)

    def test_medio_con_cuotas_sin_cuotas_da_400(self):
        resp = self.client.post("/api/costos/", self._payload(self.con_cuotas), format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuotas", resp.data)
        self.assertEqual(Costo.objects.count(), 0)

    def test_medio_con_cuotas_y_lista_vacia_da_400(self):
        payload = self._payload(self.con_cuotas, cuotas=[])

        resp = self.client.post("/api/costos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuotas", resp.data)

    def test_medio_sin_cuotas_con_cuotas_enviadas_da_400(self):
        payload = self._payload(self.sin_cuotas, importe="3000.00", cuotas=[
            {"numero_cuota": 1, "fecha_vencimiento": "2026-09-01", "importe": "3000.00"},
        ])

        resp = self.client.post("/api/costos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuotas", resp.data)
        self.assertEqual(Costo.objects.count(), 0)

    def test_medio_sin_cuotas_crea_costo_simple(self):
        resp = self.client.post("/api/costos/", self._payload(self.sin_cuotas), format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        costo = Costo.objects.get(pk=resp.data["id"])
        self.assertEqual(costo.importe, Decimal("3000.00"))
        self.assertEqual(costo.cuotas.count(), 0)


class CostoConCuotasUpdateTests(BaseAPITestCase):
    """Alta, baja y modificación de cuotas al editar un costo."""

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo()
        self.con_cuotas = f.medio_pago(descripcion="Tarjeta", incluye_cuotas=True)
        self.sin_cuotas = f.medio_pago(descripcion="Efectivo", incluye_cuotas=False)
        self.costo = f.costo(
            self.categoria, importe="2000.00", medio_pago=self.con_cuotas, cantidad_cuotas=2
        )
        self.cuota_1 = f.cuota(self.costo, 1, date(2026, 9, 1), "1000.00")
        self.cuota_2 = f.cuota(self.costo, 2, date(2026, 10, 1), "1000.00")

    def _payload(self, medio, importe="2000.00", cuotas=None):
        payload = {
            "fecha": "2026-08-01",
            "categoria_costo": self.categoria.id,
            "descripcion": self.costo.descripcion,
            "importe": importe,
            "medio_pago": medio.id,
        }
        if cuotas is not None:
            payload["cuotas"] = cuotas
        return payload

    def test_cambiar_a_medio_sin_cuotas_limpia_las_cuotas_existentes(self):
        payload = self._payload(self.sin_cuotas)

        resp = self.client.put(f"/api/costos/{self.costo.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(self.costo.cuotas.count(), 0)

    def test_modifica_da_de_alta_y_de_baja_cuotas(self):
        payload = self._payload(self.con_cuotas, importe="2500.00", cuotas=[
            # cuota_1: modificada
            {"id": self.cuota_1.id, "numero_cuota": 1, "fecha_vencimiento": "2026-09-15", "importe": "1500.00"},
            # cuota_2: ausente → se elimina
            # nueva cuota
            {"numero_cuota": 2, "fecha_vencimiento": "2026-11-01", "importe": "1000.00"},
        ])

        resp = self.client.put(f"/api/costos/{self.costo.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.cuota_1.refresh_from_db()
        self.assertEqual(self.cuota_1.importe, Decimal("1500.00"))
        self.assertEqual(self.cuota_1.fecha_vencimiento, date(2026, 9, 15))
        self.assertFalse(CuotaCosto.objects.filter(id=self.cuota_2.id).exists())
        nuevas = self.costo.cuotas.exclude(id=self.cuota_1.id)
        self.assertEqual(nuevas.count(), 1)
        self.assertEqual(nuevas.first().importe, Decimal("1000.00"))
        self.assertEqual(
            sum(c.importe for c in self.costo.cuotas.all()), Decimal("2500.00")
        )

    def test_update_con_cuotas_que_no_suman_el_importe_da_400(self):
        payload = self._payload(self.con_cuotas, importe="2000.00", cuotas=[
            {"id": self.cuota_1.id, "numero_cuota": 1, "fecha_vencimiento": "2026-09-01", "importe": "500.00"},
        ])

        resp = self.client.put(f"/api/costos/{self.costo.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuotas", resp.data)
        self.cuota_1.refresh_from_db()
        self.assertEqual(self.cuota_1.importe, Decimal("1000.00"))
        self.assertEqual(self.costo.cuotas.count(), 2)


class CuotasPendientesTests(BaseAPITestCase):
    """Listado de cuotas por vencer y marcado de pago."""

    URL = "/api/dashboard/cuotas-pendientes/"

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo(nombre="Servicios")
        self.costo = f.costo(self.categoria, importe="3000.00", cantidad_cuotas=3)
        hoy = date.today()
        self.dentro = f.cuota(self.costo, 1, hoy + timedelta(days=1), "1000.00")
        self.fuera = f.cuota(self.costo, 2, hoy + timedelta(days=60), "1000.00")
        self.pagada = f.cuota(self.costo, 3, hoy + timedelta(days=2), "1000.00", pagada=True)

    def test_lista_solo_cuotas_impagas_dentro_de_la_ventana(self):
        resp = self.client.get(self.URL, {"ventana": "30_dias"})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in resp.data]
        self.assertEqual(ids, [self.dentro.id])
        row = resp.data[0]
        self.assertEqual(row["importe"], "1000.00")
        self.assertEqual(row["numero_cuota"], 1)
        self.assertEqual(row["cantidad_cuotas"], 3)
        self.assertEqual(row["categoria_costo_nombre"], "Servicios")
        self.assertEqual(row["costo_id"], self.costo.id)

    def test_incluye_cuotas_vencidas(self):
        vencida = f.cuota(self.costo, 4, date.today() - timedelta(days=10), "500.00")

        resp = self.client.get(self.URL, {"ventana": "30_dias"})

        ids = [row["id"] for row in resp.data]
        self.assertEqual(ids, [vencida.id, self.dentro.id])

    def test_marcar_cuota_pagada(self):
        resp = self.client.post(f"{self.URL}{self.dentro.id}/pagar/")

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.dentro.refresh_from_db()
        self.assertTrue(self.dentro.pagada)

    def test_marcar_cuota_ya_pagada_da_400(self):
        resp = self.client.post(f"{self.URL}{self.pagada.id}/pagar/")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", resp.data)

    def test_marcar_cuota_inexistente_da_404(self):
        resp = self.client.post(f"{self.URL}999999/pagar/")

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
