import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

import useNotifications from '../hooks/useNotifications/useNotifications';
import { enviarRecordatorio, formatRecordatorioEnviado } from '../lib/recordatorio';

/** Amarillo mientras está pendiente de envío; ya enviado se ve como el resto de los botones. */
const COLOR_PENDIENTE = '#F9A825';

/**
 * Botón para enviar por WhatsApp el recordatorio de un evento.
 * Funciona haya sido enviado o no; en la variante `icon` el amarillo solo
 * destaca los que están pendientes de envío.
 *
 * @param {number|string} eventoId
 * @param {string|null}   enviado   - timestamp de envío (null = no enviado)
 * @param {'icon'|'button'} variant - icono (cards) o botón con texto (formulario)
 * @param {Function} [onEnviado]    - callback con el nuevo timestamp
 * @param {boolean}  [invalidate]   - refrescar las queries de eventos al enviar (default true)
 */
export default function RecordatorioButton({
    eventoId,
    enviado,
    variant = 'icon',
    onEnviado,
    invalidate = true,
    sx,
}) {
    const [loading, setLoading] = useState(false);
    const notifications = useNotifications();
    const queryClient = useQueryClient();

    const handleClick = async (event) => {
        event.stopPropagation();
        setLoading(true);
        try {
            const timestamp = await enviarRecordatorio(eventoId);
            onEnviado?.(timestamp);
            if (invalidate) queryClient.invalidateQueries({ queryKey: ['eventos'] });
        } catch (err) {
            notifications.show(err.message, { severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const tooltip = enviado
        ? `Recordatorio enviado el ${formatRecordatorioEnviado(enviado)} — reenviar`
        : 'Enviar recordatorio por WhatsApp';

    if (variant === 'button') {
        return (
            <Button
                size="small"
                variant="contained"
                onClick={handleClick}
                disabled={loading || !eventoId}
                startIcon={loading
                    ? <CircularProgress size={16} color="inherit" />
                    : <NotificationsActiveIcon fontSize="small" />}
                sx={sx}
            >
                Enviar
            </Button>
        );
    }

    // Pendiente: amarillo. Enviado: mismo negro que los demás botones de la card.
    const colores = enviado
        ? { backgroundColor: 'grey.900', '&:hover': { backgroundColor: 'grey.800' } }
        : { backgroundColor: COLOR_PENDIENTE, '&:hover': { backgroundColor: COLOR_PENDIENTE, filter: 'brightness(0.9)' } };

    return (
        <Tooltip title={tooltip}>
            <span>
                <IconButton
                    onClick={handleClick}
                    disabled={loading || !eventoId}
                    sx={{ color: 'white', ...colores, ...sx }}
                >
                    {loading
                        ? <CircularProgress size={20} color="inherit" />
                        : <NotificationsActiveIcon fontSize="small" />}
                </IconButton>
            </span>
        </Tooltip>
    );
}
