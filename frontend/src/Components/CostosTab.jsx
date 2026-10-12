import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Typography from '@mui/material/Typography';

import apiClient from '../lib/apiClient';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import { useMetadata } from '../hooks/api/useMetadata';
import { generateFieldsList } from '../lib/CRUDUtils';
import useNotifications from '../hooks/useNotifications/useNotifications';

/**
 * CostosTab - Pestaña de costos del evento.
 *
 * Muestra y permite gestionar los Costos imputados directamente al evento.
 * Los costos se persisten en la API desde este componente (igual que CobrosTab/PagosTab).
 *
 * Sólo se ofrecen medios de pago que no manejan cuotas: los costos en cuotas
 * se cargan desde la pantalla general de Costos.
 *
 * @param {Object} props
 * @param {string|number} props.eventoId - ID del evento
 */
export default function CostosTab({ eventoId }) {
    const queryClient = useQueryClient();
    const notifications = useNotifications();

    const { data: metadata } = useMetadata('costo');
    const fieldProps = useMemo(() => {
        const fieldsArray = generateFieldsList(metadata, {
            include: ['fecha', 'categoria_costo', 'descripcion', 'importe', 'medio_pago', 'proveedor'],
        });
        return fieldsArray.reduce((acc, f) => { acc[f.name] = f; return acc; }, {});
    }, [metadata]);

    const queryKey = ['costos', 'evento', String(eventoId)];

    const { data: costos = [] } = useQuery({
        queryKey,
        queryFn: () => apiClient.get(`/costos/?evento=${eventoId}`),
        enabled: Boolean(eventoId),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const today = new Date().toISOString().split('T')[0];

    const getEmptyItem = () => ({
        fecha: today,
        categoria_costo: null,
        descripcion: '',
        importe: '',
        medio_pago: null,
        proveedor: null,
    });

    const handleBeforeAccept = async (item, isEditing) => {
        const payload = {
            fecha: item.fecha,
            categoria_costo: item.categoria_costo,
            descripcion: item.descripcion,
            importe: item.importe,
            medio_pago: item.medio_pago || null,
            proveedor: item.proveedor || null,
            evento: eventoId,
        };
        try {
            if (isEditing && item.id) {
                await apiClient.put(`/costos/${item.id}/`, payload);
            } else {
                await apiClient.post('/costos/', payload);
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
            await apiClient.delete(`/costos/${row.id}/`);
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

    const totalCostos = costos.reduce((sum, c) => sum + (Number(c.importe) || 0), 0);

    return (
        <BaseEditGrid
            rows={costos}
            onRowsChange={() => { }} // noop: la API es la fuente de verdad
            onBeforeAccept={handleBeforeAccept}
            onDelete={handleDelete}
            columns={[
                {
                    field: 'fecha',
                    headerName: 'Fecha',
                    width: 120,
                    valueFormatter: formatFecha,
                },
                {
                    field: 'categoria_costo_nombre',
                    headerName: 'Categoría',
                    flex: 1,
                },
                {
                    field: 'descripcion',
                    headerName: 'Descripción',
                    flex: 1.5,
                },
                {
                    field: 'importe',
                    headerName: 'Importe',
                    width: 140,
                    align: 'right',
                    headerAlign: 'right',
                    valueFormatter: formatMonto,
                },
            ]}
            getRowId={(row) => row.id}
            modalTitle="Costo"
            loading={!metadata}
            getEmptyItem={getEmptyItem}
            isItemValid={(item) => Boolean(item.fecha && item.categoria_costo && item.descripcion && item.importe)}
            footerContent={
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total costos:{' '}
                    <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: 'text.primary', fontWeight: 'bold' }}
                    >
                        {formatMonto(totalCostos)}
                    </Typography>
                </Typography>
            }
        >
            {({ currentItem, setCurrentItem }) => (
                <>
                    <BaseInput
                        field={fieldProps.fecha}
                        value={currentItem.fecha || ''}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, fecha: value }))}
                    />
                    <BaseAutocomplete
                        field={fieldProps.categoria_costo}
                        value={currentItem.categoria_costo}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, categoria_costo: value }))}
                        filterParams={{ activo: true }}
                    />
                    <BaseInput
                        field={{ ...fieldProps.descripcion, multiline: true, rows: 2 }}
                        value={currentItem.descripcion || ''}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, descripcion: value }))}
                    />
                    <BaseInput
                        field={fieldProps.importe}
                        value={currentItem.importe ?? ''}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, importe: value }))}
                    />
                    <BaseAutocomplete
                        field={fieldProps.medio_pago}
                        value={currentItem.medio_pago}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, medio_pago: value }))}
                        filterParams={{ disponible_pago: true, incluye_cuotas: false }}
                    />
                    <BaseAutocomplete
                        field={fieldProps.proveedor}
                        value={currentItem.proveedor}
                        onChange={(value) => setCurrentItem(prev => ({ ...prev, proveedor: value }))}
                        filterParams={{ activo: true }}
                    />
                </>
            )}
        </BaseEditGrid>
    );
}
