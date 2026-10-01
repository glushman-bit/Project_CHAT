from django.urls import path

from . import password_reset
from .views import login_view, logout_view, profile, register_view

urlpatterns = [
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("register/", register_view, name="register"),
    path("profile/", profile, name="profile"),

    # Восстановление пароля.
    path(
        "password_reset/",
        password_reset.PasswordResetView.as_view(),
        name="password_reset",
    ),
    path(
        "password_reset/done/",
        password_reset.PasswordResetDoneView.as_view(),
        name="password_reset_done",
    ),
    path(
        "reset/<uidb64>/<token>/",
        password_reset.PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path(
        "reset/done/",
        password_reset.PasswordResetCompleteView.as_view(),
        name="password_reset_complete",
    ),
]
