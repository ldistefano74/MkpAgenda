from rest_framework import serializers
from .validators import model_validator


class BaseModelSerializer(serializers.ModelSerializer):
    """
    Clase base para todos los serializers del proyecto.
    Proporciona métodos para generar metadata de campos y cabecera.
    """

    def validate(self, data):
        data = super().validate(data)

        model_validator(self.Meta.model, data, instance=self.instance)

        return data

    def get_metadata_fields(self, depth=0):
        """
        Extrae metadatos de campos del serializer,
        con soporte para recursión en relaciones anidadas.
        Devuelve una lista de diccionarios con información de cada campo.
        
        Args:
            depth: Nivel de profundidad para expandir serializers anidados (default=0)
        
        Returns:
            Lista de diccionarios con metadata de campos
        """
        fields_data = []
        
        for field_name, field in self.fields.items():
            # Mapeo de tipos de campo DRF a tipos internos de Django
            field_type = field.__class__.__name__
            
            # Mapear tipos DRF a tipos Django para mantener compatibilidad
            type_mapping = {
                'PrimaryKeyRelatedField': 'ForeignKey',
                'SlugRelatedField': 'ForeignKey',
                'SerializerMethodField': 'CharField',  # Campo calculado
                'ListField': 'JSONField',
            }
            
            internal_type = type_mapping.get(field_type, field_type)
            
            field_data = {
                "name": field_name,
                "type": internal_type,
                "verbose_name": getattr(field, "label", field_name) or field_name,
                "max_length": getattr(field, "max_length", None),
                "default": field.default if field.default != serializers.empty else None,
                "null": field.allow_null,
                "blank": not field.required,
                "tooltip": getattr(field, "help_text", None) or None,
            }
            
            # Agregar choices solo si es un ChoiceField
            if isinstance(field, serializers.ChoiceField) and hasattr(field, 'choices') and field.choices:
                field_data["choices"] = list(field.choices.items()) if isinstance(field.choices, dict) else field.choices
            
            # Datos específicos de números decimales
            if hasattr(field, 'max_digits'):
                field_data["max_digits"] = field.max_digits
            if hasattr(field, 'decimal_places'):
                field_data["decimal_places"] = field.decimal_places
            
            # Metadatos extra para el frontend (máscaras, etc.)
            # Primero intentar obtener desde el campo del serializer
            if hasattr(field, 'input_mask'):
                field_data["input_mask"] = field.input_mask
            if hasattr(field, 'mask_options'):
                field_data["mask_options"] = field.mask_options
            
            # Si no están en el serializer, intentar obtenerlos del modelo (Introspección)
            if hasattr(self, 'Meta') and hasattr(self.Meta, 'model'):
                model = self.Meta.model
                try:
                    source = getattr(field, 'source', field_name)
                    # Si source es válido y refiere a un campo del modelo
                    if source and source != '*' and '.' not in source:
                        model_field = model._meta.get_field(source)
                        
                        # 1. Corregir tipo TextField (DRF lo ve como CharField)
                        if model_field.get_internal_type() == 'TextField':
                            field_data["type"] = 'TextField'

                        # 2. Identificar TimeField (para campos como duración)
                        if model_field.get_internal_type() == 'TimeField':
                            field_data["type"] = 'TimeField'

                        # 3. Identificar DurationField
                        if model_field.get_internal_type() == 'DurationField':
                            field_data["type"] = 'DurationField'
                        
                        # 4. Obtener default del modelo si el serializer no tiene uno explícito
                        if field_data["default"] is None and model_field.has_default():
                            wrapper = model_field.get_default()
                            # Evitar serializar funciones o objetos complejos
                            if not callable(wrapper):
                                field_data["default"] = wrapper

                        # 5. Ajustar blank si el modelo es estricto, aunque DRF diga required=False (por tener default)
                        # Si en el modelo blank=False, visualmente querremos saberlo, aunque la API lo acepte vacío.
                        if not model_field.blank:
                            field_data["blank"] = False
                        
                        if 'input_mask' not in field_data and hasattr(model_field, 'input_mask'):
                            field_data["input_mask"] = model_field.input_mask
                        if 'mask_options' not in field_data and hasattr(model_field, 'mask_options'):
                            field_data["mask_options"] = model_field.mask_options

                        # Obtener help_text del modelo si no está en el serializer
                        if not field_data["tooltip"] and hasattr(model_field, 'help_text') and model_field.help_text:
                            field_data["tooltip"] = str(model_field.help_text)

                    elif source and source != '*' and '.' in source:
                        # Traversar la ruta punteada para obtener el verbose_name del campo final
                        parts = source.split('.')
                        current_model = model
                        for part in parts[:-1]:
                            rel_field = current_model._meta.get_field(part)
                            current_model = rel_field.related_model
                        final_field = current_model._meta.get_field(parts[-1])
                        # Sólo usar el verbose_name del modelo si el label no fue seteado
                        # explícitamente en el serializer (DRF auto-genera field_name humanizado)
                        auto_label = field_name.replace('_', ' ').capitalize()
                        if field_data["verbose_name"] in (field_name, auto_label):
                            field_data["verbose_name"] = str(final_field.verbose_name).capitalize()
                except:
                    pass
            
            # Si es una relación directa por ID (PrimaryKeyRelatedField, SlugRelatedField)
            if isinstance(field, (serializers.PrimaryKeyRelatedField, serializers.SlugRelatedField)):
                if hasattr(field, 'queryset') and field.queryset is not None:
                    field_data["related_model"] = field.queryset.model._meta.model_name
            
            # Lógica unificada para relaciones anidadas (Serializers completos)
            if depth > 0 and isinstance(field, serializers.BaseSerializer):
                # Determinar el serializer objetivo (si es lista, mirar adentro)
                target = field.child if isinstance(field, serializers.ListSerializer) else field
                
                # Solo procesamos si el target es un Serializer (tiene estructura)
                if isinstance(target, serializers.BaseSerializer):
                    field_data["type"] = "ReverseRelation"
                    
                    if hasattr(target, 'Meta') and hasattr(target.Meta, 'model'):
                        field_data["related_model"] = target.Meta.model._meta.model_name
                    
                    # Delegar recursivamente usando el método de instancia del hijo
                    if hasattr(target, 'get_metadata_fields'):
                        field_data["fields"] = target.get_metadata_fields(depth - 1)
                    else:
                        field_data["fields"] = []
            
            fields_data.append(field_data)
        
        return fields_data
    
    def get_metadata(self, depth=0):
        """
        Obtiene toda la metadata del serializer: header + fields.
        Este es el método principal que debe usarse para obtener metadata completa.
        
        Args:
            depth: Nivel de profundidad para expandir serializers anidados (default=0)
        
        Returns:
            Diccionario con toda la metadata (model, app_label, plural_name, verbose_name, fields)
        """
        # Valores por defecto
        model_verbose_name = self.__class__.__name__
        app_label = "API"
        plural_name = self.__class__.__name__
        
        # Intentar obtener información del modelo si existe
        if hasattr(self, 'Meta') and hasattr(self.Meta, 'model'):
            model = self.Meta.model
            model_verbose_name = model._meta.verbose_name
            app_label = model._meta.app_label
            plural_name = model._meta.verbose_name_plural


        return {
            "model": model_verbose_name,
            "app_label": app_label,
            "plural_name": plural_name,
            "verbose_name": model_verbose_name,
            "fields": self.get_metadata_fields(depth=depth),
        }
    
    def get_new_instance(self):
        """
        Devuelve un diccionario con los valores por defecto para una nueva instancia.
        Ignora campos read_only (como id).

        Returns:
            Diccionario con los valores por defecto de cada campo editable
        """
        model = getattr(self.Meta, 'model', None)
        new_instance = {}

        for field_name, field in self.fields.items():
            # Ignorar campos read_only (como id)
            if field.read_only:
                continue

            default_value = None

            # 1. Intentar obtener default del serializer
            if field.default is not serializers.empty:
                default_value = field.default() if callable(field.default) else field.default

            # 2. Si no hay default en serializer, buscar en el modelo
            elif model:
                source = getattr(field, 'source', field_name)
                if source and source != '*' and '.' not in source:
                    try:
                        model_field = model._meta.get_field(source)
                        if model_field.has_default():
                            model_default = model_field.get_default()
                            if not callable(model_default):
                                default_value = model_default
                    except:
                        pass

            # 3. Para ListSerializer (many=True), usar lista vacía
            if default_value is None and isinstance(field, serializers.ListSerializer):
                default_value = []

            new_instance[field_name] = default_value

        return new_instance

    class Meta:
        abstract = True
