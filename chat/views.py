from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.db import models
from django.shortcuts import get_object_or_404, render, redirect
from django.urls import reverse
from django.views import View
from django.views.generic import CreateView

from chat.forms import ChatRoomForm, AddRoomMemberForm
from chat.models import ChatRoom


def chat_page(request, room_name):

    room = get_object_or_404(
        ChatRoom,
        name=room_name,
    )

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
        },
    )


class CreateRoomView(LoginRequiredMixin, CreateView):
    """Создание комнаты."""

    model = ChatRoom
    form_class = ChatRoomForm
    template_name = "chat/create_room.html"

    def form_valid(self, form):
        """Назначает текущего пользователя владельцем комнаты."""
        form.instance.owner = self.request.user

        response = super().form_valid(form)

        self.object.members.add(self.request.user)

        return response

    def get_success_url(self):
        """Перенаправляет пользователя в созданную комнату."""
        return reverse(
            "chat",
            kwargs={"room_name": self.object.name},
        )


class AddRoomMemberView(LoginRequiredMixin, View):
    """Добавление участника в комнату."""

    template_name = "chat/add_room_member.html"

    def get_room(self, room_name):
        return get_object_or_404(
            ChatRoom,
            name=room_name,
        )

    def dispatch(self, request, *args, **kwargs):
        self.room = self.get_room(
            kwargs["room_name"],
        )

        if self.room.owner_id != request.user.id:
            raise PermissionDenied(
                "Только владелец комнаты может управлять участниками."
            )

        return super().dispatch(
            request,
            *args,
            **kwargs,
        )

    def get(self, request, room_name):
        form = AddRoomMemberForm(
            room=self.room,
        )

        return render(
            request,
            self.template_name,
            {
                "form": form,
                "room": self.room,
            },
        )

    def post(self, request, room_name):
        form = AddRoomMemberForm(
            request.POST,
            room=self.room,
        )

        if form.is_valid():
            user = form.cleaned_data["user"]

            self.room.members.add(user)

            return redirect(
                "add_room_member",
                room_name=self.room.name,
            )

        return render(
            request,
            self.template_name,
            {
                "form": form,
                "room": self.room,
            },
        )
