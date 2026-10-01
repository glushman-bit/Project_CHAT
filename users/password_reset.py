"""Восстановление пароля через email.

Используем стандартные view Django, но с русскими шаблонами,
своим email-шаблоном и ограничением частоты запросов.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy

from .throttling import (
    PASSWORD_RESET_LIMIT,
    PASSWORD_RESET_LIMIT_MESSAGE,
    PASSWORD_RESET_PERIOD,
    is_rate_limited,
    password_reset_key,
)

# Вводить можно только свой email: если такого аккаунта нет,
# показываем ошибку в поле, а не «обезличенный» ответ.
EMAIL_NOT_FOUND_MESSAGE = "Этот email не привязан к аккаунту."


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

    def email_is_known(self, email):
        """Email принадлежит активному аккаунту?"""

        return (
            get_user_model()
            .objects
            .filter(
                email__iexact=email,
                is_active=True,
            )
            .exists()
        )

    def form_valid(self, form):
        if not self.email_is_known(form.cleaned_data["email"]):
            form.add_error(
                "email",
                EMAIL_NOT_FOUND_MESSAGE,
            )

            return self.form_invalid(form)

        # Лимит на отправку писем: считаем только реальные отправки,
        # чтобы опечатки в email не тратили попытки.
        if is_rate_limited(
            password_reset_key(self.request),
            limit=PASSWORD_RESET_LIMIT,
            period=PASSWORD_RESET_PERIOD,
        ):
            form.add_error(
                None,
                PASSWORD_RESET_LIMIT_MESSAGE,
            )

            return self.render_to_response(
                self.get_context_data(
                    form=form,
                ),
                status=429,
            )

        return super().form_valid(form)


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
