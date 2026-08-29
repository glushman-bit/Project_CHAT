import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Message, ChatRoom
from .validators import validate_message


online_users = {}

class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]

        self.room = await self.get_room(self.room_name)

        if self.room is None:
            await self.close()
            return

        if not await self.has_room_access(self.room):
            await self.close()
            return

        self.room_group_name = f"chat_{self.room.id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

        user = self.scope["user"]

        online_users.setdefault(
            self.room_name,
            {}
        )

        online_users[self.room_name][
            self.channel_name
        ] = user.username

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_status",
                "action": "join",
                "username": user.username,
                "channel_name": self.channel_name,
            },
        )

        await self.broadcast_online_users()

        await self.send_message_history()

    async def disconnect(self, close_code):

        if not hasattr(self, "room_group_name"):
            return

        user = self.scope["user"]

        if not user.is_anonymous:
            room_users = online_users.get(
                self.room_name,
                {},
            )

            room_users.pop(
                self.channel_name,
                None,
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_status",
                    "action": "leave",
                    "username": user.username,
                    "channel_name": self.channel_name,
                },
            )

            await self.broadcast_online_users()

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def user_status(self, event):

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

        message = await self.create_message(
            user.id,
            self.room.id,
            message_text,
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "username": user.username,
                "avatar": user.avatar.url if user.avatar else None,
                "message": message.text,
                "created_at": message.created_at.isoformat(),
            },
        )

    async def chat_message(self, event):
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
        messages = await self.get_messages(self.room.id)

        await self.send(
            text_data=json.dumps(
                {
                    "type": "history",
                    "messages": messages,
                }
            )
        )

    async def broadcast_online_users(self):
        users = online_users.get(
            self.room_name,
            {},
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "online_users",
                "users": list(set(users.values())),
            },
        )

    async def online_users(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "online_users",
                    "users": event["users"],
                }
            )
        )

    @database_sync_to_async
    def create_message(self, user_id, room_id, text):
        """Создание сообщения."""

        return Message.objects.create(
            user_id=user_id,
            room_id=room_id,
            text=text,
        )

    @database_sync_to_async
    def get_messages(self, room_id):
        """Получение сообщений."""
        messages = (
            Message.objects
            .filter(room__id=room_id)
            .select_related("user")
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
        try:
            return ChatRoom.objects.get(
                name=room_name,
            )
        except ChatRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def has_room_access(self, room):
        user = self.scope["user"]

        if room.owner_id == user.id:
            return True

        if not room.is_private:
            return True

        return room.members.filter(id=user.id).exists()