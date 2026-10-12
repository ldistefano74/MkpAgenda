"""
Tarea 10 — Validadores de dominio ejercitados vía HTTP:
CUIT/CUIL (dígito verificador), DNI, reglas de `Persona.clean()` y unicidad de
teléfono de Cliente.
"""
from rest_framework import status

from API.models import Cliente
from . import factories as f
from .mixins import BaseAPITestCase

# 20-12345678-6 tiene dígito verificador válido; el ...-9 no.
CUIT_VALIDO = "20-12345678-6"
CUIT_INVALIDO = "20-12345678-9"


class ValidacionClienteTests(BaseAPITestCase):
    URL = "/api/clientes/"

    def test_cuit_con_digito_verificador_invalido_da_400(self):
        payload = {"nombre": "Ana", "telefono": "1122334455", "cuit_cuil": CUIT_INVALIDO}

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuit_cuil", resp.data)
        self.assertEqual(Cliente.objects.count(), 0)

    def test_cuit_con_cantidad_de_digitos_invalida_da_400(self):
        payload = {"nombre": "Ana", "telefono": "1122334455", "cuit_cuil": "20-1234-5"}

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cuit_cuil", resp.data)

    def test_cuit_valido_se_acepta(self):
        payload = {
            "nombre": "Ana",
            "telefono": "1122334455",
            "cuit_cuil": CUIT_VALIDO,
            "condicion_fiscal": "RI",
            "direccion": "Av. Siempreviva 742",
        }

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(Cliente.objects.get(pk=resp.data["id"]).cuit_cuil, CUIT_VALIDO)

    def test_dni_mas_largo_que_el_maximo_da_400(self):
        payload = {"nombre": "Ana", "telefono": "1122334455", "dni": "123456789012345"}

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dni", resp.data)

    def test_condicion_fiscal_no_consumidor_final_exige_cuit(self):
        payload = {
            "nombre": "Ana",
            "telefono": "1122334455",
            "condicion_fiscal": "RI",
            "direccion": "Av. Siempreviva 742",
        }

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Cliente.objects.count(), 0)

    def test_condicion_fiscal_no_consumidor_final_exige_direccion(self):
        payload = {
            "nombre": "Ana",
            "telefono": "1122334455",
            "condicion_fiscal": "RI",
            "cuit_cuil": CUIT_VALIDO,
        }

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Cliente.objects.count(), 0)

    def test_telefono_duplicado_da_400(self):
        existente = f.cliente(telefono="1122334455")
        payload = {"nombre": "Otro", "telefono": existente.telefono}

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Cliente.objects.count(), 1)

    def test_editar_un_cliente_manteniendo_su_telefono_no_da_error_de_unicidad(self):
        cliente = f.cliente(nombre="Ana", telefono="1122334455")

        resp = self.client.patch(
            f"{self.URL}{cliente.id}/", {"nombre": "Ana María"}, format="json"
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        cliente.refresh_from_db()
        self.assertEqual(cliente.nombre, "Ana María")

    def test_condicion_fiscal_fuera_de_los_choices_da_400(self):
        payload = {"nombre": "Ana", "telefono": "1122334455", "condicion_fiscal": "ZZ"}

        resp = self.client.post(self.URL, payload, format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("condicion_fiscal", resp.data)


class ValidacionMovimientoTests(BaseAPITestCase):
    """`MovimientoCuenta` exige exactamente uno de cliente / prestador."""

    URL = "/api/movimientos/"

    def _payload(self, **extra):
        payload = {
            "fecha": "2026-08-01",
            "tipo": "I",
            "importe": "1000.00",
            "concepto": "Seña",
        }
        payload.update(extra)
        return payload

    def test_sin_cliente_ni_prestador_da_400(self):
        resp = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_con_cliente_y_prestador_a_la_vez_da_400(self):
        resp = self.client.post(
            self.URL,
            self._payload(cliente=f.cliente().id, prestador=f.prestador().id),
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_con_solo_cliente_se_acepta(self):
        resp = self.client.post(self.URL, self._payload(cliente=f.cliente().id), format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
