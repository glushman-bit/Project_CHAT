import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import ChatRoom, Message
from .validators import validate_message


# Храним активные WebSocket-соединения:
#
# {
#     "room_name": {
#         "channel_name": "username"
#     }
# }
#
# Важно:
# это работает корректно в рамках одного процесса.
# Для нескольких workers/containers состояние лучше хранить в Redis.
online_users: dict[str, dict[str, str]] = {}


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer для чата."""

    async def connect(self):
        """Подключение пользователя к комнате."""

        user = self.scope["user"]

        # Анонимным пользователям доступ к WebSocket запрещён.
        if user.is_anonymous:
            await self.close()
            return

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]

        # Получаем комнату.
        self.room = await self.get_room(self.room_name)

        if self.room is None:
            await self.close()
            return

        # Проверяем доступ пользователя к комнате.
        if not await self.has_room_access(self.room):
            await self.close()
            return

        # Группа комнаты.
        self.room_group_name = f"chat_{self.room.id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

        # Регистрируем пользователя как онлайн.
        room_users = online_users.setdefault(
            self.room_name,
            {},
        )

        room_users[self.channel_name] = user.username

        # Сообщаем остальным участникам о входе.
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_status",
                "action": "join",
                "username": user.username,
                "channel_name": self.channel_name,
            },
        )

        # Обновляем список онлайн-пользователей.
        await self.broadcast_online_users()

        # Отправляем историю сообщений подключившемуся пользователю.
        await self.send_message_history()

    async def disconnect(self, close_code):
        """Отключение пользователя от комнаты."""

        if not hasattr(self, "room_group_name"):
            return

        user = self.scope["user"]

        if not user.is_anonymous:
            room_users = online_users.get(
                self.room_name,
                {},
            )

            # Удаляем именно это WebSocket-соединение.
            room_users.pop(
                self.channel_name,
                None,
            )

            # Проверяем, остались ли другие соединения
            # этого же пользователя в комнате.
            user_still_online = (
                user.username in room_users.values()
            )

            if not room_users:
                online_users.pop(
                    self.room_name,
                    None,
                )

            # Отправляем "вышел из чата" только тогда,
            # когда пользователь действительно больше
            # не имеет активных соединений в комнате.
            if not user_still_online:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "user_status",
                        "action": "leave",
                        "username": user.username,
                        "channel_name": self.channel_name,
                    },
                )

            # Обновляем список онлайн-пользователей.
            await self.broadcast_online_users()

        # Удаляем соединение из группы.
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def user_status(self, event):
        """Отправляет системное событие о входе/выходе пользователя."""

        # Не отправляем событие обратно отправителю.
        if event["channel_name"] == self.channel_name:
            return

        await self.send(
            text_data=json.dumps(
                {
                    "type": "user_status",
                    "action": event["action"],
                    "username": event["username"],
                }
            )
        )

    async def receive(self, text_data):
        """Получает сообщение от клиента."""

        # Проверяем, имеет ли пользователь право
        # отправлять сообщения.
        if not await self.can_send_messages(self.room):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": (
                            "Чтобы отправлять сообщения, "
                            "нужно вступить в комнату."
                        ),
                    }
                )
            )
            return

        # Валидируем сообщение.
        message_text, error = validate_message(text_data)

        if error:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": error,
                    }
                )
            )
            return

        user = self.scope["user"]

        # Сохраняем сообщение в БД.
        message = await self.create_message(
            user_id=user.id,
            room_id=self.room.id,
            text=message_text,
        )

        # Получаем URL аватара безопасно.
        avatar_url = None

        if user.avatar:
            avatar_url = user.avatar.url

        # Отправляем сообщение всем участникам комнаты.
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "username": user.username,
                "avatar": avatar_url,
                "message": message.text,
                "created_at": message.created_at.isoformat(),
            },
        )

    async def chat_message(self, event):
        """Отправляет сообщение клиенту."""

        await self.send(
            text_data=json.dumps(
                {
                    "type": "message",
                    "username": event["username"],
                    "avatar": event["avatar"],
                    "message": event["message"],
                    "created_at": event["created_at"],
                }
            )
        )

    async def send_message_history(self):
        """Отправляет пользователю историю сообщений."""

        messages = await self.get_messages(
            self.room.id
        )

        await self.send(
            text_data=json.dumps(
                {
                    "type": "history",
                    "messages": messages,
                }
            )
        )

    async def broadcast_online_users(self):
        """Рассылает участникам комнаты список онлайн-пользователей."""

        users = online_users.get(
            self.room_name,
            {},
        )

        usernames = sorted(
            set(users.values())
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "online_users",
                "users": usernames,
            },
        )

    async def online_users(self, event):
        """Отправляет список онлайн-пользователей клиенту."""

        await self.send(
            text_data=json.dumps(
                {
                    "type": "online_users",
                    "users": event["users"],
                }
            )
        )

    # =========================
    # Database
    # =========================

    @database_sync_to_async
    def create_message(
        self,
        user_id,
        room_id,
        text,
    ):
        """Создаёт сообщение в БД."""

        return Message.objects.create(
            user_id=user_id,
            room_id=room_id,
            text=text,
        )

    @database_sync_to_async
    def get_messages(self, room_id):
        """Возвращает историю сообщений комнаты."""

        messages = (
            Message.objects
            .filter(room_id=room_id)
            .select_related("user")
            .order_by("created_at")
        )

        return [
            {
                "username": message.user.username,
                "avatar": (
                    message.user.avatar.url
                    if message.user.avatar
                    else None
                ),
                "message": message.text,
                "created_at": message.created_at.isoformat(),
            }
            for message in messages
        ]

    @database_sync_to_async
    def get_room(self, room_name):
        """Получает комнату по имени."""

        try:
            return ChatRoom.objects.get(
                name=room_name,
            )
        except ChatRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def has_room_access(self, room):
        """Проверяет доступ пользователя к комнате."""

        user = self.scope["user"]

        # Владелец комнаты имеет доступ всегда.
        if room.owner_id == user.id:
            return True

        # Публичная комната доступна всем авторизованным пользователям.
        if not room.is_private:
            return True

        # Приватная комната доступна только участникам.
        return room.members.filter(
            id=user.id
        ).exists()

    @database_sync_to_async
    def can_send_messages(self, room):
        """Проверяет право пользователя отправлять сообщения."""

        user = self.scope["user"]

        # Владелец может писать всегда.
        if room.owner_id == user.id:
            return True

        # Остальные пользователи должны быть участниками.
        return room.members.filter(
            id=user.id
        ).exists()
