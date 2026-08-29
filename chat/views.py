from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.db import models
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views import View

from chat.forms import (
    AddRoomMemberForm,
    ChatRoomForm,
    ChatRoomUpdateForm,
)
from chat.models import ChatRoom
from users.models import User


def chat_page(request, room_name):
    room = get_object_or_404(
        ChatRoom.objects.prefetch_related("members"),
        name=room_name,
    )

    is_room_member = False

    if request.user.is_authenticated:
        is_room_member = (
            room.owner_id == request.user.id
            or room.members.filter(
                id=request.user.id
            ).exists()
        )

        if (
            room.is_private
            and not is_room_member
        ):
            raise PermissionDenied(
                "У вас нет доступа к этой комнате."
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
            | models.Q(owner=request.user)
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
            "is_room_member": is_room_member,
            "available_users": available_users,
        },
    )


class CreateRoomView(LoginRequiredMixin, View):
    """Создание комнаты."""

    def post(self, request):
        form = ChatRoomForm(
            request.POST,
            request.FILES,
        )

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
                    "description": room.description,
                    "avatar": (
                        room.avatar.url
                        if room.avatar
                        else None
                    ),
                    "is_private": room.is_private,
                },
            },
            status=201,
        )


class UpdateRoomView(LoginRequiredMixin, View):
    """Редактирование комнаты."""

    def post(self, request, room_id):
        room = get_object_or_404(
            ChatRoom,
            id=room_id,
        )

        if room.owner_id != request.user.id:
            raise PermissionDenied(
                "Только владелец комнаты может "
                "изменять её настройки."
            )

        form = ChatRoomUpdateForm(
            request.POST,
            request.FILES,
            instance=room,
        )

        if not form.is_valid():
            return JsonResponse(
                {
                    "success": False,
                    "errors": form.errors,
                },
                status=400,
            )

        room = form.save()

        return JsonResponse(
            {
                "success": True,
                "room": {
                    "id": room.id,
                    "name": room.name,
                    "description": room.description,
                    "avatar": (
                        room.avatar.url
                        if room.avatar
                        else None
                    ),
                    "is_private": room.is_private,
                },
            }
        )


class AddRoomMemberView(LoginRequiredMixin, View):
    """Добавление участника в комнату."""

    def post(self, request, room_id):
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


class RemoveRoomMemberView(LoginRequiredMixin, View):
    """Удаление участника владельцем комнаты."""

    def post(self, request, room_id, user_id):
        room = get_object_or_404(
            ChatRoom,
            id=room_id,
        )

        if room.owner_id != request.user.id:
            raise PermissionDenied(
                "Только владелец комнаты может "
                "удалять участников."
            )

        if user_id == room.owner_id:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "Владелец комнаты не может "
                        "быть удалён."
                    ),
                },
                status=400,
            )

        user = get_object_or_404(
            User,
            id=user_id,
        )

        room.members.remove(user)

        return JsonResponse(
            {
                "success": True,
                "user_id": user.id,
            }
        )


class LeaveRoomView(LoginRequiredMixin, View):
    """Выход текущего пользователя из комнаты."""

    def post(self, request, room_id):
        room = get_object_or_404(
            ChatRoom,
            id=room_id,
        )

        if room.owner_id == request.user.id:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "Владелец комнаты не может "
                        "покинуть её."
                    ),
                },
                status=400,
            )

        room.members.remove(request.user)

        available_room = (
            ChatRoom.objects
            .filter(
                models.Q(is_private=False)
                | models.Q(members=request.user)
                | models.Q(owner=request.user)
            )
            .exclude(id=room.id)
            .distinct()
            .order_by("id")
            .first()
        )

        if available_room:
            redirect_url = reverse(
                "chat",
                kwargs={
                    "room_name": available_room.name,
                },
            )
        else:
            redirect_url = "/"

        return JsonResponse(
            {
                "success": True,
                "redirect_url": redirect_url,
            }
        )


class JoinRoomView(LoginRequiredMixin, View):
    """Вступление пользователя в публичную комнату."""

    def post(self, request, room_id):
        room = get_object_or_404(
            ChatRoom,
            id=room_id,
        )

        if room.is_private:
            return JsonResponse(
                {
                    "success": False,
                    "error": "В приватную комнату можно попасть только по приглашению.",
                },
                status=403,
            )

        if room.owner_id == request.user.id:
            return JsonResponse(
                {
                    "success": True,
                }
            )

        room.members.add(request.user)

        return JsonResponse(
            {
                "success": True,
                "room": {
                    "id": room.id,
                    "name": room.name,
                },
            }
        )

