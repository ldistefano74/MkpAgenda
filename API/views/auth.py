from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        authenticated = JsonResponse({'authenticated': False}, status=401)
        if settings.DEBUG:

            authenticated = JsonResponse({
                'authenticated': True,
                'id': 0,
                'email': 'dev@local',
                'name': 'Dev User',
                'is_staff': True,
                'environment': settings.ENVIRONMENT,
            })
        return authenticated

    return JsonResponse({
        'authenticated': True,
        'id': request.user.id,
        'email': request.user.email,
        'name': request.user.get_full_name() or request.user.username,
        'is_staff': request.user.is_staff,
        'environment': settings.ENVIRONMENT,
    })
