from django import forms

from chat.models import ChatRoom
from users.models import User


class ChatRoomForm(forms.ModelForm):
    """Форма создания комнаты."""

    class Meta:
        model = ChatRoom
        fields = (
            "name",
            "description",
            "is_private",
        )
        labels = {
            "name": "Название комнаты",
            "description": "Описание",
            "is_private": "Приватная комната",
        }
        widgets = {
            "name": forms.TextInput(
                attrs={
                    "placeholder": "Введите название комнаты",
                }
            ),
            "description": forms.Textarea(
                attrs={
                    "placeholder": "Введите описание комнаты",
                    "rows": 4,
                }
            ),
        }


class AddRoomMemberForm(forms.Form):
    """Форма добавления пользователя в комнату."""

    user = forms.ModelChoiceField(
        queryset=User.objects.none(),
        label="Пользователь",
    )

    def __init__(self, *args, room=None, **kwargs):
        super().__init__(*args, **kwargs)

        if room is not None:
            self.fields["user"].queryset = (
                User.objects
                .exclude(id=room.owner_id)
                .exclude(id__in=room.members.values_list("id", flat=True))
                .order_by("username")
            )

