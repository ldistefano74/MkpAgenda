const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export async function openPresupuestoPdf(eventoId) {
    const url = `${BACKEND_URL}/api/reports/presupuesto/${eventoId}/`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        let errorMsg = `Error ${response.status}`;
        try {
            const data = await response.json();
            errorMsg = data.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
}
