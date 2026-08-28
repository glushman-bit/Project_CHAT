from django.db import models
from django.shortcuts import get_object_or_404, render

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
