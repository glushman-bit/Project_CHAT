from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from .forms import RegistrationForm

User = get_user_model()

VALID_PASSWORD = "strong-pass-123"
NEW_PASSWORD = "brand-new-pass-456"


class RegistrationFormTests(TestCase):
    def setUp(self):
        self.data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": VALID_PASSWORD,
            "password_confirm": VALID_PASSWORD,
        }

    def test_valid_registration(self):
        form = RegistrationForm(data=self.data)
        self.assertTrue(form.is_valid())

    def test_weak_password_rejected(self):
        data = dict(
            self.data,
            password="123",
            password_confirm="123",
        )
        form = RegistrationForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_password_similar_to_username_rejected(self):
        data = dict(
            self.data,
            password="newuser1",
            password_confirm="newuser1",
        )
        form = RegistrationForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_password_common_rejected(self):
        data = dict(
            self.data,
            password="password",
            password_confirm="password",
        )
        form = RegistrationForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_duplicate_email_rejected(self):
        User.objects.create_user(
            username="existing",
            email="new@example.com",
            password=VALID_PASSWORD,
        )
        form = RegistrationForm(data=self.data)
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)

    def test_missing_email_rejected(self):
        data = dict(self.data, email="")
        form = RegistrationForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)


class LoginThrottleTests(TestCase):
    def setUp(self):
        User.objects.create_user(
            username="ivan",
            email="ivan@example.com",
            password="correct-pass-123",
        )

    def test_login_throttled_after_many_attempts(self):
        for _ in range(10):
            response = self.client.post(
                "/users/login/",
                {"username": "ivan", "password": "wrong"},
            )
            self.assertEqual(response.status_code, 400)

        response = self.client.post(
            "/users/login/",
            {"username": "ivan", "password": "wrong"},
        )
        self.assertEqual(response.status_code, 429)


class PasswordResetTests(TestCase):
    """Восстановление пароля по ссылке из письма."""

    def setUp(self):
        # Лимиты живут в кэше, который не сбрасывается между тестами.
        cache.clear()

        self.user = User.objects.create_user(
            username="ivan",
            email="ivan@example.com",
            password=VALID_PASSWORD,
        )

    def request_reset_link(self):
        """Запрашивает письмо и возвращает ссылку из его текста."""

        self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        after_host = (
            mail.outbox[0].body
            .split("http://testserver")[1]
        )

        return after_host.splitlines()[0].strip()

    def open_reset_form(self, link):
        """Открывает форму по ссылке и возвращает её URL.

        Django при первом заходе кладёт токен в сессию
        и редиректит на ссылку без токена, поэтому
        отправлять новый пароль нужно именно на неё.
        """

        response = self.client.get(
            link,
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Новый пароль")

        return response.redirect_chain[0][0] if response.redirect_chain else link

    def set_new_password(self, form_url, password):
        return self.client.post(
            form_url,
            {
                "new_password1": password,
                "new_password2": password,
            },
        )

    def test_request_form_available(self):
        response = self.client.get(
            reverse("password_reset")
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Восстановление пароля")

    def test_reset_link_sent_by_email(self):
        response = self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        self.assertRedirects(
            response,
            reverse("password_reset_done"),
        )

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].to,
            ["ivan@example.com"],
        )

        self.assertIn("/users/reset/", mail.outbox[0].body)

    def test_password_can_be_changed_with_link(self):
        form_url = self.open_reset_form(
            self.request_reset_link()
        )

        response = self.set_new_password(
            form_url,
            NEW_PASSWORD,
        )

        self.assertRedirects(
            response,
            reverse("password_reset_complete"),
        )

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                NEW_PASSWORD
            )
        )
        self.assertFalse(
            self.user.check_password(
                VALID_PASSWORD
            )
        )

    def test_login_with_new_password(self):
        form_url = self.open_reset_form(
            self.request_reset_link()
        )

        self.set_new_password(
            form_url,
            NEW_PASSWORD,
        )

        response = self.client.post(
            reverse("login"),
            {
                "username": "ivan",
                "password": NEW_PASSWORD,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            response.json()["success"]
        )

    def test_weak_new_password_rejected(self):
        form_url = self.open_reset_form(
            self.request_reset_link()
        )

        response = self.set_new_password(
            form_url,
            "123",
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                VALID_PASSWORD
            )
        )

    def test_unknown_email_gives_generic_answer(self):
        response = self.client.post(
            reverse("password_reset"),
            {"email": "nobody@example.com"},
        )

        self.assertRedirects(
            response,
            reverse("password_reset_done"),
        )

        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_token_shows_hint(self):
        response = self.client.get(
            reverse(
                "password_reset_confirm",
                args=["MQ", "wrong-token"],
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            "Ссылка недействительна",
        )

    def test_reset_requests_throttled(self):
        for _ in range(5):
            response = self.client.post(
                reverse("password_reset"),
                {"email": "ivan@example.com"},
            )
            self.assertEqual(response.status_code, 302)

        response = self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        self.assertEqual(response.status_code, 429)
