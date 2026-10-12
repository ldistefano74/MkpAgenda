from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse
from django.http import HttpResponseForbidden
from django.conf import settings


class WhitelistSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Bloquea el login de cuentas Google que no estén en ALLOWED_LOGIN_EMAILS.
    Si la lista está vacía o no está definida, bloquea a todos (fail-safe).
    """

    def pre_social_login(self, request, sociallogin):
        email = (sociallogin.user.email or '').lower().strip()
        allowed = [e.lower().strip() for e in getattr(settings, 'ALLOWED_LOGIN_EMAILS', [])]

        if not allowed or not email or email not in allowed:
            raise ImmediateHttpResponse(
                HttpResponseForbidden(
                    f"Acceso denegado. La cuenta {email} no está autorizada para ingresar."
                )
            )
