"""
Tarea 8 — Endpoints de metadata / new / lookup.
Tarea 9 — Ciclo CRUD genérico de las entidades principales.
"""
from datetime import date
from decimal import Decimal

from rest_framework import status

from API import config
from API.models import CategoriaCosto, Cliente, Proveedor, Servicio
from . import factories as f
from .mixins import BaseAPITestCase


class MetadataTests(BaseAPITestCase):
    """Smoke de `/api/metadata/<serializer>/`."""

    def _campos(self, resp):
        return {campo["name"] for campo in resp.data["fields"]}

    def test_metadata_de_serializer_autogenerado(self):
        resp = self.client.get("/api/metadata/cliente/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["app_label"], "API")
        self.assertEqual(resp.data["model"], "Cliente")
        self.assertIn("nombre", self._campos(resp))
        self.assertIn("telefono", self._campos(resp))

    def test_metadata_expande_relaciones_anidadas(self):
        resp = self.client.get("/api/metadata/eventodetailserializer/", {"depth": "1"})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        servicios = next(
            campo for campo in resp.data["fields"] if campo["name"] == "servicios_evento"
        )
        self.assertEqual(servicios["type"], "ReverseRelation")
        self.assertEqual(servicios["related_model"], "servicioevento")
        self.assertIn("importe", {c["name"] for c in servicios["fields"]})

    def test_metadata_incluye_choices_y_mascaras(self):
        resp = self.client.get("/api/metadata/cliente/")

        campos = {campo["name"]: campo for campo in resp.data["fields"]}
        self.assertIn("choices", campos["condicion_fiscal"])
        self.assertEqual(campos["cuit_cuil"]["input_mask"], "99-99999999-9")

    def test_metadata_de_serializer_inexistente_da_404(self):
        resp = self.client.get("/api/metadata/noexiste/")

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class NewInstanceTests(BaseAPITestCase):
    """Smoke de `/api/new/<serializer>/`."""

    def test_new_devuelve_defaults_y_omite_read_only(self):
        resp = self.client.get("/api/new/cliente/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn("id", resp.data)
        self.assertIsNone(resp.data["nombre"])
        self.assertEqual(resp.data["condicion_fiscal"], "CF")
        self.assertFalse(resp.data["favorito"])

    def test_new_de_evento_toma_la_direccion_default_de_configuracion(self):
        f.configuracion(config.DEFAULT_DIRECCION_EVENTO, "Av. Siempreviva 742")

        resp = self.client.get("/api/new/eventodetailserializer/")

        self.assertEqual(resp.data["direccion_servicios"], "Av. Siempreviva 742")
        self.assertEqual(resp.data["estado"], "P")
        self.assertEqual(resp.data["servicios_evento"], [])

    def test_new_de_serializer_inexistente_da_404(self):
        resp = self.client.get("/api/new/noexiste/")

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class LookupTests(BaseAPITestCase):
    """Smoke de `/api/lookup/<name>/` y caso especial de `costorecurrente`."""

    def test_lookup_devuelve_pares_label_id(self):
        cliente = f.cliente(nombre="Ana")

        resp = self.client.get("/api/lookup/cliente/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [["Ana", cliente.id]])

    def test_lookup_aplica_filtros_permitidos(self):
        activo = f.servicio(nombre="Maquillaje", activo=True)
        f.servicio(nombre="Peinado", activo=False)

        resp = self.client.get("/api/lookup/servicio/", {"activo": "true"})

        self.assertEqual(resp.data, [["Maquillaje", activo.id]])

    def test_lookup_con_extra_fields(self):
        servicio = f.servicio(nombre="Maquillaje", precio_referencia=Decimal("500.00"))

        resp = self.client.get("/api/lookup/servicio/", {"extra_fields": "precio_referencia"})

        self.assertEqual(resp.data, [["Maquillaje", servicio.id, Decimal("500.00")]])

    def test_lookup_eventos_pendientes_cobro_solo_ofrece_confirmados(self):
        """El cargo sale de vw_cuenta_corriente, que sólo emite confirmados:
        para imputarle una seña a un evento hay que confirmarlo antes."""
        cliente = f.cliente(nombre="Ana")
        tipo = f.tipo_evento(nombre="Casamiento")
        servicio = f.servicio(nombre="Maquillaje")
        confirmado = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")
        f.servicio_evento(confirmado, servicio, importe="1000.00")
        for estado in ("P", "X"):
            otro = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 9, 1), estado=estado)
            f.servicio_evento(otro, servicio, importe="1000.00")

        resp = self.client.get("/api/lookup/eventospendientescobro/", {"cliente": cliente.id})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([fila[1] for fila in resp.data], [confirmado.id])
        self.assertEqual(resp.data[0][2], Decimal("1000.00"))

    def test_lookup_eventos_pendientes_cobro_descuenta_lo_ya_cobrado(self):
        cliente = f.cliente(nombre="Ana")
        tipo = f.tipo_evento(nombre="Casamiento")
        evento = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")
        f.servicio_evento(evento, f.servicio(nombre="Maquillaje"), importe="1000.00")
        f.movimiento(
            tipo="I", importe="400.00", cliente=cliente, evento=evento,
            fecha=date(2026, 8, 2), concepto="Seña",
        )

        resp = self.client.get("/api/lookup/eventospendientescobro/", {"cliente": cliente.id})

        self.assertEqual(resp.data[0][2], Decimal("600.00"))

    def test_lookup_servicios_pendientes_pago_solo_ofrece_confirmados(self):
        """Espejo del de cobros: para pagarle al prestador el evento tiene que
        estar confirmado, que es cuando la vista emite el cargo."""
        cliente = f.cliente(nombre="Ana")
        tipo = f.tipo_evento(nombre="Casamiento")
        prestador = f.prestador(nombre="Sofía")
        confirmado = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")
        esperado = f.servicio_evento(
            confirmado, f.servicio(nombre="Maquillaje"),
            importe="1000.00", prestador=prestador, importe_prestador="500.00",
        )
        for estado in ("P", "X"):
            otro = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 9, 1), estado=estado)
            f.servicio_evento(
                otro, f.servicio(nombre=f"Peinado {estado}"),
                importe="800.00", prestador=prestador, importe_prestador="400.00",
            )

        resp = self.client.get("/api/lookup/serviciospendientespago/", {"prestador": prestador.id})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([fila[1] for fila in resp.data], [esperado.id])
        self.assertEqual(resp.data[0][2], Decimal("500.00"))

    def test_lookup_servicios_pendientes_pago_descuenta_lo_ya_pagado(self):
        cliente = f.cliente(nombre="Ana")
        tipo = f.tipo_evento(nombre="Casamiento")
        prestador = f.prestador(nombre="Sofía")
        evento = f.evento(cliente, tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")
        se = f.servicio_evento(
            evento, f.servicio(nombre="Maquillaje"),
            importe="1000.00", prestador=prestador, importe_prestador="500.00",
        )
        f.movimiento(
            tipo="E", importe="200.00", prestador=prestador, servicio_evento=se,
            fecha=date(2026, 8, 5), concepto="Pago a cuenta",
        )

        resp = self.client.get("/api/lookup/serviciospendientespago/", {"prestador": prestador.id})

        self.assertEqual(resp.data[0][2], Decimal("300.00"))

    def test_lookup_inexistente_da_404(self):
        resp = self.client.get("/api/lookup/noexiste/")

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_costorecurrente_trae_los_datos_del_ultimo_costo(self):
        categoria = f.categoria_costo()
        otra_categoria = f.categoria_costo()
        proveedor = f.proveedor()
        medio = f.medio_pago()
        recurrente = f.costo_recurrente(categoria, nombre="Alquiler")

        f.costo(
            categoria, costo_recurrente=recurrente, fecha=date(2026, 7, 1),
            importe="1000.00", descripcion="Alquiler julio",
        )
        f.costo(
            otra_categoria, costo_recurrente=recurrente, fecha=date(2026, 8, 1),
            importe="1200.00", descripcion="Alquiler agosto",
            medio_pago=medio, proveedor=proveedor,
        )

        resp = self.client.get("/api/lookup/costorecurrente/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp.data,
            [[
                "Alquiler", recurrente.id,
                otra_categoria.id, "1200.00", medio.id, proveedor.id, "Alquiler agosto",
            ]],
        )

    def test_lookup_costorecurrente_sin_costos_devuelve_extras_nulos(self):
        recurrente = f.costo_recurrente(nombre="Internet")

        resp = self.client.get("/api/lookup/costorecurrente/")

        self.assertEqual(resp.data, [["Internet", recurrente.id, None, None, None, None, None]])


class CRUDGenericoTests(BaseAPITestCase):
    """Ciclo create → retrieve → update → delete sobre los serializers autogenerados."""

    def _ciclo(self, url, payload, cambio, modelo, campo):
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        pk = resp.data["id"]

        resp = self.client.get(f"{url}{pk}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data[campo], payload[campo])

        resp = self.client.patch(f"{url}{pk}/", cambio, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(modelo.objects.get(pk=pk).__dict__[campo], cambio[campo])

        resp = self.client.delete(f"{url}{pk}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(modelo.objects.filter(pk=pk).exists())

    def test_ciclo_completo_de_cliente(self):
        self._ciclo(
            "/api/clientes/",
            {"nombre": "Ana", "telefono": "1122334455"},
            {"nombre": "Ana María"},
            Cliente, "nombre",
        )

    def test_ciclo_completo_de_servicio(self):
        self._ciclo(
            "/api/servicios/",
            {"nombre": "Maquillaje"},
            {"nombre": "Maquillaje social"},
            Servicio, "nombre",
        )

    def test_ciclo_completo_de_proveedor(self):
        self._ciclo(
            "/api/proveedores/",
            {"nombre": "Insumos SA", "telefono": "1199887766"},
            {"nombre": "Insumos SRL"},
            Proveedor, "nombre",
        )

    def test_ciclo_completo_de_categoria_costo(self):
        self._ciclo(
            "/api/categoriascosto/",
            {"nombre": "Alquiler"},
            {"nombre": "Alquileres"},
            CategoriaCosto, "nombre",
        )

    def test_list_devuelve_los_registros_creados(self):
        f.cliente(nombre="Ana")
        f.cliente(nombre="Bruno")

        resp = self.client.get("/api/clientes/")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([c["nombre"] for c in resp.data], ["Ana", "Bruno"])
