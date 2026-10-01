"""Смена пароля авторизованным пользователем.

Стандартные view Django с русскими шаблонами проекта.
"""

from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy


class PasswordChangeView(auth_views.PasswordChangeView):
    """Форма смены пароля (нужен текущий пароль)."""

    template_name = "users/password_change_form.html"

    success_url = reverse_lazy("password_change_done")


class PasswordChangeDoneView(auth_views.PasswordChangeDoneView):
    """Страница «пароль изменён»."""

    template_name = "users/password_change_done.html"
