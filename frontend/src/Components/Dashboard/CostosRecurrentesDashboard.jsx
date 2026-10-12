import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import apiClient from '../../lib/apiClient';
import { formatFecha as formatFechaBase } from '../../lib/dateFormat';

function formatFecha(isoDate) {
    return isoDate ? formatFechaBase(isoDate) : '—';
}

function CostoRow({ item, vencido, onCargar }) {
    const textColor = vencido ? 'error.main' : 'text.primary';
    const secondaryColor = vencido ? 'error.main' : 'text.secondary';
    return (
        <TableRow hover>
            <TableCell sx={{ py: 0.75 }}>
                <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 500, color: textColor }}>{item.nombre}</Box>
                    {' '}
                    <Box component="span" sx={{ color: secondaryColor }}>({item.categoria_costo_nombre})</Box>
                </Typography>
            </TableCell>
            <TableCell sx={{ py: 0.75 }}>
                <Typography variant="body2" color={textColor}>{item.recurrencia}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75 }}>
                <Typography variant="body2" color={textColor}>{formatFecha(item.ultima_fecha)}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75 }}>
                <Typography variant="body2" color={textColor}>
                    {item.proxima_fecha ? formatFecha(item.proxima_fecha) : 'Sin historial'}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75, pr: 0.5 }}>
                <Tooltip title="Cargar costo">
                    <IconButton size="small" color="primary" onClick={() => onCargar(item)}>
                        <AddCircleOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

const today = new Date().toISOString().split('T')[0];

function CuotaRow({ item, onPagar, isPagando }) {
    const vencida = item.fecha_vencimiento < today;
    const color = vencida ? 'error.main' : 'text.primary';
    const secondaryColor = vencida ? 'error.main' : 'text.secondary';
    return (
        <TableRow hover>
            <TableCell sx={{ py: 0.75 }}>
                <Typography variant="body2" color={color}>{formatFecha(item.fecha_vencimiento)}</Typography>
            </TableCell>
            <TableCell sx={{ py: 0.75 }}>
                <Typography variant="body2" color={secondaryColor}>{item.categoria_costo_nombre}</Typography>
            </TableCell>
            <TableCell sx={{ py: 0.75, maxWidth: 200 }}>
                <Typography
                    variant="body2"
                    color={color}
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {item.descripcion}
                </Typography>
            </TableCell>
            <TableCell align="center" sx={{ py: 0.75 }}>
                <Typography variant="body2" color={color}>
                    {item.cantidad_cuotas ? `${item.numero_cuota}/${item.cantidad_cuotas}` : item.numero_cuota}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75 }}>
                <Typography variant="body2" color={color}>
                    {parseFloat(item.importe).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75, pr: 0.5 }}>
                <Tooltip title="Marcar como pagada">
                    <span>
                        <IconButton size="small" color="success" onClick={() => onPagar(item.id)} disabled={isPagando}>
                            <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

export default function CostosRecurrentesDashboard() {
    const [ventana, setVentana] = useState('fin_de_mes');
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', 'costos-recurrentes', ventana],
        queryFn: () => apiClient.get(`/dashboard/costos-recurrentes/?ventana=${ventana}`),
    });

    const { data: cuotasData, isLoading: isLoadingCuotas } = useQuery({
        queryKey: ['dashboard', 'cuotas-pendientes', ventana],
        queryFn: () => apiClient.get(`/dashboard/cuotas-pendientes/?ventana=${ventana}`),
    });

    const { mutate: pagarCuota, variables: pagandoId } = useMutation({
        mutationFn: (id) => apiClient.post(`/dashboard/cuotas-pendientes/${id}/pagar/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'cuotas-pendientes'] });
        },
    });

    const vencidosSet = new Set((data?.vencidos ?? []).map((i) => i.id));
    const allCostos = [
        ...(data?.vencidos ?? []),
        ...(data?.por_vencer ?? []),
    ].sort((a, b) => {
        const fa = a.proxima_fecha ?? '9999-99-99';
        const fb = b.proxima_fecha ?? '9999-99-99';
        return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
    const total = allCostos.length;
    const cuotas = cuotasData ?? [];

    const handleCargar = (item) => {
        navigate('/costos/new', {
            state: {
                costo_recurrente: item.fill_costo_recurrente,
                categoria_costo: item.fill_categoria_costo,
                importe: item.fill_importe,
                cantidad_cuotas: item.fill_cantidad_cuotas,
                medio_pago: item.fill_medio_pago,
                proveedor: item.fill_proveedor,
                descripcion: item.fill_descripcion,
            },
        });
    };

    if (isLoading || isLoadingCuotas) return null;
    if (total === 0 && cuotas.length === 0) return null;

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="h6">Costos</Typography>
                    <ToggleButtonGroup
                        value={ventana}
                        exclusive
                        onChange={(_, val) => val && setVentana(val)}
                        size="small"
                    >
                        <ToggleButton value="fin_de_mes">
                            {new Date().toLocaleString('es-AR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
                        </ToggleButton>
                        <ToggleButton value="30_dias">30 días</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {total > 0 && (
                    <Accordion
                        defaultExpanded
                        disableGutters
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Costos Recurrentes</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, px: 0 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Periodicidad</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Última carga</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Próxima fecha</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {allCostos.map((item) => (
                                        <CostoRow
                                            key={item.id}
                                            item={item}
                                            vencido={vencidosSet.has(item.id)}
                                            onCargar={handleCargar}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </AccordionDetails>
                    </Accordion>
                )}

                {cuotas.length > 0 && (
                    <Accordion
                        defaultExpanded
                        disableGutters
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', mt: 1.5, '&:before': { display: 'none' } }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Cuotas Pendientes</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, px: 0 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Vencimiento</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Categoría</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600 }}>Cuota</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Importe</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {cuotas.map((item) => (
                                        <CuotaRow
                                            key={item.id}
                                            item={item}
                                            onPagar={pagarCuota}
                                            isPagando={pagandoId === item.id}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </AccordionDetails>
                    </Accordion>
                )}
            </CardContent>
        </Card>
    );
}
