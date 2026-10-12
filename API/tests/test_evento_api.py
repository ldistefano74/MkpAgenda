"""
Tarea 1 — Evento con servicios anidados (`EventoDetailSerializer`).
Tarea 6 — Conflictos de agenda (`EventoViewSet.check_conflicts`).
"""
from decimal import Decimal

from rest_framework import status

from API.models import Cliente, Evento, ServicioEvento
from . import factories as f
from .mixins import BaseAPITestCase


class EventoCreacionTests(BaseAPITestCase):
    """Alta de eventos con servicios anidados y creación de cliente en línea."""

    def setUp(self):
        super().setUp()
        self.tipo = f.tipo_evento()
        self.servicio_a = f.servicio()
        self.servicio_b = f.servicio()

    def test_crea_evento_con_cliente_existente_y_servicios(self):
        cliente = f.cliente()
        payload = {
            "cliente": cliente.id,
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
            "servicios_evento": [
                {"servicio": self.servicio_a.id, "importe": "1000.00"},
                {"servicio": self.servicio_b.id, "importe": "2500.50"},
            ],
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        evento = Evento.objects.get(pk=resp.data["id"])
        self.assertEqual(evento.cliente_id, cliente.id)
        servicios = evento.servicios_evento.order_by("importe")
        self.assertEqual(servicios.count(), 2)
        self.assertEqual(
            [s.importe for s in servicios],
            [Decimal("1000.00"), Decimal("2500.50")],
        )

    def test_crea_evento_con_nuevo_cliente(self):
        payload = {
            "nuevo_cliente": {"nombre": "Cliente Nuevo", "telefono": "1155667788"},
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        cliente = Cliente.objects.get(telefono="1155667788")
        self.assertEqual(cliente.nombre, "Cliente Nuevo")
        self.assertEqual(Evento.objects.get(pk=resp.data["id"]).cliente_id, cliente.id)

    def test_cliente_y_nuevo_cliente_juntos_da_400(self):
        cliente = f.cliente()
        payload = {
            "cliente": cliente.id,
            "nuevo_cliente": {"nombre": "Otro", "telefono": "1199887766"},
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", resp.data)
        self.assertEqual(Evento.objects.count(), 0)

    def test_sin_cliente_ni_nuevo_cliente_da_400(self):
        payload = {
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", resp.data)
        self.assertEqual(Evento.objects.count(), 0)

    def test_nuevo_cliente_con_telefono_duplicado_no_deja_evento_huerfano(self):
        existente = f.cliente(telefono="1100000001")
        payload = {
            "nuevo_cliente": {"nombre": "Duplicado", "telefono": existente.telefono},
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
            "servicios_evento": [{"servicio": self.servicio_a.id, "importe": "1000.00"}],
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Evento.objects.count(), 0)
        self.assertEqual(ServicioEvento.objects.count(), 0)
        self.assertEqual(Cliente.objects.count(), 1)

    def test_create_invoca_sync_de_google_calendar(self):
        cliente = f.cliente()
        payload = {
            "cliente": cliente.id,
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
        }

        resp = self.client.post("/api/eventos/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.mock_sync.assert_called_once()
        self.assertEqual(self.mock_sync.call_args.args[0].id, resp.data["id"])


class EventoUpdateTests(BaseAPITestCase):
    """Modificación del set de servicios de un evento existente."""

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente()
        self.tipo = f.tipo_evento()
        self.evento = f.evento(self.cliente, self.tipo)
        self.servicio_a = f.servicio()
        self.servicio_b = f.servicio()
        self.se_a = f.servicio_evento(self.evento, self.servicio_a, importe="1000.00")

    def _payload_base(self, servicios):
        return {
            "cliente": self.cliente.id,
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
            "servicios_evento": servicios,
        }

    def test_update_agrega_edita_y_elimina_servicios(self):
        se_b = f.servicio_evento(self.evento, self.servicio_b, importe="500.00")
        payload = self._payload_base([
            # se_a: editado
            {"id": self.se_a.id, "servicio": self.servicio_a.id, "importe": "1800.00"},
            # se_b: ausente → se elimina
            # nuevo servicio
            {"servicio": self.servicio_b.id, "importe": "300.00"},
        ])

        resp = self.client.put(f"/api/eventos/{self.evento.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.se_a.refresh_from_db()
        self.assertEqual(self.se_a.importe, Decimal("1800.00"))
        self.assertFalse(ServicioEvento.objects.filter(id=se_b.id).exists())
        nuevos = ServicioEvento.objects.filter(evento=self.evento).exclude(id=self.se_a.id)
        self.assertEqual(nuevos.count(), 1)
        self.assertEqual(nuevos.first().importe, Decimal("300.00"))

    def test_no_permite_eliminar_servicio_con_movimiento_asociado(self):
        f.movimiento(
            tipo="I",
            importe="500.00",
            cliente=self.cliente,
            evento=self.evento,
            servicio_evento=self.se_a,
        )
        payload = self._payload_base([])

        resp = self.client.put(f"/api/eventos/{self.evento.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("servicios_evento", resp.data)
        self.assertIn(self.servicio_a.nombre, str(resp.data["servicios_evento"]))
        self.assertTrue(ServicioEvento.objects.filter(id=self.se_a.id).exists())

    def test_update_no_permite_dejar_cliente_nulo(self):
        payload = {
            "cliente": None,
            "tipo_evento": self.tipo.id,
            "fecha": "2026-08-01T15:00:00-03:00",
        }

        resp = self.client.put(f"/api/eventos/{self.evento.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", resp.data)

    def test_update_invoca_sync_de_google_calendar(self):
        payload = self._payload_base([
            {"id": self.se_a.id, "servicio": self.servicio_a.id, "importe": "1000.00"},
        ])

        resp = self.client.put(f"/api/eventos/{self.evento.id}/", payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.mock_sync.assert_called_once()

    def test_destroy_invoca_delete_de_google_calendar(self):
        resp = self.client.delete(f"/api/eventos/{self.evento.id}/")

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Evento.objects.filter(id=self.evento.id).exists())
        self.mock_delete.assert_called_once()


class EventoCheckConflictsTests(BaseAPITestCase):
    """Detección de solapamientos de agenda."""

    URL = "/api/eventos/check_conflicts/"

    def setUp(self):
        super().setUp()
        self.tipo = f.tipo_evento(nombre="Casamiento")
        self.cliente = f.cliente(nombre="Ana")
        self.evento = f.evento(
            self.cliente,
            self.tipo,
            fecha=f.fecha_aware(2026, 8, 1, 15, 0),
            duracion="02:00:00",
        )

    def test_detecta_solapamiento_por_fecha_y_duracion(self):
        resp = self.client.get(
            self.URL, {"fecha": "2026-08-01T16:00:00-03:00", "duracion": "01:00:00"}
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["conflicts"], ["Casamiento - Ana"])

    def test_sin_solapamiento_devuelve_lista_vacia(self):
        resp = self.client.get(
            self.URL, {"fecha": "2026-08-01T18:00:00-03:00", "duracion": "01:00:00"}
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["conflicts"], [])

    def test_exclude_id_excluye_el_propio_evento(self):
        resp = self.client.get(
            self.URL,
            {
                "fecha": "2026-08-01T16:00:00-03:00",
                "duracion": "01:00:00",
                "exclude_id": self.evento.id,
            },
        )

        self.assertEqual(resp.data["conflicts"], [])

    def test_sin_duracion_usa_default_de_30_minutos(self):
        # El evento arranca 15:00; una consulta a las 14:45 se solapa sólo si se
        # aplica la duración por defecto de 30 minutos.
        resp = self.client.get(self.URL, {"fecha": "2026-08-01T14:45:00-03:00"})
        self.assertEqual(resp.data["conflicts"], ["Casamiento - Ana"])

        resp = self.client.get(self.URL, {"fecha": "2026-08-01T14:15:00-03:00"})
        self.assertEqual(resp.data["conflicts"], [])

    def test_eventos_cancelados_no_generan_conflicto(self):
        self.evento.estado = "X"
        self.evento.save()

        resp = self.client.get(
            self.URL, {"fecha": "2026-08-01T16:00:00-03:00", "duracion": "01:00:00"}
        )

        self.assertEqual(resp.data["conflicts"], [])

    def test_fecha_invalida_da_400(self):
        resp = self.client.get(self.URL, {"fecha": "no-es-una-fecha"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)

    def test_sin_fecha_devuelve_lista_vacia(self):
        resp = self.client.get(self.URL)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["conflicts"], [])
