/**
 * Construye una URL de WhatsApp click-to-chat para un número argentino.
 * Limpia el número y agrega el prefijo 54 si no está presente.
 */
export function buildWhatsAppUrl(phone) {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    const number = digits.startsWith('54') ? digits : `54${digits}`;
    return `https://wa.me/${number}`;
}
