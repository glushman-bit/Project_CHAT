"""Простой rate limiting на основе Django cache.

Используется фиксированное временное окно; счётчики живут в кэше,
поэтому лимиты общие для всех процессов, когда кэш общий (Redis).
"""

import time
from functools import wraps

from django.core.cache import cache
from django.http import JsonResponse

DEFAULT_LIMIT = 10
DEFAULT_PERIOD = 300  # секунд

# Восстановление пароля: 5 запросов в час с одного адреса.
PASSWORD_RESET_LIMIT = 5
PASSWORD_RESET_PERIOD = 3600  # секунд
PASSWORD_RESET_LIMIT_MESSAGE = ("Слишком много запросов " "восстановления пароля. Подождите час.")


def _client_ip(request):
    """Возвращает IP клиента (с учётом прокси-заголовков)."""

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR", "")


def password_reset_key(request):
    """Ключ кэша для лимита восстановления пароля."""

    return f"password_reset:{_client_ip(request)}"


def is_rate_limited(
    key,
    limit=DEFAULT_LIMIT,
    period=DEFAULT_PERIOD,
):
    """Проверяет лимит и увеличивает счётчик.

    `key` — строка (часть ключа кэша). Возвращает True,
    если лимит уже исчерпан; иначе False (счётчик увеличен).
    """

    window = int(time.time()) // period
    cache_key = f"throttle:{key}:{window}"
    count = cache.get(cache_key, 0)

    if count >= limit:
        return True

    cache.set(cache_key, count + 1, period + 10)

    return False


def rate_limit(key, limit=DEFAULT_LIMIT, period=DEFAULT_PERIOD, message=""):
    """Ограничивает число обращений к view за период.

    `key` — вызываемое: (request) -> str (часть ключа кэша).
    """

    def decorator(view):
        @wraps(view)
        def _wrapped(request, *args, **kwargs):
            if is_rate_limited(key(request), limit, period):
                return JsonResponse(
                    {
                        "success": False,
                        "error": message or (f"Превышен лимит запросов. " f"Повторите через {period} секунд."),
                    },
                    status=429,
                )

            return view(request, *args, **kwargs)

        return _wrapped

    return decorator


def throttle_login(view):
    """Лимит на попытки входа: 10 за 5 минут."""

    return rate_limit(
        key=lambda request: f"login:{_client_ip(request)}",
        limit=10,
        period=300,
        message="Слишком много попыток входа. Подождите 5 минут.",
    )(view)


def throttle_register(view):
    """Лимит на регистрации: 5 за час с одного адреса."""

    return rate_limit(
        key=lambda request: f"register:{_client_ip(request)}",
        limit=5,
        period=3600,
        message="Слишком много регистраций. Подождите час.",
    )(view)
