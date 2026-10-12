export function formatMonto(value) {
    const n = Number(value);
    if (!value || isNaN(n)) return '-';
    return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMes(mes) {
    const [year, month] = mes.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'long', year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
}
