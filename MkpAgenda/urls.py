"""
URL configuration for MkpAgenda project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.views.generic import TemplateView
from django.contrib import admin
from django.urls import path, include, re_path
from .views import ReactAppView, privacy_policy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/', include('API.urls')),
    path('privacy/', privacy_policy, name='privacy_policy'), # Esto es necesario para verificar la aplicación en Google
    # re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
    re_path(r'^.*$', ReactAppView.as_view(), name='react_app'),
]
