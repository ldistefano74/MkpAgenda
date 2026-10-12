import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

import apiClient from '../lib/apiClient';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseSelect from './BaseComponents/BaseSelect';
import { useMetadata } from '../hooks/api/useMetadata';
import { generateFieldsList } from '../lib/CRUDUtils';
import useNotifications from '../hooks/useNotifications/useNotifications';

/**
 * CobrosTab - Pestaña de cobros del evento.
 *
 * Muestra y permite gestionar los movimientos de ingreso (cobros) asociados al evento.
 * Los movimientos se persisten en la API directamente desde este componente.
 *
 * Con cliente_cuenta a nivel servicio, un mismo evento puede tener varios clientes
 * responsables: el cliente de cabecera (paga los servicios sin cliente_cuenta) más
 * cada cliente_cuenta distinto. Cada cobro se imputa al cliente que efectivamente paga.
 *
 * @param {Object} props
 * @param {string|number} props.eventoId - ID del evento
 * @param {number} props.clienteId - ID del cliente de cabecera del evento
 * @param {string} props.clienteNombre - Nombre del cliente de cabecera
 * @param {Array} props.serviciosEvento - Lista de servicios del evento (para calcular saldo)
 * @param {string} props.concepto - Concepto autogenerado para los movimientos
 * @param {string} props.eventoEstado - Estado actual del evento (P/C/X)
 */
export default function CobrosTab({ eventoId, clienteId, clienteNombre, serviciosEvento, concepto, eventoEstado }) {
    const queryClient = useQueryClient();
    const notifications = useNotifications();
    const eventoNoConfirmado = eventoEstado !== 'C';

    const { data: metadata } = useMetadata('MovimientoCuentaSerializer');
    const fieldProps = useMemo(() => {
        const fieldsArray = generateFieldsList(metadata, {
            include: ['fecha', 'importe', 'concepto', 'medio_pago_cobro'],
        });
        return fieldsArray.reduce((acc, f) => { acc[f.name] = f; return acc; }, {});
    }, [metadata]);

    const queryKey = ['movimientos', 'evento', String(eventoId), 'tipo', 'I'];

    const { data: cobros = [] } = useQuery({
        queryKey,
        queryFn: () => apiClient.get(`/movimientos/?evento=${eventoId}&tipo=I`),
        enabled: Boolean(eventoId),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    // Clientes involucrados: cabecera + cada cliente_cuenta distinto de los servicios.
    const clientesInvolucrados = useMemo(() => {
        const map = new Map();
        if (clienteId) {
            map.set(clienteId, { id: clienteId, nombre: clienteNombre || 'Cliente del evento' });
        }
        (serviciosEvento || []).forEach(s => {
            if (s.cliente_cuenta && s.cliente_cuenta !== clienteId && !map.has(s.cliente_cuenta)) {
                map.set(s.cliente_cuenta, {
                    id: s.cliente_cuenta,
                    nombre: s.cliente_cuenta_nombre || `Cliente ${s.cliente_cuenta}`,
                });
            }
        });
        return Array.from(map.values());
    }, [clienteId, clienteNombre, serviciosEvento]);

    const nombreDeCliente = (id) =>
        clientesInvolucrados.find(c => c.id === id)?.nombre || '';

    // Saldo pendiente para un cliente responsable dado.
    const saldoDeCliente = (id) => {
        if (!id) return 0;
        const total = (serviciosEvento || [])
            .filter(s => (s.cliente_cuenta || clienteId) === id)
            .reduce((sum, s) => sum + (Number(s.importe) || 0), 0);
        const cobrado = cobros
            .filter(c => (c.cliente ?? c.cliente_id) === id)
            .reduce((sum, c) => sum + (Number(c.importe) || 0), 0);
        return total - cobrado;
    };

    const today = new Date().toISOString().split('T')[0];

    const getEmptyItem = () => {
        const pendiente = saldoDeCliente(clienteId);
        return {
            cliente_cobro: clienteId,
            fecha: today,
            medio_pago_cobro: null,
            importe: pendiente > 0 ? pendiente : '',
            concepto,
        };
    };

    const handleBeforeAccept = async (item, isEditing) => {
        const payload = {
            cliente: item.cliente_cobro || clienteId,
            evento: eventoId,
            tipo: 'I',
            fecha: item.fecha,
            medio_pago_cobro: item.medio_pago_cobro || null,
            importe: item.importe,
            concepto: item.concepto || concepto,
        };
        try {
            if (isEditing && item.id) {
                await apiClient.put(`/movimientos/${item.id}/`, payload);
            } else {
                await apiClient.post('/movimientos/', payload);
            }
            await invalidate();
            return undefined; // proceder: cierra el modal
        } catch (err) {
            if (err.body && typeof err.body === 'object') {
                return Object.entries(err.body)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n');
            }
            return err.message || 'Error al guardar';
        }
    };

    const handleDelete = async (row) => {
        try {
            await apiClient.delete(`/movimientos/${row.id}/`);
            await invalidate();
        } catch (err) {
            notifications.show(`Error al eliminar: ${err.message}`, { severity: 'error' });
            await invalidate(); // refetch para restaurar si falló
        }
    };

    const formatMonto = (value) => {
        if (value == null || value === '') return '-';
        return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    };

    const formatFecha = (value) => {
        if (!value) return '';
        return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    };

    const multiCliente = clientesInvolucrados.length > 1;

    // Opciones del selector de cliente (formato de BaseSelect).
    const clienteChoices = clientesInvolucrados.map(c => ({
        value: c.id,
        display_name: c.nombre,
    }));

    const columns = [
        {
            field: 'fecha',
            headerName: 'Fecha',
            width: 120,
            valueFormatter: formatFecha,
        },
        ...(multiCliente ? [{
            field: 'cliente_nombre',
            headerName: 'Cliente',
            flex: 1,
            valueGetter: (value, row) =>
                row.cliente_nombre || nombreDeCliente(row.cliente ?? row.cliente_id),
        }] : []),
        {
            field: 'medio_pago_cobro_nombre',
            headerName: 'Medio',
            flex: 1,
        },
        {
            field: 'importe',
            headerName: 'Importe',
            width: 140,
            align: 'right',
            headerAlign: 'right',
            valueFormatter: formatMonto,
        },
    ];

    return (
        <BaseEditGrid
            rows={cobros}
            onRowsChange={() => { }} // noop: la API es la fuente de verdad
            onBeforeAccept={handleBeforeAccept}
            onDelete={handleDelete}
            columns={columns}
            getRowId={(row) => row.id}
            modalTitle="Cobro"
            loading={!metadata}
            getEmptyItem={getEmptyItem}
            isItemValid={(item) => Boolean(item.fecha && item.importe && item.concepto)}
            footerContent={
                multiCliente ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {clientesInvolucrados.map(c => {
                            const saldo = saldoDeCliente(c.id);
                            return (
                                <Typography key={c.id} variant="body2" sx={{ color: 'text.secondary' }}>
                                    {c.nombre} — Saldo:{' '}
                                    <Typography
                                        component="span"
                                        variant="body2"
                                        sx={{
                                            color: saldo > 0 ? 'success.main' : saldo < 0 ? 'error.main' : 'text.primary',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {formatMonto(saldo)}
                                    </Typography>
                                </Typography>
                            );
                        })}
                    </Box>
                ) : (
                    (() => {
                        const total = (serviciosEvento || []).reduce((sum, s) => sum + (Number(s.importe) || 0), 0);
                        const cobrado = cobros.reduce((sum, c) => sum + (Number(c.importe) || 0), 0);
                        const saldo = total - cobrado;
                        return (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Total: {formatMonto(total)}
                                {'  |  '}
                                Cobrado: {formatMonto(cobrado)}
                                {'  |  '}
                                Saldo:{' '}
                                <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{
                                        color: saldo > 0 ? 'success.main' : saldo < 0 ? 'error.main' : 'text.primary',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {formatMonto(saldo)}
                                </Typography>
                            </Typography>
                        );
                    })()
                )
            }
        >
            {({ currentItem, setCurrentItem }) => (
                <>
                    {eventoNoConfirmado && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            El evento no está confirmado.
                        </Alert>
                    )}
                    {multiCliente && (
                        <BaseSelect
                            field={{ name: 'cliente_cobro', label: 'Cliente', required: true, choices: clienteChoices }}
                            value={currentItem.cliente_cobro ?? clienteId}
                            onChange={(value) => setCurrentItem(prev => {
                                const pendiente = saldoDeCliente(value);
                                return {
                                    ...prev,
                                    cliente_cobro: value,
                                    importe: pendiente > 0 ? pendiente : '',
                                };
                            })}
                        />
                    )}
                    <BaseInput
                        field={fieldProps.fecha}
                        value={currentItem.fecha || ''}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, fecha: value }))}
                    />
                    <BaseAutocomplete
                        field={{ ...fieldProps.medio_pago_cobro, maxLength: 20 }}
                        value={currentItem.medio_pago_cobro}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, medio_pago_cobro: value }))}
                        lookupName="mediopagocobro"
                        filterParams={{ disponible_cobro: true }}
                    />
                    <BaseInput
                        field={fieldProps.importe}
                        value={currentItem.importe}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, importe: value }))}
                    />
                    <BaseInput
                        field={fieldProps.concepto}
                        value={currentItem.concepto || ''}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, concepto: value }))}
                    />
                </>
            )}
        </BaseEditGrid>
    );
}
