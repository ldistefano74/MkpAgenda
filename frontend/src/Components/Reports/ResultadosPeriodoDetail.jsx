import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import apiClient from '../../lib/apiClient';
import { formatFecha } from '../../lib/dateFormat';

/**
 * Drilldown del informe de resultados: contenido que se despliega al
 * expandir una fila de período en <ResultadosReport>. Muestra 3 Accordion
 * fijos (Ingresos/Costos/Pagos, mismo patrón que PendientesAccordion.jsx);
 * cada uno hace fetch de su detalle recién al expandirse.
 */

const formatImporte = (value) =>
    `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Abre una ruta de edición en una pestaña nueva. Como el router es
// hash-based (`createHashRouter`), construye la URL absoluta con el `#`.
function openInNewTab(url) {
    const { origin, pathname } = window.location;
    window.open(`${origin}${pathname}#${url}`, '_blank', 'noopener');
}

// URL de edición según la fuente de la fila (mismo criterio que
// MovimientosReport.getRowEditUrl): un costo tiene página propia; un
// movimiento (cobro/pago) se edita dentro de su evento, si lo tiene.
function getRowEditUrl(row) {
    if (row.origen === 'costo') return `/costos/${row.id}/edit`;
    if (row.origen === 'movimiento' && row.evento_id) return `/eventos/${row.evento_id}/edit`;
    return null;
}

function DetalleList({ rows }) {
    if (!rows || rows.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Sin movimientos
            </Typography>
        );
    }
    return (
        <List dense disablePadding>
            {rows.map((row) => {
                const editUrl = getRowEditUrl(row);
                return (
                    <ListItem
                        key={`${row.origen}-${row.id}`}
                        disableGutters
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ width: 90, flexShrink: 0 }}>
                            {formatFecha(row.fecha)}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={row.concepto}>
                            {row.concepto}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
                            {formatImporte(row.importe)}
                        </Typography>
                        {editUrl && (
                            <IconButton
                                size="small"
                                aria-label="Abrir en pestaña nueva"
                                onClick={() => openInNewTab(editUrl)}
                                sx={{ flexShrink: 0 }}
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        )}
                    </ListItem>
                );
            })}
        </List>
    );
}

function TipoAccordion({ periodo, tipo, label, total }) {
    const [expanded, setExpanded] = React.useState(false);

    const { data: rows = [], isFetching } = useQuery({
        queryKey: ['reportes/resultados/detalle', periodo, tipo],
        queryFn: () => apiClient.get(`/reportes/resultados/detalle/?periodo=${periodo}&tipo=${tipo}`),
        enabled: expanded,
    });

    return (
        <Accordion
            disableGutters
            elevation={0}
            expanded={expanded}
            onChange={(_e, isExpanded) => setExpanded(isExpanded)}
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                '&:before': { display: 'none' },
                '&:not(:last-of-type)': { borderBottom: 'none' },
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatImporte(total)}</Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
                {isFetching ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={18} />
                    </Box>
                ) : (
                    <DetalleList rows={rows} />
                )}
            </AccordionDetails>
        </Accordion>
    );
}

export default function ResultadosPeriodoDetail({ row }) {
    return (
        <Box sx={{ px: 1 }}>
            <TipoAccordion periodo={row.periodo} tipo="ingresos" label="Ingresos" total={row.ingresos} />
            <TipoAccordion periodo={row.periodo} tipo="costos" label="Costos" total={row.costos} />
            <TipoAccordion periodo={row.periodo} tipo="pagos" label="Pagos" total={row.pagos} />
        </Box>
    );
}
