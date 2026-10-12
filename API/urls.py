from django.urls import path, include
from .views import views, metadata, lookup, new, dashboard, auth, google_calendar, reports
from rest_framework import routers

router = routers.DefaultRouter()
router.register(r'servicios', views.ServicioViewSet)
router.register(r'redes', views.RedesViewSet)
router.register(r'tiposevento', views.TiposEventoViewSet)
router.register(r'clientes', views.ClienteViewSet)
router.register(r'fuentescontacto', views.FuenteContactoViewSet)
router.register(r'mediospagocobro', views.MedioPagoCobroViewSet)
router.register(r'prestadores', views.PrestadorViewSet)
router.register(r'eventos', views.EventoViewSet)
router.register(r'movimientos', views.MovimientoCuentaViewSet)
router.register(r'cuenta-corriente', views.CuentaCorrienteViewSet, basename='cuenta-corriente')
router.register(r'proveedores', views.ProveedorViewSet)
router.register(r'categoriascosto', views.CategoriaCostoViewSet)
router.register(r'costosrecurrentes', views.CostoRecurrenteViewSet)
router.register(r'costos', views.CostoViewSet)
router.register(r'configuracion', views.ConfiguracionViewSet, basename='configuracion')

urlpatterns = [
    path("", include(router.urls)),
    path("metadata/<str:serializer_name>/", metadata.serializer_metadata, name='serializer-metadata'),
    path("new/<str:serializer_name>/", new.serializer_new, name='serializer-new'),
    path("lookup/<str:name>/", lookup.lookup, name='model-lookup'),
    path("dashboard/", dashboard.dashboard, name='dashboard'),
    path("dashboard/costos-recurrentes/", dashboard.dashboard_costos_recurrentes, name='dashboard-costos-recurrentes'),
    path("dashboard/cuotas-pendientes/", dashboard.dashboard_cuotas_pendientes, name='dashboard-cuotas-pendientes'),
    path("dashboard/cuotas-pendientes/<int:pk>/pagar/", dashboard.marcar_cuota_pagada, name='dashboard-cuota-pagar'),
    path("auth/user/", auth.current_user, name='current-user'),
    path("google-calendar/health/", google_calendar.health, name='gcal-health'),
    path("google-calendar/status/", google_calendar.status, name='gcal-status'),
    path("google-calendar/sync/", google_calendar.sync, name='gcal-sync'),
    path("reports/presupuesto/<int:evento_id>/", reports.presupuesto, name='presupuesto'),
    path("reportes/movimientos/", reports.movimientos, name='reporte-movimientos'),
    path("reportes/resultados/", reports.resultados, name='reporte-resultados'),
    path("reportes/resultados/detalle/", reports.resultados_detalle, name='reporte-resultados-detalle'),
]