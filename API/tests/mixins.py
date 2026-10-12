"""Base común de los tests de integración: usuario autenticado + mock de Google Calendar."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class BaseAPITestCase(APITestCase):
    """
    Autentica con `force_authenticate` (no se ejercita el flujo OAuth) y mockea
    los límites externos: `sync_evento` / `delete_evento` de Google Calendar,
    patcheados donde se usan (`API.views.views`).
    """

    def setUp(self):
        super().setUp()
        User = get_user_model()
        self.user = User.objects.create_user(username="tester", password="x")
        self.client.force_authenticate(user=self.user)

        p_sync = patch("API.views.views.sync_evento", return_value=None)
        p_delete = patch("API.views.views.delete_evento", return_value=None)
        self.mock_sync = p_sync.start()
        self.mock_delete = p_delete.start()
        self.addCleanup(p_sync.stop)
        self.addCleanup(p_delete.stop)
