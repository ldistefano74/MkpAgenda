"""
Costos imputados a un evento (solapa "Costos" de `EventoForm`).

Cubre el filtro `/api/costos/?evento=<id>`, los campos que la grilla embebida
necesita para listar y editar, el alta/edición/baja desde la solapa y el filtro
`incluye_cuotas` del lookup de medios de pago que usa ese formulario.
"""
from decimal import Decimal

from rest_framework import status

from API.models import Costo
from . import factories as f
from .mixins import BaseAPITestCase


class CostosPorEventoListTests(BaseAPITestCase):
    """`/api/costos/?evento=<id>` acota el listado al evento pedido."""

    URL = "/api/costos/"

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo(nombre="Insumos")
        self.evento = f.evento()
        self.otro_evento = f.evento()
        self.del_evento = f.costo(self.categoria, evento=self.evento, importe="1500.00")
        self.del_otro_evento = f.costo(self.categoria, evento=self.otro_evento, importe="700.00")
        self.sin_evento = f.costo(self.categoria, importe="300.00")

    def _ids(self, resp):
        return {row["id"] for row in resp.data}

    def test_filtra_por_evento(self):
        resp = self.client.get(self.URL, {"evento": self.evento.id})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(self._ids(resp), {self.del_evento.id})

    def test_excluye_costos_de_otros_eventos_y_sin_evento(self):
        resp = self.client.get(self.URL, {"evento": self.evento.id})

        self.assertNotIn(self.del_otro_evento.id, self._ids(resp))
        self.assertNotIn(self.sin_evento.id, self._ids(resp))

    def test_evento_sin_costos_devuelve_lista_vacia(self):
        vacio = f.evento()

        resp = self.client.get(self.URL, {"evento": vacio.id})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(list(resp.data), [])

    def test_sin_filtro_devuelve_todos_los_costos(self):
        resp = self.client.get(self.URL)

        self.assertEqual(
            self._ids(resp),
            {self.del_evento.id, self.del_otro_evento.id, self.sin_evento.id},
        )


class CostoListSerializerCamposTests(BaseAPITestCase):
    """El listado expone lo que la grilla muestra y lo que el modal necesita para editar."""

    URL = "/api/costos/"

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo(nombre="Insumos")
        self.medio = f.medio_pago(descripcion="Efectivo", incluye_cuotas=False)
        self.proveedor = f.proveedor(nombre="Proveedor SA")
        self.evento = f.evento()
        self.costo = f.costo(
            self.categoria,
            evento=self.evento,
            medio_pago=self.medio,
            proveedor=self.proveedor,
            descripcion="Traslado",
            importe="1500.00",
        )

    def _row(self):
        resp = self.client.get(self.URL, {"evento": self.evento.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.data[0]

    def test_incluye_las_columnas_de_la_grilla(self):
        row = self._row()

        self.assertEqual(row["fecha"], "2026-08-01")
        self.assertEqual(row["categoria_costo_nombre"], "Insumos")
        self.assertEqual(row["descripcion"], "Traslado")
        self.assertEqual(Decimal(row["importe"]), Decimal("1500.00"))

    def test_incluye_los_ids_de_relacion_para_poder_editar(self):
        row = self._row()

        self.assertEqual(row["categoria_costo"], self.categoria.id)
        self.assertEqual(row["medio_pago"], self.medio.id)
        self.assertEqual(row["proveedor"], self.proveedor.id)
        self.assertEqual(row["evento"], self.evento.id)

    def test_relaciones_opcionales_vacias_vienen_en_null(self):
        f.costo(self.categoria, evento=self.evento, descripcion="Sin medio ni proveedor")

        resp = self.client.get(self.URL, {"evento": self.evento.id})
        row = next(r for r in resp.data if r["descripcion"] == "Sin medio ni proveedor")

        self.assertIsNone(row["medio_pago"])
        self.assertIsNone(row["proveedor"])
        self.assertIsNone(row["medio_pago_nombre"])
        self.assertIsNone(row["proveedor_nombre"])


class CostoDesdeEventoCRUDTests(BaseAPITestCase):
    """Alta, edición y baja de costos tal como los emite la solapa del evento."""

    URL = "/api/costos/"

    def setUp(self):
        super().setUp()
        self.categoria = f.categoria_costo(nombre="Insumos")
        self.medio = f.medio_pago(descripcion="Efectivo", incluye_cuotas=False)
        self.evento = f.evento()

    def _payload(self, **extra):
        payload = {
            "fecha": "2026-08-01",
            "categoria_costo": self.categoria.id,
            "descripcion": "Traslado",
            "importe": "1500.00",
            "medio_pago": self.medio.id,
            "proveedor": None,
            "evento": self.evento.id,
        }
        payload.update(extra)
        return payload

    def test_crea_el_costo_asociado_al_evento(self):
        resp = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        costo = Costo.objects.get(pk=resp.data["id"])
        self.assertEqual(costo.evento_id, self.evento.id)
        self.assertEqual(costo.importe, Decimal("1500.00"))
        self.assertEqual(costo.cuotas.count(), 0)

    def test_crea_el_costo_sin_medio_de_pago_ni_proveedor(self):
        resp = self.client.post(self.URL, self._payload(medio_pago=None), format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        costo = Costo.objects.get(pk=resp.data["id"])
        self.assertIsNone(costo.medio_pago)
        self.assertIsNone(costo.proveedor)

    def test_sin_categoria_da_400(self):
        resp = self.client.post(self.URL, self._payload(categoria_costo=None), format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("categoria_costo", resp.data)
        self.assertEqual(Costo.objects.count(), 0)

    def test_edita_el_costo_conservando_el_evento(self):
        costo = f.costo(self.categoria, evento=self.evento, importe="1500.00")

        resp = self.client.put(
            f"{self.URL}{costo.id}/",
            self._payload(descripcion="Traslado ida y vuelta", importe="2000.00"),
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        costo.refresh_from_db()
        self.assertEqual(costo.descripcion, "Traslado ida y vuelta")
        self.assertEqual(costo.importe, Decimal("2000.00"))
        self.assertEqual(costo.evento_id, self.evento.id)

    def test_elimina_el_costo(self):
        costo = f.costo(self.categoria, evento=self.evento)

        resp = self.client.delete(f"{self.URL}{costo.id}/")

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Costo.objects.filter(id=costo.id).exists())


class LookupMedioPagoIncluyeCuotasTests(BaseAPITestCase):
    """
    La solapa del evento sólo ofrece medios sin cuotas: el alta de cuotas vive
    en el formulario general de Costos.
    """

    URL = "/api/lookup/mediopagocobro/"

    def setUp(self):
        super().setUp()
        self.sin_cuotas = f.medio_pago(descripcion="Efectivo", incluye_cuotas=False)
        self.con_cuotas = f.medio_pago(descripcion="Tarjeta", incluye_cuotas=True)

    def test_filtra_los_medios_que_incluyen_cuotas(self):
        resp = self.client.get(self.URL, {"incluye_cuotas": "false"})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [["Efectivo", self.sin_cuotas.id]])

    def test_combina_con_disponible_pago(self):
        f.medio_pago(descripcion="Solo cobro", incluye_cuotas=False, disponible_pago=False)

        resp = self.client.get(self.URL, {"disponible_pago": "true", "incluye_cuotas": "false"})

        self.assertEqual(resp.data, [["Efectivo", self.sin_cuotas.id]])

    def test_sin_filtro_devuelve_todos(self):
        resp = self.client.get(self.URL)

        self.assertEqual(
            {row[1] for row in resp.data},
            {self.sin_cuotas.id, self.con_cuotas.id},
        )
