/**
 * Formatea una fecha ISO ("YYYY-MM-DD") como dd/mm/aaaa con ceros a la
 * izquierda. Parsea los componentes a mano (en vez de `new Date(iso)`) para
 * evitar que el string se interprete como medianoche UTC y se corra un día
 * al convertir a la zona horaria local del navegador.
 */
export function formatFecha(fecha) {
    if (!fecha) return '';
    const [year, month, day] = fecha.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}
