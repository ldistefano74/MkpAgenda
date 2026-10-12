class BaseQuerySet:
    """
    Clase base para querysets de la aplicación.

    Atributos:
        model: Modelo Django asociado (debe definirse en subclases).

    Métodos:
        get_base_queryset(): Retorna el queryset sin filtros ni anotaciones.
        get_queryset(**filters): Punto de entrada principal. Acepta filtros
            opcionales como kwargs nombrados. Las subclases que necesiten
            filtros o contexto (ej: acción HTTP) deben sobrescribir este método.
    """

    model = None

    def get_base_queryset(self):
        if self.model is None:
            raise NotImplementedError("BaseQuerySet subclasses must define a `model` attribute.")
        return self.model.objects.all()

    def get_queryset(self, **filters):
        return self.get_base_queryset()
