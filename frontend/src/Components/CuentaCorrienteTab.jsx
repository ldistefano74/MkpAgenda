import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { GridActionsCellItem } from '@mui/x-data-grid';

import apiClient from '../lib/apiClient';
import { useMetadata } from '../hooks/api/useMetadata';
import { generateFieldsList } from '../lib/CRUDUtils';
import BaseDataGrid from './BaseComponents/BaseDataGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseSelect from './BaseComponents/BaseSelect';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import useNotifications from '../hooks/useNotifications/useNotifications';

const TIPO_MOVIMIENTO_LABELS = {
    'M': 'Manual',
    'E': 'Evento',
    'S': 'Servicio',
};

/**
 * Abre el formulario de un evento en una pestaña nueva. Como el router es
 * hash-based (`createHashRouter`), construye la URL absoluta con el `#`.
 */
function openEventoInNewTab(eventoId) {
    const { origin, pathname } = window.location;
    window.open(`${origin}${pathname}#/eventos/${eventoId}/edit`, '_blank', 'noopener');
}

/**
 * CuentaCorrienteTab - Pestaña de cuenta corriente para Prestador/Cliente.
 *
 * Muestra los movimientos de la cuenta corriente (vista read-only) y permite
 * agregar/eliminar movimientos manuales.
 *
 * @param {Object} props
 * @param {string|number} props.prestadorId - ID del prestador
 */
export default function CuentaCorrienteTab({ prestadorId, clienteId }) {
    const queryClient = useQueryClient();
    const notifications = useNotifications();
    const [open, setOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [currentItem, setCurrentItem] = React.useState({});

    // Metadata y defaults del serializer
    const { data: metadata } = useMetadata('MovimientoCuentaSerializer');
    const { data: newInstanceDefaults } = useQuery({
        queryKey: ['new', 'MovimientoCuentaSerializer'],
        queryFn: () => apiClient.get('/new/MovimientoCuentaSerializer/'),
        staleTime: Infinity,
    });

    const fieldProps = React.useMemo(() => {
        const fieldsArray = generateFieldsList(metadata, {
            include: ['fecha', 'tipo', 'importe', 'concepto', 'evento', 'servicio_evento', 'medio_pago_cobro'],
        });
        return fieldsArray.reduce((acc, field) => {
            acc[field.name] = field;
            return acc;
        }, {});
    }, [metadata]);

    // Datos de cuenta corriente (movimientos + saldo)
    const personaParam = prestadorId ? `prestador=${prestadorId}` : `cliente=${clienteId}`;
    const personaKey = prestadorId ? ['prestador', prestadorId] : ['cliente', clienteId];
    const { data, isLoading } = useQuery({
        queryKey: ['cuenta-corriente', ...personaKey],
        queryFn: () => apiClient.get(`/cuenta-corriente/?${personaParam}`),
        enabled: Boolean(prestadorId || clienteId),
    });

    const movimientos = data?.movimientos || [];
    const saldo = data?.saldo || 0;

    const invalidateAfterSave = () => {
        queryClient.invalidateQueries({ queryKey: ['cuenta-corriente', ...personaKey] });
        queryClient.invalidateQueries({ queryKey: ['lookup', 'eventospendientescobro'] });
        queryClient.invalidateQueries({ queryKey: ['lookup', 'serviciospendientespago'] });
    };

    // Mutación para crear movimiento manual
    const createMutation = useMutation({
        mutationFn: (movData) => apiClient.post('/movimientos/', movData),
        onSuccess: invalidateAfterSave,
    });

    // Mutación para actualizar movimiento manual
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => apiClient.put(`/movimientos/${id}/`, data),
        onSuccess: invalidateAfterSave,
    });

    // Mutación para eliminar movimiento manual
    const deleteMutation = useMutation({
        mutationFn: (movId) => apiClient.delete(`/movimientos/${movId}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cuenta-corriente', ...personaKey] });
        },
    });

    const handleDelete = async (row) => {
        try {
            await deleteMutation.mutateAsync(row.id);
        } catch (err) {
            notifications.show(`Error al eliminar: ${err.message}`, { severity: 'error' });
        }
    };

    // Columnas de la grilla
    const columns = [
        {
            field: 'fecha',
            headerName: 'Fecha',
            width: 110,
            valueFormatter: (value) => {
                if (!value) return '';
                return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                });
            },
        },
        {
            field: 'tipo_movimiento',
            headerName: 'Origen',
            width: 100,
            valueFormatter: (value) => TIPO_MOVIMIENTO_LABELS[value] || value,
        },
        {
            field: 'tipo',
            headerName: 'Tipo',
            width: 80,
        },
        {
            field: 'concepto',
            headerName: 'Concepto',
            flex: 1,
        },
        {
            field: 'medio_pago_cobro',
            headerName: 'Medio',
            width: 140,
        },
        {
            field: 'importe_signo',
            headerName: 'Importe',
            width: 130,
            align: 'right',
            headerAlign: 'right',
            valueFormatter: (value) => {
                if (value == null) return '-';
                return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
            },
        },
        {
            field: 'actions_delete',
            type: 'actions',
            width: 45,
            getActions: (params) => {
                if (params.row.tipo_movimiento !== 'M') return [];
                return [
                    <GridActionsCellItem
                        key="delete"
                        icon={<DeleteIcon />}
                        label="Eliminar"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(params.row);
                        }}
                    />,
                ];
            },
        },
        {
            field: 'actions_evento',
            type: 'actions',
            width: 45,
            getActions: (params) => {
                if (!params.row.evento) return [];
                return [
                    <GridActionsCellItem
                        key="open-evento"
                        icon={<OpenInNewIcon />}
                        label="Ver evento"
                        onClick={(e) => {
                            e.stopPropagation();
                            openEventoInNewTab(params.row.evento);
                        }}
                    />,
                ];
            },
        },
    ];

    const handleAdd = () => {
        setEditingId(null);
        // Pre-llenar con la fecha actual
        const today = new Date().toISOString().split('T')[0];
        setCurrentItem({ ...(newInstanceDefaults ?? {}), fecha: today });
        setError(null);
        setOpen(true);
    };

    // Reverse-map: de label ("Ingreso") a value ("I") para el BaseSelect
    const tipoLabelToValue = React.useMemo(() => {
        const choices = fieldProps.tipo?.choices || [];
        return choices.reduce((acc, c) => { acc[c.display_name] = c.value; return acc; }, {});
    }, [fieldProps.tipo]);

    const handleRowClick = (params) => {
        const row = params.row;
        if (row.tipo_movimiento !== 'M') return;
        setEditingId(row.id);
        setCurrentItem({
            fecha: row.fecha || '',
            tipo: tipoLabelToValue[row.tipo] || row.tipo || '',
            importe: row.importe || '',
            concepto: row.concepto || '',
            evento: row.evento_id || null,
            servicio_evento: row.servicio_evento_id || null,
            medio_pago_cobro: row.medio_pago_cobro_id || null,
        });
        setError(null);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingId(null);
        setError(null);
    };

    const handleAccept = async () => {
        setError(null);
        const payload = {
            ...(prestadorId ? { prestador: prestadorId } : { cliente: clienteId }),
            fecha: currentItem.fecha,
            tipo: currentItem.tipo,
            importe: currentItem.importe,
            concepto: currentItem.concepto,
            evento: clienteId ? (currentItem.evento || null) : null,
            servicio_evento: prestadorId ? (currentItem.servicio_evento || null) : null,
            medio_pago_cobro: currentItem.medio_pago_cobro || null,
        };
        try {
            if (editingId) {
                await updateMutation.mutateAsync({ id: editingId, data: payload });
            } else {
                await createMutation.mutateAsync(payload);
            }
            setOpen(false);
            setEditingId(null);
        } catch (err) {
            if (err.body && typeof err.body === 'object') {
                const details = Object.entries(err.body)
                    .map(([k, v]) => {
                        const label = fieldProps[k]?.label || k;
                        const msg = Array.isArray(v) ? v.join(', ') : v;
                        return `${label}: ${msg}`;
                    })
                    .join('\n');
                setError(details);
            } else {
                setError(err.message);
            }
        }
    };

    const isValid = Boolean(currentItem.fecha && currentItem.tipo && currentItem.importe && currentItem.concepto);

    return (
        <Box>
            {/* Saldo */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="subtitle1">Saldo:</Typography>
                <Typography
                    variant="h6"
                    color={
                        saldo === 0 ? 'text.primary'
                            : prestadorId
                                ? (saldo > 0 ? 'error.main' : 'success.main')
                                : (saldo > 0 ? 'success.main' : 'error.main')
                    }
                    sx={{ fontWeight: 'bold' }}
                >
                    ${Math.abs(Number(saldo)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Typography>
            </Box>

            {/* Grilla de movimientos */}
            <BaseDataGrid
                rows={movimientos}
                columns={columns}
                getRowId={(row) => row.id || `${row.tipo_movimiento}-${row.evento}-${row.servicio_evento}-${row.cliente_id ?? ''}`}
                variant="inline"
                maxRows={10}
                loading={isLoading}
                showActions={false}
                onRowClick={handleRowClick}
            />

            {/* Botón agregar */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                    variant="contained"
                    onClick={handleAdd}
                    sx={{ minWidth: 0, width: 40, height: 40, p: 0 }}
                    aria-label="Agregar movimiento"
                >
                    <AddIcon />
                </Button>
            </Box>

            {/* Dialog para agregar movimiento */}
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" disableRestoreFocus>
                <DialogTitle>{editingId ? 'Editar Movimiento' : 'Agregar Movimiento'}</DialogTitle>
                <DialogContent>
                    <Collapse in={!!error}>
                        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                            <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
                        </Alert>
                    </Collapse>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {fieldProps.fecha && (
                            <BaseInput
                                field={fieldProps.fecha}
                                value={currentItem.fecha}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, fecha: value }))}
                            />
                        )}
                        {fieldProps.tipo && (
                            <BaseSelect
                                field={fieldProps.tipo}
                                value={currentItem.tipo}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, tipo: value }))}
                            />
                        )}
                        {clienteId && fieldProps.evento && (
                            <BaseAutocomplete
                                field={fieldProps.evento}
                                value={currentItem.evento}
                                disabled={currentItem.tipo !== 'I'}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, evento: value }))}
                                onSelectionChange={(opt) => {
                                    setCurrentItem(prev => ({
                                        ...prev,
                                        ...(opt?.extra?.[0] != null && { importe: opt.extra[0] }),
                                        ...(opt?.label && !prev.concepto && { concepto: opt.label }),
                                    }));
                                }}
                                lookupName="eventospendientescobro"
                                filterParams={{ cliente: clienteId }}
                            />
                        )}
                        {prestadorId && fieldProps.servicio_evento && (
                            <BaseAutocomplete
                                field={fieldProps.servicio_evento}
                                value={currentItem.servicio_evento}
                                disabled={currentItem.tipo !== 'E'}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, servicio_evento: value }))}
                                onSelectionChange={(opt) => {
                                    setCurrentItem(prev => ({
                                        ...prev,
                                        ...(opt?.extra?.[0] != null && { importe: opt.extra[0] }),
                                        ...(opt?.label && !prev.concepto && { concepto: opt.label }),
                                    }));
                                }}
                                lookupName="serviciospendientespago"
                                filterParams={{ prestador: prestadorId }}
                            />
                        )}
                        {fieldProps.medio_pago_cobro && (
                            <BaseAutocomplete
                                field={{ ...fieldProps.medio_pago_cobro, maxLength: 20 }}
                                value={currentItem.medio_pago_cobro}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, medio_pago_cobro: value }))}
                                lookupName="mediopagocobro"
                                filterParams={clienteId ? { disponible_cobro: true } : { disponible_pago: true }}
                            />
                        )}
                        {fieldProps.concepto && (
                            <BaseInput
                                field={fieldProps.concepto}
                                value={currentItem.concepto}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, concepto: value }))}
                            />
                        )}
                        {fieldProps.importe && (
                            <BaseInput
                                field={fieldProps.importe}
                                value={currentItem.importe}
                                onChange={(value) => setCurrentItem(prev => ({ ...prev, importe: value }))}
                            />
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleAccept}
                        variant="contained"
                        disabled={!isValid || createMutation.isPending || updateMutation.isPending}
                    >
                        Aceptar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
