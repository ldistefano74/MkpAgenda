from rest_framework import serializers
from .validators import model_validator
from .base import BaseModelSerializer

# TODO: usar cache
def create_serializer(refModel):

    class AutoSerializer(BaseModelSerializer):
        class Meta:
            model = refModel
            fields = "__all__"

    return AutoSerializer
