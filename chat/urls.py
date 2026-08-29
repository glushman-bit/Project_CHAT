from django.urls import path

from .views import chat_page, CreateRoomView, AddRoomMemberView

urlpatterns = [
    path("create/", CreateRoomView.as_view(), name="create_room"),
    path("<str:room_name>/members/add/", AddRoomMemberView.as_view(), name="add_room_member"),
    path("<str:room_name>/", chat_page, name="chat"),
]