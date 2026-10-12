import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import PlaceIcon from '@mui/icons-material/Place';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useNavigate } from 'react-router-dom';
import { useEntity } from '../../hooks/api/useEntity';
import useNotifications from '../../hooks/useNotifications/useNotifications';
import { openPresupuestoPdf } from '../../lib/presupuesto';
import WhatsAppButton from '../WhatsAppButton';
import RecordatorioButton from '../RecordatorioButton';
import { ESTADO_COLORS, ESTADO_LABELS } from './CalendarioPage';

/** Ancho máximo de la card en modo inline (carrusel). En pantallas angostas
 *  el carrusel la achica para que entre completa. */
export const INLINE_CARD_WIDTH = 270;

/**
 * Agrupa los servicios activos por nombre y devuelve un array de
 * { nombre, count } ordenado por orden de aparición.
 */
function agruparServicios(serviciosEvento = []) {
    const activos = serviciosEvento.filter((s) => s.activo !== false);
    const orden = [];
    const counts = {};
    for (const s of activos) {
        const nombre = s.servicio_nombre;
        if (!counts[nombre]) {
            counts[nombre] = 0;
            orden.push(nombre);
        }
        counts[nombre]++;
    }
    return orden.map((nombre) => ({ nombre, count: counts[nombre] }));
}

function formatFechaHora(fechaStr) {
    if (!fechaStr) return '';
    const d = new Date(fechaStr);
    const fecha = d.toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short',
    });
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const label = `${fecha} · ${hora}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Tarjeta de detalle para eventos del calendario.
 *
 * Props:
 *   anchor      – elemento DOM de anclaje (null = cerrado). Solo en modo Popover.
 *   eventoId    – ID del evento seleccionado
 *   staticProps – datos disponibles desde el list (sin fetch extra):
 *                 { id, cliente_nombre, cliente_telefono, tipo_evento_nombre,
 *                   estado, direccion_servicios, fecha?, recordatorio_enviado? }
 *   onClose     – callback al cerrar (solo en modo Popover)
 *   inline      – si true, renderiza como Paper card (para carrusel); default false
 *   showRecordatorio – si false, oculta el botón de recordatorio; default true
 *   showEstado  – si false, oculta el chip de estado (listados mono-estado); default true
 */
export default function CardCalendario({ anchor, eventoId, staticProps, onClose, inline = false, showRecordatorio = true, showEstado = true }) {
    const open = Boolean(anchor);
    const navigate = useNavigate();
    const notifications = useNotifications();
    const { useDetail } = useEntity('eventos');
    const { data: detail, isLoading } = useDetail(eventoId, {
        enabled: inline ? !!eventoId : (open && !!eventoId),
    });

    const handlePresupuesto = async () => {
        try {
            await openPresupuestoPdf(eventoId);
        } catch (err) {
            notifications.show(err.message, { severity: 'error' });
        }
    };

    if (!staticProps) return null;

    const {
        id,
        cliente_nombre,
        cliente_telefono,
        tipo_evento_nombre,
        estado,
        direccion_servicios,
        fecha,
    } = staticProps;

    const observaciones = detail?.observaciones;
    const clienteId = staticProps.cliente ?? detail?.cliente ?? null;
    const recordatorioEnviado = detail?.recordatorio_enviado ?? staticProps.recordatorio_enviado ?? null;
    const servicios = agruparServicios(detail?.servicios_evento);
    const estadoColor = ESTADO_COLORS[estado] ?? ESTADO_COLORS.P;
    const estadoLabel = ESTADO_LABELS[estado] ?? estado;
    const mapsUrl = direccion_servicios
        ? `https://maps.google.com/?q=${encodeURIComponent(direccion_servicios)}`
        : null;

    const contenido = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {/* ── Inline: fecha y hora ── */}
                {inline && fecha && (
                    <>
                        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                {formatFechaHora(fecha)}
                            </Typography>
                        </Box>
                        <Divider />
                    </>
                )}

                {/* ── Header: nombre + chip estado ── */}
                <Box sx={{ px: 2, pt: inline ? 1.5 : 2, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        {clienteId ? (
                            <Tooltip title="Editar cliente">
                                <Typography
                                    component="a"
                                    href={`#/clientes/${clienteId}/edit`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="h6"
                                    sx={{
                                        fontWeight: 700,
                                        lineHeight: 1.3,
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                >
                                    {cliente_nombre}
                                </Typography>
                            </Tooltip>
                        ) : (
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                {cliente_nombre}
                            </Typography>
                        )}
                        {(showEstado || !inline) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                {showEstado && (
                                    <Chip
                                        label={estadoLabel}
                                        size="small"
                                        sx={{
                                            backgroundColor: estadoColor,
                                            '& .MuiChip-label': { color: 'white' },
                                            fontWeight: 600,
                                        }}
                                    />
                                )}
                                {!inline && (
                                    <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {tipo_evento_nombre}
                    </Typography>
                </Box>

                <Divider />

                {/* ── Teléfono ── */}
                {cliente_telefono && (
                    <>
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Teléfono
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2">{cliente_telefono}</Typography>
                                <WhatsAppButton phone={cliente_telefono} />
                            </Box>
                        </Box>
                        <Divider />
                    </>
                )}

                {/* ── Servicios ── */}
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        Servicios
                    </Typography>
                    {isLoading ? (
                        <CircularProgress size={16} />
                    ) : servicios.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {servicios.map(({ nombre, count }) => (
                                <Chip
                                    key={nombre}
                                    label={count > 1 ? `${nombre} (x${count})` : nombre}
                                    size="small"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.disabled">
                            Sin servicios
                        </Typography>
                    )}
                </Box>

                {/* ── Dirección ── */}
                {direccion_servicios && (
                    <>
                        <Divider />
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Dirección
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2">
                                    {direccion_servicios}
                                </Typography>
                                {mapsUrl && (
                                    <Tooltip title="Abrir en Google Maps">
                                        <IconButton
                                            component="a"
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            size="small"
                                            color="primary"
                                            sx={{ flexShrink: 0 }}
                                        >
                                            <PlaceIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>
                    </>
                )}

                {/* ── Observaciones (solo si tiene) ── */}
                {!isLoading && observaciones && (
                    <>
                        <Divider />
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Observaciones
                            </Typography>
                            <Typography variant="body2" color="primary" sx={{ fontStyle: 'italic' }}>
                                {observaciones}
                            </Typography>
                        </Box>
                    </>
                )}

                <Divider />
            </Box>

            {/* ── Footer: botones ── */}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => { onClose?.(); navigate(`/eventos/${id}/edit`); }}
                    sx={{
                        backgroundColor: 'grey.900',
                        '&:hover': { backgroundColor: 'grey.800' },
                    }}
                >
                    Editar evento
                </Button>
                {showRecordatorio && (
                    <RecordatorioButton eventoId={id} enviado={recordatorioEnviado} />
                )}
                <Tooltip title="Presupuesto PDF">
                    <IconButton
                        onClick={handlePresupuesto}
                        sx={{
                            backgroundColor: 'grey.900',
                            color: 'white',
                            '&:hover': { backgroundColor: 'grey.800' },
                        }}
                    >
                        <PictureAsPdfIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );

    if (inline) {
        return (
            <Paper
                elevation={2}
                sx={{
                    // El ancho lo fija el contenedor del carrusel (ver EventosCarousel)
                    width: '100%',
                    minHeight: 320,
                    flexShrink: 0,
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {contenido}
            </Paper>
        );
    }

    return (
        <Popover
            open={open}
            anchorEl={anchor}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { sx: { width: 340, borderRadius: 2, overflow: 'hidden' } } }}
        >
            {contenido}
        </Popover>
    );
}
