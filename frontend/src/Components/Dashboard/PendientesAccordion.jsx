import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { formatMes, formatMonto } from '../../lib/dashboardFormat';

/**
 * Abre el formulario de un evento en una pestaña nueva. Como el router es
 * hash-based (`createHashRouter`), construye la URL absoluta con el `#`.
 */
function openEventoInNewTab(eventoId) {
    const { origin, pathname } = window.location;
    window.open(`${origin}${pathname}#/eventos/${eventoId}/edit`, '_blank', 'noopener');
}

function DetalleList({ items, renderDetalleRow }) {
    if (!items || items.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Sin detalle
            </Typography>
        );
    }
    return (
        <List dense disablePadding>
            {items.map((item, i) => (
                <ListItem
                    // El id del item no alcanza como key: en cobros, un mismo evento
                    // puede aparecer más de una vez (una fila por cliente responsable),
                    // así que lo combinamos con el índice para garantizar unicidad.
                    key={`${item.servicio_evento_id ?? item.evento_id ?? 'item'}-${i}`}
                    disableGutters
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 }}
                >
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {renderDetalleRow(item)}
                    </Box>
                    {item.evento_id != null && (
                        <IconButton
                            size="small"
                            aria-label="Abrir evento"
                            onClick={() => openEventoInNewTab(item.evento_id)}
                            sx={{ flexShrink: 0 }}
                        >
                            <OpenInNewIcon fontSize="small" />
                        </IconButton>
                    )}
                </ListItem>
            ))}
        </List>
    );
}

function MesRow({ mes, total, detalle, renderDetalleRow, isFirst }) {
    return (
        <Accordion
            disableGutters
            elevation={0}
            square
            sx={{
                '&:before': { display: 'none' },
                // El tema global pone border:1px solid en las 4 caras y solo anula
                // el bottom en "&:not(:last-of-type)" (para acordeones sin gap).
                // Para no depender de esa regla (duplica la línea con el borderTop,
                // que nunca se anula), reseteamos el borde y solo agregamos un
                // borderTop entre filas consecutivas.
                border: 'none',
                borderTop: isFirst ? 'none' : '1px solid',
                borderColor: 'divider',
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 40 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                    <Typography variant="body2">{formatMes(mes)}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMonto(total)}</Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
                <DetalleList items={detalle} renderDetalleRow={renderDetalleRow} />
            </AccordionDetails>
        </Accordion>
    );
}

/**
 * Bloque reutilizable de "vencidos" + forecast mensual, con el detalle de
 * eventos/servicios que componen cada monto en acordeones anidados.
 *
 * Props:
 *   vencidos – string|number
 *   vencidosDetalle – array de items (forma libre, ver renderDetalleRow)
 *   forecast – [{ mes, total, detalle: [] }]
 *   renderDetalleRow – (item) => ReactNode, describe una fila de detalle
 *   vencidosLabel – texto del bloque de vencidos (default "Vencidos")
 *   forecastLabel – texto del acordeón que totaliza el forecast (default "Por vencer (próximos 6 meses)")
 */
export default function PendientesAccordion({
    vencidos, vencidosDetalle, forecast, renderDetalleRow,
    vencidosLabel = 'Vencidos',
    forecastLabel = 'Por vencer (próximos 6 meses)',
}) {
    const vencidosNum = Number(vencidos) || 0;
    const totalForecast = forecast.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

    return (
        <Box>
            {vencidosNum > 0 && (
                <Accordion
                    disableGutters
                    elevation={0}
                    sx={{
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:before': { display: 'none' },
                        '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
                    }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon color="error" />}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                            <Typography color="error.main" sx={{ fontWeight: 600 }}>{vencidosLabel}</Typography>
                            <Typography color="error.main" sx={{ fontWeight: 700 }}>{formatMonto(vencidos)}</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        <DetalleList items={vencidosDetalle} renderDetalleRow={renderDetalleRow} />
                    </AccordionDetails>
                </Accordion>
            )}

            {forecast.length > 0 && (
                <Accordion
                    disableGutters
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                            <Typography sx={{ fontWeight: 600 }}>{forecastLabel}</Typography>
                            <Typography sx={{ fontWeight: 700 }}>{formatMonto(totalForecast)}</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        {forecast.map((f, i) => (
                            <MesRow
                                key={f.mes}
                                {...f}
                                renderDetalleRow={renderDetalleRow}
                                isFirst={i === 0}
                            />
                        ))}
                    </AccordionDetails>
                </Accordion>
            )}
        </Box>
    );
}
