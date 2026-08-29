from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.db import models
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views import View

from chat.forms import ChatRoomForm, AddRoomMemberForm
from chat.models import ChatRoom
from users.models import User


def chat_page(request, room_name):

    room = get_object_or_404(
        ChatRoom.objects.prefetch_related("members"),
        name=room_name,
    )

    available_users = User.objects.none()

    if (
            request.user.is_authenticated
            and room.owner_id == request.user.id
    ):
        available_users = AddRoomMemberForm(
            room=room,
        ).fields["user"].queryset

    if request.user.is_authenticated:
        rooms = ChatRoom.objects.filter(
            models.Q(is_private=False)
            | models.Q(members=request.user)
        ).distinct()
    else:
        rooms = ChatRoom.objects.filter(
            is_private=False
        )

    return render(
        request,
        "chat/chat.html",
        {
            "room": room,
            "room_name": room.name,
            "rooms": rooms,
            "room_members": room.members.all(),
            "is_room_owner": (
                request.user.is_authenticated
                and room.owner_id == request.user.id
            ),
            "available_users": available_users,
        },
    )


class CreateRoomView(LoginRequiredMixin, View):
    """Создание комнаты."""

    def post(self, request):
        """Создаёт комнату и возвращает JSON-ответ."""

        form = ChatRoomForm(request.POST)

        if not form.is_valid():
            return JsonResponse(
                {
                    "success": False,
                    "errors": form.errors,
                },
                status=400,
            )

        room = form.save(commit=False)
        room.owner = request.user
        room.save()

        room.members.add(request.user)

        return JsonResponse(
            {
                "success": True,
                "room": {
                    "id": room.id,
                    "name": room.name,
                },
            },
            status=201,
        )


class AddRoomMemberView(LoginRequiredMixin, View):
    """Добавление участника в комнату."""

    def post(self, request, room_id):
        """Добавляет пользователя в комнату."""

        room = get_object_or_404(
            ChatRoom,
            id=room_id,
        )

        if room.owner_id != request.user.id:
            raise PermissionDenied(
                "Только владелец комнаты может "
                "добавлять участников."
            )

        form = AddRoomMemberForm(
            request.POST,
            room=room,
        )

        if not form.is_valid():
            return JsonResponse(
                {
                    "success": False,
                    "errors": form.errors,
                },
                status=400,
            )

        user = form.cleaned_data["user"]

        room.members.add(user)

        return JsonResponse(
            {
                "success": True,
                "member": {
                    "id": user.id,
                    "username": user.username,
                    "avatar": (
                        user.avatar.url
                        if user.avatar
                        else None
                    ),
                },
            },
            status=201,
        )