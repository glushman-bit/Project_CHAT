from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from .forms import RegistrationForm
from .password_reset import EMAIL_NOT_FOUND_MESSAGE

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
        # Счётчик лимита живёт в кэше и общий для всех тестов.
        cache.clear()

        User.objects.create_user(
            username="ivan",
            email="ivan@example.com",
            password="correct-pass-123",
        )

    def test_login_throttled_after_many_attempts(self):
        statuses = []

        # Окно лимита фиксированное, поэтому при переходе через
        # его границу счётчик сбрасывается — ждём 429 не ровно
        # на 11-й попытке.
        for _ in range(20):
            response = self.client.post(
                "/users/login/",
                {"username": "ivan", "password": "wrong"},
            )

            statuses.append(response.status_code)

            if response.status_code == 429:
                break

        self.assertEqual(
            statuses[-1],
            429,
            f"Ожидался 429, получено: {statuses}",
        )


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

    def test_unknown_email_rejected(self):
        response = self.client.post(
            reverse("password_reset"),
            {"email": "nobody@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            EMAIL_NOT_FOUND_MESSAGE,
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_email_does_not_spend_attempts(self):
        for _ in range(10):
            response = self.client.post(
                reverse("password_reset"),
                {"email": "nobody@example.com"},
            )

            self.assertEqual(response.status_code, 200)

        # Настоящий email всё ещё можно отправить после серии опечаток.
        response = self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)

    def test_email_case_insensitive(self):
        response = self.client.post(
            reverse("password_reset"),
            {"email": "Ivan@Example.com"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)

    def test_inactive_user_email_rejected(self):
        self.user.is_active = False
        self.user.save()

        response = self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            EMAIL_NOT_FOUND_MESSAGE,
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_unusable_password_email_rejected(self):
        self.user.set_unusable_password()
        self.user.save()

        response = self.client.post(
            reverse("password_reset"),
            {"email": "ivan@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            EMAIL_NOT_FOUND_MESSAGE,
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


class PasswordChangeTests(TestCase):
    """Смена пароля из профиля."""

    def setUp(self):
        # Лимиты входа живут в кэше, который не сбрасывается между тестами.
        cache.clear()

        self.user = User.objects.create_user(
            username="ivan",
            email="ivan@example.com",
            password=VALID_PASSWORD,
        )

    def test_anonymous_redirected_to_login(self):
        response = self.client.get(
            reverse("password_change")
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn(
            reverse("first_chat"),
            response.url,
        )

    def test_anonymous_redirected_from_profile(self):
        response = self.client.get(
            reverse("profile")
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn(
            reverse("first_chat"),
            response.url,
        )

    def test_profile_has_change_password_button(self):
        self.client.force_login(self.user)

        response = self.client.get(
            reverse("profile")
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            reverse("password_change"),
        )
        self.assertContains(
            response,
            "Изменить пароль",
        )

    def test_form_available_for_authenticated(self):
        self.client.force_login(self.user)

        response = self.client.get(
            reverse("password_change")
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            "Текущий пароль",
        )

    def test_password_changed(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("password_change"),
            {
                "old_password": VALID_PASSWORD,
                "new_password1": NEW_PASSWORD,
                "new_password2": NEW_PASSWORD,
            },
        )

        self.assertRedirects(
            response,
            reverse("password_change_done"),
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

    def test_login_with_changed_password(self):
        self.client.force_login(self.user)

        self.client.post(
            reverse("password_change"),
            {
                "old_password": VALID_PASSWORD,
                "new_password1": NEW_PASSWORD,
                "new_password2": NEW_PASSWORD,
            },
        )

        self.client.logout()

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

    def test_wrong_old_password_rejected(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("password_change"),
            {
                "old_password": "wrong-pass-999",
                "new_password1": NEW_PASSWORD,
                "new_password2": NEW_PASSWORD,
            },
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                VALID_PASSWORD
            )
        )

    def test_weak_new_password_rejected(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("password_change"),
            {
                "old_password": VALID_PASSWORD,
                "new_password1": "123",
                "new_password2": "123",
            },
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                VALID_PASSWORD
            )
        )

    def test_mismatched_confirmation_rejected(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("password_change"),
            {
                "old_password": VALID_PASSWORD,
                "new_password1": NEW_PASSWORD,
                "new_password2": "other-pass-789",
            },
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                VALID_PASSWORD
            )
        )


class UserProfileTests(TestCase):
    """Данные профиля для модального окна в чате."""

    def setUp(self):
        self.me = User.objects.create_user(
            username="ivan",
            email="ivan@example.com",
            password=VALID_PASSWORD,
        )

        self.other = User.objects.create_user(
            username="petr",
            email="petr@example.com",
            password=VALID_PASSWORD,
        )

    def test_anonymous_redirected_to_chat(self):
        response = self.client.get(
            reverse(
                "user_profile_data",
                args=["petr"],
            )
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn(
            reverse("first_chat"),
            response.url,
        )

    def test_other_profile_data(self):
        self.client.force_login(self.me)

        response = self.client.get(
            reverse(
                "user_profile_data",
                args=["petr"],
            )
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["username"], "petr")
        self.assertIsNone(data["avatar"])
        self.assertIn("date_joined", data)
        self.assertFalse(data["is_own"])

    def test_other_profile_has_no_email(self):
        self.client.force_login(self.me)

        response = self.client.get(
            reverse(
                "user_profile_data",
                args=["petr"],
            )
        )

        self.assertNotIn(
            "petr@example.com",
            response.content.decode(),
        )

    def test_own_profile_marked_as_own(self):
        self.client.force_login(self.me)

        response = self.client.get(
            reverse(
                "user_profile_data",
                args=["ivan"],
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_own"])

    def test_unknown_user_not_found(self):
        self.client.force_login(self.me)

        response = self.client.get(
            reverse(
                "user_profile_data",
                args=["nobody"],
            )
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json()["error"],
            "Пользователь не найден",
        )

    def test_own_profile_url_still_works(self):
        """Маршрут профиля не перехвачен."""

        self.client.force_login(self.me)

        response = self.client.get(
            reverse("profile")
        )

        self.assertEqual(response.status_code, 200)

    def test_password_change_urls_still_work(self):
        self.client.force_login(self.me)

        response = self.client.get(
            reverse("password_change")
        )

        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            reverse("password_change_done")
        )

        self.assertEqual(response.status_code, 200)
