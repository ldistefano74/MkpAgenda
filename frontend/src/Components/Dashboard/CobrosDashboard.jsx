import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import PendientesAccordion from './PendientesAccordion';
import { formatMonto } from '../../lib/dashboardFormat';
import { formatFecha } from '../../lib/dateFormat';

function renderDetalleRow(item) {
    return (
        <>
            <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatFecha(item.fecha)} - {item.tipo_evento_nombre} - {item.cliente_nombre}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, whiteSpace: 'nowrap' }}>
                {formatMonto(item.pendiente)}
            </Typography>
        </>
    );
}

/**
 * Tarjeta de cobros pendientes con vencidos y forecast mensual.
 *
 * Props:
 *   cobros – { vencidos: string, vencidos_detalle: [], forecast: [{ mes: string, total: string, detalle: [] }] }
 */
export default function CobrosDashboard({ cobros }) {
    if (!cobros) return null;

    const { vencidos, vencidos_detalle: vencidosDetalle, forecast } = cobros;
    const vencidosNum = Number(vencidos) || 0;
    const totalForecast = forecast.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
    const total = vencidosNum + totalForecast;

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>Cobros</Typography>

                <PendientesAccordion
                    vencidos={vencidos}
                    vencidosDetalle={vencidosDetalle}
                    forecast={forecast}
                    renderDetalleRow={renderDetalleRow}
                />

                <Divider sx={{ mb: 1, mt: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>Total pendiente</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{formatMonto(total)}</Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
