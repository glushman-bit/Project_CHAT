from django.urls import path

from . import password_change, password_reset
from .views import login_view, logout_view, profile, register_view, user_profile_data

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

    # Смена пароля в профиле.
    path(
        "profile/password/",
        password_change.PasswordChangeView.as_view(),
        name="password_change",
    ),
    path(
        "profile/password/done/",
        password_change.PasswordChangeDoneView.as_view(),
        name="password_change_done",
    ),

    # Просмотр профиля пользователя по логину (JSON для модального окна).
    path(
        "api/profile/<str:username>/",
        user_profile_data,
        name="user_profile_data",
    ),
]
