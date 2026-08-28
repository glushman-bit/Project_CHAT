from django import forms

from chat.models import ChatRoom


class ChatRoomForm(forms.ModelForm):

    class Meta:
        model = ChatRoom
        fields = (
            "name",
            "description",
            "is_private",
        )
