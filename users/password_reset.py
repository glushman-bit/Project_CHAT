"""Восстановление пароля через email.

Используем стандартные view Django, но с русскими шаблонами,
своим email-шаблоном и ограничением частоты запросов.
"""

from django.conf import settings
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy

from .throttling import (
    PASSWORD_RESET_LIMIT,
    PASSWORD_RESET_LIMIT_MESSAGE,
    PASSWORD_RESET_PERIOD,
    is_rate_limited,
    password_reset_key,
)


def _hours_left():
    """Сколько часов действует ссылка из письма."""

    return max(
        1,
        int(settings.PASSWORD_RESET_TIMEOUT) // 3600,
    )


class PasswordResetView(auth_views.PasswordResetView):
    """Форма запроса ссылки для восстановления пароля."""

    template_name = "users/password_reset_form.html"
    email_template_name = "users/password_reset_email.txt"
    subject_template_name = "users/password_reset_subject.txt"

    success_url = reverse_lazy("password_reset_done")

    extra_email_context = {
        "hours_left": _hours_left(),
    }

    def dispatch(self, request, *args, **kwargs):
        # Лимит на отправку писем: считаем только отправку формы,
        # чтобы страницу можно было открывать сколько угодно раз.
        if (
            request.method == "POST"
            and is_rate_limited(
                password_reset_key(request),
                limit=PASSWORD_RESET_LIMIT,
                period=PASSWORD_RESET_PERIOD,
            )
        ):
            return self.render_to_response(
                self.get_context_data(
                    form=self.get_form_with_limit_error(),
                ),
                status=429,
            )

        return super().dispatch(
            request,
            *args,
            **kwargs,
        )

    def get_form_with_limit_error(self):
        form = self.get_form()

        form.add_error(
            None,
            PASSWORD_RESET_LIMIT_MESSAGE,
        )

        return form


class PasswordResetDoneView(auth_views.PasswordResetDoneView):
    """Страница «письмо отправлено»."""

    template_name = "users/password_reset_done.html"


class PasswordResetConfirmView(auth_views.PasswordResetConfirmView):
    """Форма задания нового пароля по ссылке из письма."""

    template_name = "users/password_reset_confirm.html"

    success_url = reverse_lazy("password_reset_complete")


class PasswordResetCompleteView(auth_views.PasswordResetCompleteView):
    """Страница «пароль изменён»."""

    template_name = "users/password_reset_complete.html"
