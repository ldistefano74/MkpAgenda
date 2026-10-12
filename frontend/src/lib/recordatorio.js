import apiClient from './apiClient';

/**
 * Abre WhatsApp con el mensaje de recordatorio del evento y lo marca como enviado.
 *
 * La ventana se abre de forma sincrónica (antes del fetch) para no ser bloqueada
 * por el navegador como popup.
 *
 * @param {number|string} eventoId
 * @returns {Promise<string>} timestamp ISO de envío
 */
export async function enviarRecordatorio(eventoId) {
    const win = window.open('', '_blank');
    try {
        const data = await apiClient.get(`/eventos/${eventoId}/recordatorio/`);
        if (win) {
            win.location.href = data.whatsapp_url;
        } else {
            window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer');
        }
        const marcado = await apiClient.post(`/eventos/${eventoId}/recordatorio/`, {});
        return marcado.recordatorio_enviado;
    } catch (err) {
        win?.close();
        throw new Error(err.body?.error || err.message);
    }
}

/** Formatea el timestamp de envío como "DD/MM/YYYY HH:MM". */
export function formatRecordatorioEnviado(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
}
