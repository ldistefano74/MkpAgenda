import re
from django.core.exceptions import ValidationError

def validar_cuit_cuil(value):
    """
    Valida que el CUIT/CUIL tenga el formato correcto y que el dígito verificador sea válido.
    Soporta formato con guiones (XX-XXXXXXXX-X) o solo números.
    """
    if not value:
        return

    # Dejar solo números
    cuit = re.sub(r'\D', '', str(value))
    
    if len(cuit) != 11:
        raise ValidationError("El CUIT/CUIL debe tener 11 dígitos numéricos.")
    
    base = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    
    acumulado = 0
    for i in range(10):
        acumulado += int(cuit[i]) * base[i]
        
    verificador = 11 - (acumulado % 11)
    
    if verificador == 11:
        verificador = 0
    
    # Si el resultado es 10, el CUIT no es válido (no existe dígito verificador 10)
    # y usualmente implica que se debe cambiar el tipo/prefijo.
    if verificador == 10:
         raise ValidationError("El CUIT/CUIL no es válido (dígito verificador calculado es 10).")

    if verificador != int(cuit[10]):
        raise ValidationError("El CUIT/CUIL no es válido.")
