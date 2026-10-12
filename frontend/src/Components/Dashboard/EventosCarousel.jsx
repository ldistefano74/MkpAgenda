import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CardCalendario, { INLINE_CARD_WIDTH } from '../Calendario/CardCalendario';
import { useEntity } from '../../hooks/api/useEntity';

const CARD_GAP = 16;

/**
 * Carrusel no infinito de CardCalendario. Navega con botones anterior/siguiente.
 * @param {Array}    queryKey    - React Query key para la lista de eventos.
 * @param {Function} queryFn     - Función que retorna la promesa de fetch.
 * @param {string}   emptyMessage - Texto a mostrar cuando no hay eventos.
 * @param {boolean}  [showRecordatorio] - Mostrar el botón de recordatorio en las cards; default true.
 */
export default function EventosCarousel({ queryKey, queryFn, emptyMessage, showRecordatorio = true }) {
    const { useList } = useEntity('eventos');
    const [index, setIndex] = useState(0);

    // Ancho real de la ventana visible: en mobile la card se achica para entrar completa,
    // así el desplazamiento coincide exactamente con el ancho de cada card.
    const observerRef = useRef(null);
    const [viewportWidth, setViewportWidth] = useState(0);

    // Callback ref: la ventana se monta recién después de los early returns de loading/vacío.
    const viewportRef = useCallback((el) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!el) return;
        setViewportWidth(el.clientWidth);
        const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
        observer.observe(el);
        observerRef.current = observer;
    }, []);

    useEffect(() => () => observerRef.current?.disconnect(), []);

    const cardWidth = viewportWidth > 0
        ? Math.min(INLINE_CARD_WIDTH, viewportWidth)
        : INLINE_CARD_WIDTH;

    const { data: eventosRaw = [], isLoading } = useList({ queryKey, queryFn });
    const eventos = [...eventosRaw].sort((a, b) => {
        const dateA = new Date(a.fecha || 0);
        const dateB = new Date(b.fecha || 0);
        return dateA - dateB;
    });

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', gap: `${CARD_GAP}px` }}>
                {[1, 2, 3].map((n) => (
                    <Skeleton
                        key={n}
                        variant="rectangular"
                        width={INLINE_CARD_WIDTH}
                        height={220}
                        sx={{ borderRadius: 2, flexShrink: 0 }}
                    />
                ))}
            </Box>
        );
    }

    if (!eventos.length) {
        return (
            <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">{emptyMessage}</Typography>
            </Box>
        );
    }

    const total = eventos.length;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index === 0}
                    size="small"
                    sx={{ flexShrink: 0 }}
                >
                    <ChevronLeftIcon />
                </IconButton>

                {/* Ventana deslizante — py da margen vertical para el box-shadow */}
                <Box
                    ref={viewportRef}
                    sx={{ flex: 1, overflow: 'hidden', minWidth: 0, py: '8px', my: '-8px' }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            gap: `${CARD_GAP}px`,
                            transform: `translateX(${-index * (cardWidth + CARD_GAP)}px)`,
                            transition: 'transform 0.3s ease',
                        }}
                    >
                        {eventos.map((evento) => (
                            <Box key={evento.id} sx={{ flex: `0 0 ${cardWidth}px`, minWidth: 0 }}>
                                <CardCalendario
                                    eventoId={evento.id}
                                    staticProps={{
                                        id: evento.id,
                                        cliente: evento.cliente,
                                        cliente_nombre: evento.cliente_nombre,
                                        cliente_telefono: evento.cliente_telefono,
                                        tipo_evento_nombre: evento.tipo_evento_nombre,
                                        estado: evento.estado,
                                        direccion_servicios: evento.direccion_servicios,
                                        fecha: evento.fecha,
                                        recordatorio_enviado: evento.recordatorio_enviado,
                                    }}
                                    inline
                                    showRecordatorio={showRecordatorio}
                                    showEstado={false}
                                />
                            </Box>
                        ))}
                    </Box>
                </Box>

                <IconButton
                    onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                    disabled={index >= total - 1}
                    size="small"
                    sx={{ flexShrink: 0 }}
                >
                    <ChevronRightIcon />
                </IconButton>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                {index + 1} / {total}
            </Typography>
        </Box>
    );
}
