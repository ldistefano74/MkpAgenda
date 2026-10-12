from django.views.generic import TemplateView
from django.http import HttpResponse


class ReactAppView(TemplateView):
    """
    Esta vista sirve el archivo index.html principal de la aplicación React.
    """
    template_name = "index.html"


def privacy_policy(request):
    html = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidad – MkpAgenda</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.6; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Política de Privacidad</h1>
  <p><strong>MkpAgenda</strong> es una aplicación de uso interno para la gestión de agenda de maquillaje.</p>

  <h2>Información que recopilamos</h2>
  <p>Al iniciar sesión con Google, recopilamos únicamente tu nombre, foto de perfil y dirección de correo electrónico, con el fin de autenticarte en la aplicación.</p>

  <h2>Uso de la información</h2>
  <p>La información recopilada se utiliza exclusivamente para permitir el acceso a la aplicación. No se comparte con terceros ni se usa con fines comerciales.</p>

  <h2>Almacenamiento</h2>
  <p>Los datos de sesión se almacenan de forma segura en el servidor y se eliminan al cerrar sesión.</p>

  <h2>Contacto</h2>
  <p>Consultas: <a href="mailto:lucianodistefano@gmail.com">lucianodistefano@gmail.com</a></p>

  <p><small>Última actualización: abril 2026</small></p>
</body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")