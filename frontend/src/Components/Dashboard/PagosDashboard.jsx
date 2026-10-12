import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PendientesAccordion from './PendientesAccordion';
import { formatMonto } from '../../lib/dashboardFormat';
import { formatFecha } from '../../lib/dateFormat';

function renderDetalleRow(item) {
    return (
        <>
            <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatFecha(item.fecha)} - {item.servicio_nombre} - {item.cliente_nombre}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, whiteSpace: 'nowrap' }}>
                {formatMonto(item.pendiente)}
            </Typography>
        </>
    );
}

/**
 * Tarjeta de pagos pendientes a prestadores, con vencidos y forecast mensual
 * discriminado por prestador en acordeones expandibles.
 *
 * Props:
 *   pagos – [{ prestador_id, prestador_nombre, vencidos, vencidos_detalle, forecast: [{ mes, total, detalle }] }]
 */
export default function PagosDashboard({ pagos }) {
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>Pagos</Typography>

                {!pagos || pagos.length === 0 ? (
                    <Typography color="text.secondary">Sin pagos pendientes</Typography>
                ) : (
                    pagos.map((p) => {
                        const vencidosNum = Number(p.vencidos) || 0;
                        const totalForecast = p.forecast.reduce(
                            (sum, f) => sum + (Number(f.total) || 0),
                            0
                        );
                        const total = vencidosNum + totalForecast;

                        return (
                            <Accordion key={p.prestador_id} disableGutters elevation={0}
                                sx={{ border: '1px solid', borderColor: 'divider', mb: 1, '&:before': { display: 'none' } }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1, alignItems: 'center' }}>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            {p.prestador_nombre}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700 }}>
                                            {formatMonto(total)}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>

                                <AccordionDetails sx={{ pt: 0 }}>
                                    <PendientesAccordion
                                        vencidos={p.vencidos}
                                        vencidosDetalle={p.vencidos_detalle}
                                        forecast={p.forecast}
                                        renderDetalleRow={renderDetalleRow}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
