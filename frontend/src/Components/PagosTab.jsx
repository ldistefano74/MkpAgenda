import * as React from 'react';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import apiClient from '../lib/apiClient';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import { useMetadata } from '../hooks/api/useMetadata';
import { generateFieldsList } from '../lib/CRUDUtils';
import useNotifications from '../hooks/useNotifications/useNotifications';

/**
 * PagosTab - Pestaña de pagos a prestadores del evento.
 *
 * Muestra y permite gestionar los movimientos de egreso (pagos) asociados al evento.
 * Los prestadores y servicios disponibles se derivan de los servicios del evento.
 *
 * @param {Object} props
 * @param {string|number} props.eventoId - ID del evento
 * @param {Array} props.serviciosEvento - Lista de servicios del evento (fuente de prestadores y servicios)
 * @param {string} props.buildConceptoPago - Función que recibe servicioNombre y retorna el concepto
 */
export default function PagosTab({ eventoId, serviciosEvento, buildConceptoPago }) {
    const queryClient = useQueryClient();
    const notifications = useNotifications();

    const { data: metadata } = useMetadata('MovimientoCuentaSerializer');
    const fieldProps = useMemo(() => {
        const fieldsArray = generateFieldsList(metadata, {
            include: ['fecha', 'importe', 'concepto', 'medio_pago_cobro'],
        });
        return fieldsArray.reduce((acc, f) => { acc[f.name] = f; return acc; }, {});
    }, [metadata]);

    const queryKey = ['movimientos', 'evento', String(eventoId), 'tipo', 'E'];

    const { data: pagos = [] } = useQuery({
        queryKey,
        queryFn: () => apiClient.get(`/movimientos/?evento=${eventoId}&tipo=E`),
        enabled: Boolean(eventoId),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    // Derivar prestadores únicos de serviciosEvento
    const prestadorOptions = React.useMemo(() => {
        const seen = new Map();
        (serviciosEvento || []).forEach(s => {
            if (s.prestador && !seen.has(s.prestador)) {
                seen.set(s.prestador, { id: s.prestador, label: s.prestador_nombre || String(s.prestador) });
            }
        });
        return Array.from(seen.values());
    }, [serviciosEvento]);

    // Saldo pendiente de un servicio_evento: importe acordado menos lo ya pagado.
    // excludePagoId permite descontar el propio pago que se está editando (para no restarse a sí mismo).
    const getPendienteServicio = React.useCallback((servicioEventoId, excludePagoId) => {
        const servicio = (serviciosEvento || []).find(s => s.id === servicioEventoId);
        if (!servicio) return null;
        const pagado = pagos
            .filter(p => p.servicio_evento === servicioEventoId && (excludePagoId == null || p.id !== excludePagoId))
            .reduce((sum, p) => sum + (Number(p.importe) || 0), 0);
        return (Number(servicio.importe_prestador) || 0) - pagado;
    }, [serviciosEvento, pagos]);

    // Derivar servicios por prestador (id de servicio_evento), excluyendo los ya saldados por completo.
    // excludePagoId permite seguir mostrando el servicio del pago que se está editando.
    const getServiciosParaPrestador = React.useCallback((prestadorId, { excludePagoId } = {}) => {
        return (serviciosEvento || [])
            .filter(s => s.prestador === prestadorId && s.id)
            .map(s => ({ s, pendiente: getPendienteServicio(s.id, excludePagoId) }))
            .filter(({ pendiente }) => pendiente > 0.01)
            .map(({ s, pendiente }) => {
                const nombre = s.servicio_nombre || String(s.servicio);
                return {
                    id: s.id, // id del ServicioEvento
                    label: s.descripcion ? `${nombre} - ${s.descripcion}` : nombre,
                    pendiente,
                };
            });
    }, [serviciosEvento, getPendienteServicio]);

    // Calcular totales para el footer
    const totalAPagar = (serviciosEvento || []).reduce(
        (sum, s) => sum + (Number(s.importe_prestador) || 0), 0
    );
    const totalPagado = pagos.reduce(
        (sum, p) => sum + (Number(p.importe) || 0), 0
    );
    const saldoPrestadores = totalAPagar - totalPagado;

    const today = new Date().toISOString().split('T')[0];

    const getEmptyItem = () => {
        const autoPrestador = prestadorOptions.length === 1 ? prestadorOptions[0] : null;
        const autoServicios = autoPrestador ? getServiciosParaPrestador(autoPrestador.id) : [];
        const autoServicio = autoServicios.length === 1 ? autoServicios[0] : null;
        const servicioLabel = autoServicio?.label || '';
        return {
            fecha: today,
            prestador: autoPrestador?.id || null,
            _prestadorLabel: autoPrestador?.label || '',
            servicio_evento: autoServicio?.id || null,
            _servicioLabel: servicioLabel,
            medio_pago_cobro: null,
            importe: autoServicio?.pendiente != null ? autoServicio.pendiente : '',
            concepto: buildConceptoPago(servicioLabel),
        };
    };

    const handleBeforeAccept = async (item, isEditing) => {
        if (!item.prestador || !item.servicio_evento) {
            return 'Debe seleccionar prestador y servicio';
        }
        const pendiente = getPendienteServicio(item.servicio_evento, isEditing ? item.id : undefined);
        if (pendiente != null && Number(item.importe) > pendiente + 0.01) {
            return `El importe no puede superar el saldo pendiente de pago (${formatMonto(pendiente)})`;
        }
        const payload = {
            prestador: item.prestador,
            evento: eventoId,
            servicio_evento: item.servicio_evento,
            tipo: 'E',
            fecha: item.fecha,
            medio_pago_cobro: item.medio_pago_cobro || null,
            importe: item.importe,
            concepto: item.concepto || buildConceptoPago(item._servicioLabel || ''),
        };
        try {
            if (isEditing && item.id) {
                await apiClient.put(`/movimientos/${item.id}/`, payload);
            } else {
                await apiClient.post('/movimientos/', payload);
            }
            await invalidate();
            return undefined;
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
            await invalidate();
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

    return (
        <BaseEditGrid
            rows={pagos}
            onRowsChange={() => { }}
            onBeforeAccept={handleBeforeAccept}
            onDelete={handleDelete}
            columns={[
                {
                    field: 'prestador_nombre',
                    headerName: 'Prestador',
                    flex: 1,
                },
                {
                    field: 'fecha',
                    headerName: 'Fecha',
                    width: 110,
                    valueFormatter: formatFecha,
                },
                {
                    field: 'servicio_evento_nombre',
                    headerName: 'Servicio',
                    flex: 1,
                },
                {
                    field: 'medio_pago_cobro_nombre',
                    headerName: 'Medio',
                    width: 130,
                },
                {
                    field: 'importe',
                    headerName: 'Importe',
                    width: 130,
                    align: 'right',
                    headerAlign: 'right',
                    valueFormatter: formatMonto,
                },
            ]}
            getRowId={(row) => row.id}
            modalTitle="Pago"
            loading={!metadata}
            getEmptyItem={getEmptyItem}
            isItemValid={(item) => Boolean(item.fecha && item.prestador && item.servicio_evento && item.importe && item.concepto)}
            footerContent={
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total: {formatMonto(totalAPagar)}
                    {'  |  '}
                    Pagado: {formatMonto(totalPagado)}
                    {'  |  '}
                    Saldo prestadores:{' '}
                    <Typography
                        component="span"
                        variant="body2"
                        sx={{
                            color: saldoPrestadores > 0 ? 'error.main' : saldoPrestadores < 0 ? 'warning.main' : 'success.main',
                            fontWeight: 'bold',
                        }}
                    >
                        {formatMonto(saldoPrestadores)}
                    </Typography>
                </Typography>
            }
        >
            {({ currentItem, setCurrentItem }) => {
                const serviciosDisponibles = getServiciosParaPrestador(currentItem.prestador, { excludePagoId: currentItem.id });
                // Auto-seleccionar servicio si hay solo uno y el prestador acaba de cambiar
                const selectedPrestadorOption = prestadorOptions.find(p => p.id === currentItem.prestador) || null;
                const selectedServicioOption = serviciosDisponibles.find(s => s.id === currentItem.servicio_evento) || null;

                return (
                    <>
                        {/* Prestador */}
                        <Autocomplete
                            options={prestadorOptions}
                            value={selectedPrestadorOption}
                            onChange={(_, newValue) => {
                                const newServicios = newValue ? getServiciosParaPrestador(newValue.id, { excludePagoId: currentItem.id }) : [];
                                const autoServicio = newServicios.length === 1 ? newServicios[0] : null;
                                const servicioLabel = autoServicio?.label || '';
                                setCurrentItem(prev => ({
                                    ...prev,
                                    prestador: newValue?.id || null,
                                    _prestadorLabel: newValue?.label || '',
                                    servicio_evento: autoServicio?.id || null,
                                    _servicioLabel: servicioLabel,
                                    importe: autoServicio?.pendiente != null ? autoServicio.pendiente : prev.importe,
                                    concepto: buildConceptoPago(servicioLabel),
                                }));
                            }}
                            getOptionLabel={(option) => option.label || ''}
                            isOptionEqualToValue={(option, val) => option.id === val?.id}
                            size="small"
                            disableClearable={false}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Prestador"
                                    required
                                    size="small"
                                />
                            )}
                        />

                        {/* Servicio */}
                        <Autocomplete
                            options={serviciosDisponibles}
                            value={selectedServicioOption}
                            disabled={!currentItem.prestador}
                            onChange={(_, newValue) => {
                                const servicioLabel = newValue?.label || '';
                                setCurrentItem(prev => ({
                                    ...prev,
                                    servicio_evento: newValue?.id || null,
                                    _servicioLabel: servicioLabel,
                                    importe: newValue?.pendiente != null ? newValue.pendiente : prev.importe,
                                    concepto: buildConceptoPago(servicioLabel),
                                }));
                            }}
                            getOptionLabel={(option) => option.label || ''}
                            isOptionEqualToValue={(option, val) => option.id === val?.id}
                            size="small"
                            disableClearable={false}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Servicio"
                                    required
                                    size="small"
                                />
                            )}
                        />

                        {/* Fecha */}
                        <BaseInput
                            field={fieldProps.fecha}
                            value={currentItem.fecha || ''}
                            onChange={(value) => setCurrentItem(prev => ({ ...prev, fecha: value }))}
                        />

                        {/* Medio de pago */}
                        <BaseAutocomplete
                            field={{ ...fieldProps.medio_pago_cobro, maxLength: 20 }}
                            value={currentItem.medio_pago_cobro}
                            onChange={(value) => setCurrentItem(prev => ({ ...prev, medio_pago_cobro: value }))}
                            lookupName="mediopagocobro"
                            filterParams={{ disponible_pago: true }}
                        />

                        {/* Importe */}
                        <BaseInput
                            field={fieldProps.importe}
                            value={currentItem.importe}
                            onChange={(value) => setCurrentItem(prev => ({ ...prev, importe: value }))}
                        />

                        {/* Concepto */}
                        <BaseInput
                            field={fieldProps.concepto}
                            value={currentItem.concepto || ''}
                            onChange={(value) => setCurrentItem(prev => ({ ...prev, concepto: value }))}
                        />
                    </>
                );
            }}
        </BaseEditGrid>
    );
}
