"""
Tarea 3 — Cuenta corriente (`CuentaCorrienteViewSet` sobre la vista SQL
`vw_cuenta_corriente`). El estado se arma insertando en las tablas base y se
verifica lo que la vista deriva: signos, split del cargo por servicio y saldo.
"""
from datetime import date
from decimal import Decimal

from rest_framework import status

from . import factories as f
from .mixins import BaseAPITestCase


class CuentaCorrienteClienteTests(BaseAPITestCase):
    URL = "/api/cuenta-corriente/"

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente(nombre="Ana")
        self.tipo = f.tipo_evento(nombre="Casamiento")
        self.evento = f.evento(self.cliente, self.tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")
        self.servicio = f.servicio(nombre="Maquillaje")

    def _movimientos_por_tipo(self, data, tipo_movimiento):
        return [m for m in data["movimientos"] if m["tipo_movimiento"] == tipo_movimiento]

    def test_cargo_del_evento_suma_y_el_cobro_resta(self):
        f.servicio_evento(self.evento, self.servicio, importe="1000.00")
        f.movimiento(
            tipo="I", importe="400.00", cliente=self.cliente, evento=self.evento,
            fecha=date(2026, 8, 2), concepto="Seña",
        )

        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        cargos = self._movimientos_por_tipo(resp.data, "E")
        cobros = self._movimientos_por_tipo(resp.data, "M")
        self.assertEqual(len(cargos), 1)
        self.assertEqual(Decimal(cargos[0]["importe_signo"]), Decimal("1000.00"))
        self.assertEqual(len(cobros), 1)
        self.assertEqual(Decimal(cobros[0]["importe_signo"]), Decimal("-400.00"))
        self.assertEqual(resp.data["saldo"], Decimal("600.00"))

    def test_servicio_con_cliente_cuenta_se_imputa_al_otro_cliente(self):
        otro = f.cliente(nombre="Bruno")
        f.servicio_evento(self.evento, self.servicio, importe="1000.00")
        f.servicio_evento(
            self.evento, f.servicio(nombre="Peinado"),
            importe="300.00", cliente_cuenta=otro,
        )

        resp_ana = self.client.get(self.URL, {"cliente": self.cliente.id})
        resp_bruno = self.client.get(self.URL, {"cliente": otro.id})

        # El cliente de cabecera sólo carga los servicios sin cliente_cuenta.
        self.assertEqual(resp_ana.data["saldo"], Decimal("1000.00"))
        cargos_ana = self._movimientos_por_tipo(resp_ana.data, "E")
        self.assertEqual(len(cargos_ana), 1)
        self.assertEqual(cargos_ana[0]["tipo"], "Evento")

        # El cliente a cargo del servicio recibe su propio cargo.
        self.assertEqual(resp_bruno.data["saldo"], Decimal("300.00"))
        cargos_bruno = self._movimientos_por_tipo(resp_bruno.data, "E")
        self.assertEqual(len(cargos_bruno), 1)
        self.assertEqual(cargos_bruno[0]["tipo"], "Servicio")
        self.assertIn("Peinado", cargos_bruno[0]["concepto"])

    def test_egreso_a_cliente_suma_al_saldo(self):
        # Un egreso imputado a un cliente (devolución) no lleva signo negativo.
        f.movimiento(
            tipo="E", importe="250.00", cliente=self.cliente,
            fecha=date(2026, 8, 3), concepto="Devolución",
        )

        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        self.assertEqual(resp.data["saldo"], Decimal("250.00"))

    def test_filtro_por_cliente_excluye_movimientos_de_otros(self):
        otro = f.cliente(nombre="Carla")
        f.movimiento(tipo="I", importe="100.00", cliente=self.cliente, fecha=date(2026, 8, 1))
        f.movimiento(tipo="I", importe="900.00", cliente=otro, fecha=date(2026, 8, 1))

        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        self.assertEqual(len(resp.data["movimientos"]), 1)
        self.assertEqual(resp.data["saldo"], Decimal("-100.00"))

    def test_evento_pendiente_no_genera_cargo(self):
        # Sólo los eventos confirmados entran a la cuenta corriente.
        pendiente = f.evento(self.cliente, self.tipo, fecha=f.fecha_aware(2026, 9, 1), estado="P")
        f.servicio_evento(pendiente, self.servicio, importe="1000.00")

        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        self.assertEqual(self._movimientos_por_tipo(resp.data, "E"), [])
        self.assertEqual(resp.data["saldo"], 0)

    def test_evento_cancelado_con_sena_deja_saldo_a_favor(self):
        cancelado = f.evento(self.cliente, self.tipo, fecha=f.fecha_aware(2026, 9, 1), estado="X")
        f.servicio_evento(cancelado, self.servicio, importe="1000.00")
        f.movimiento(
            tipo="I", importe="400.00", cliente=self.cliente, evento=cancelado,
            fecha=date(2026, 8, 2), concepto="Seña",
        )

        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        # El cargo desaparece, pero la seña cobrada sigue siendo plata recibida:
        # queda a favor del cliente hasta que se anule el movimiento.
        self.assertEqual(self._movimientos_por_tipo(resp.data, "E"), [])
        self.assertEqual(len(self._movimientos_por_tipo(resp.data, "M")), 1)
        self.assertEqual(resp.data["saldo"], Decimal("-400.00"))

    def test_cliente_sin_movimientos_devuelve_saldo_cero(self):
        resp = self.client.get(self.URL, {"cliente": self.cliente.id})

        self.assertEqual(resp.data["movimientos"], [])
        self.assertEqual(resp.data["saldo"], 0)


class CuentaCorrientePrestadorTests(BaseAPITestCase):
    URL = "/api/cuenta-corriente/"

    def setUp(self):
        super().setUp()
        self.cliente = f.cliente(nombre="Ana")
        self.prestador = f.prestador(nombre="Sofía")
        self.tipo = f.tipo_evento(nombre="Casamiento")
        self.evento = f.evento(self.cliente, self.tipo, fecha=f.fecha_aware(2026, 8, 1), estado="C")

    def test_servicio_a_pagar_suma_y_el_pago_resta(self):
        f.servicio_evento(
            self.evento, f.servicio(nombre="Maquillaje"),
            importe="1000.00", prestador=self.prestador, importe_prestador="500.00",
        )
        f.movimiento(
            tipo="E", importe="200.00", prestador=self.prestador,
            fecha=date(2026, 8, 5), concepto="Pago a cuenta",
        )

        resp = self.client.get(self.URL, {"prestador": self.prestador.id})

        servicios = [m for m in resp.data["movimientos"] if m["tipo_movimiento"] == "S"]
        pagos = [m for m in resp.data["movimientos"] if m["tipo_movimiento"] == "M"]
        self.assertEqual(len(servicios), 1)
        self.assertEqual(Decimal(servicios[0]["importe_signo"]), Decimal("500.00"))
        self.assertEqual(len(pagos), 1)
        self.assertEqual(Decimal(pagos[0]["importe_signo"]), Decimal("-200.00"))
        self.assertEqual(resp.data["saldo"], Decimal("300.00"))

    def test_servicio_de_evento_cancelado_no_se_debe_al_prestador(self):
        cancelado = f.evento(self.cliente, self.tipo, fecha=f.fecha_aware(2026, 9, 1), estado="X")
        f.servicio_evento(
            cancelado, f.servicio(nombre="Peinado"),
            importe="800.00", prestador=self.prestador, importe_prestador="400.00",
        )

        resp = self.client.get(self.URL, {"prestador": self.prestador.id})

        self.assertEqual(resp.data["movimientos"], [])
        self.assertEqual(resp.data["saldo"], 0)

    def test_filtro_por_prestador_excluye_servicios_de_otros(self):
        otro = f.prestador(nombre="Lucía")
        f.servicio_evento(
            self.evento, f.servicio(nombre="Maquillaje"),
            importe="1000.00", prestador=self.prestador, importe_prestador="500.00",
        )
        f.servicio_evento(
            self.evento, f.servicio(nombre="Peinado"),
            importe="800.00", prestador=otro, importe_prestador="400.00",
        )

        resp = self.client.get(self.URL, {"prestador": self.prestador.id})

        self.assertEqual(len(resp.data["movimientos"]), 1)
        self.assertEqual(resp.data["saldo"], Decimal("500.00"))
