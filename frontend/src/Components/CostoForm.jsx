import * as React from 'react';
import { useParams, useLocation } from 'react-router';
import dayjs from 'dayjs';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import { useEntity } from '../hooks/api/useEntity';

const today = new Date().toISOString().split('T')[0];

function buildCuotas(fecha, importe, cantidad, existingCuotas = []) {
    const base = dayjs(fecha || today);
    const total = Math.round(parseFloat(importe || 0) * 100);
    const baseAmount = Math.floor(total / cantidad);
    const lastAmount = total - baseAmount * (cantidad - 1);
    return Array.from({ length: cantidad }, (_, i) => {
        const existing = existingCuotas[i];
        return {
            ...(existing?.id ? { id: existing.id } : {}),
            numero_cuota: i + 1,
            fecha_vencimiento: base.add(i + 1, 'month').startOf('month').format('YYYY-MM-DD'),
            importe: ((i === cantidad - 1 ? lastAmount : baseAmount) / 100).toFixed(2),
        };
    });
}

function recalcImportes(cuotas, importe) {
    const n = cuotas.length;
    if (n === 0) return cuotas;
    const total = Math.round(parseFloat(importe || 0) * 100);
    const baseAmount = Math.floor(total / n);
    const lastAmount = total - baseAmount * (n - 1);
    return cuotas.map((c, i) => ({
        ...c,
        importe: ((i === n - 1 ? lastAmount : baseAmount) / 100).toFixed(2),
    }));
}

function recalcFechas(cuotas, fecha) {
    const base = dayjs(fecha || today);
    return cuotas.map((c, i) => ({
        ...c,
        fecha_vencimiento: base.add(i + 1, 'month').startOf('month').format('YYYY-MM-DD'),
    }));
}

/**
 * CostoForm - Formulario para crear/editar Costos.
 *
 * Funcionalidades específicas:
 * - Al crear, sugiere la fecha de hoy como valor inicial.
 * - Al seleccionar un costo recurrente, pre-completa categoría, importe,
 *   medio de pago, proveedor y descripción con datos del último costo
 *   registrado para ese costo recurrente (via lookup con extra fields).
 * - Al editar, el campo costo_recurrente queda deshabilitado.
 * - Si el medio de pago tiene incluye_cuotas=true, muestra inputs para
 *   definir cuotas (cantidad + importe por cuota).
 */
export default function CostoForm() {
    const { id } = useParams();
    const { state: navState } = useLocation();
    const isEdit = Boolean(id);

    const { useDetail } = useEntity('costos');
    const { data: entityData } = useDetail(id, { enabled: isEdit });

    const [medioPagoIncluye, setMedioPagoIncluye] = React.useState(false);
    const [cantidad, setCantidad] = React.useState(navState?.cantidad_cuotas ?? 1);
    const [cuotas, setCuotas] = React.useState([]);

    React.useEffect(() => {
        if (!isEdit || !entityData) return;
        const existing = entityData.cuotas || [];
        if (existing.length > 0) {
            setCuotas(existing.map(c => ({
                id: c.id,
                numero_cuota: c.numero_cuota,
                fecha_vencimiento: c.fecha_vencimiento,
                importe: c.importe,
                pagada: c.pagada,
            })));
            setCantidad(existing.length);
            setMedioPagoIncluye(true);
        } else {
            setMedioPagoIncluye(Boolean(entityData.medio_pago_incluye_cuotas));
        }
    }, [isEdit, entityData]);

    const overrideInitialValues = React.useMemo(() => {
        if (isEdit) return {};
        const base = { fecha: today };
        if (!navState) return base;
        const { costo_recurrente, categoria_costo, importe, medio_pago, proveedor, descripcion } = navState;
        return {
            ...base,
            ...(costo_recurrente != null && { costo_recurrente }),
            ...(categoria_costo != null && { categoria_costo }),
            ...(importe != null && { importe }),
            ...(medio_pago != null && { medio_pago }),
            ...(proveedor != null && { proveedor }),
            ...(descripcion != null && { descripcion }),
        };
    }, [isEdit, navState]);

    const prepareDataForSubmit = React.useCallback((values) => ({
        ...values,
        cantidad_cuotas: medioPagoIncluye ? cuotas.length : null,
        cuotas: medioPagoIncluye && cuotas.length > 0 ? cuotas : [],
    }), [medioPagoIncluye, cuotas]);

    return (
        <BaseCrudPageContainer
            endpoint="costos"
            modelName="costo"
            overrideInitialValues={overrideInitialValues}
            prepareDataForSubmit={prepareDataForSubmit}
        >
            {({ values, onChange, isEdit: _isEdit, isSubmitting, fieldProps }) => {
                if (!fieldProps || !fieldProps.fecha) {
                    return <Box sx={{ p: 3, textAlign: 'center' }}>Cargando configuración del formulario...</Box>;
                }

                const handleCostoRecurrenteChange = (option) => {
                    if (!option || !option.extra) return;
                    const [catId, importe, medioPagoId, proveedorId, descripcion] = option.extra;
                    if (catId != null) onChange('categoria_costo', catId);
                    if (importe != null) onChange('importe', importe);
                    if (medioPagoId != null) onChange('medio_pago', medioPagoId);
                    if (proveedorId != null) onChange('proveedor', proveedorId);
                    if (descripcion != null) onChange('descripcion', descripcion);
                };

                const handleMedioPagoSelection = (option) => {
                    const incluye = Boolean(option?.extra?.[0]);
                    setMedioPagoIncluye(incluye);
                    if (incluye) {
                        setCuotas(buildCuotas(values.fecha, values.importe, cantidad));
                    } else {
                        setCuotas([]);
                    }
                };

                const handleFechaChange = (value) => {
                    onChange('fecha', value);
                    if (medioPagoIncluye && cuotas.length > 0) {
                        setCuotas(recalcFechas(cuotas, value));
                    }
                };

                const handleImporteChange = (value) => {
                    onChange('importe', value);
                    if (medioPagoIncluye && cuotas.length > 0) {
                        setCuotas(recalcImportes(cuotas, value));
                    }
                };

                const handleCantidadChange = (n) => {
                    const newN = Math.max(1, parseInt(n) || 1);
                    setCantidad(newN);
                    setCuotas(buildCuotas(values.fecha, values.importe, newN, cuotas));
                };

                const handleCuotaImporteChange = (index, value) => {
                    setCuotas(prev => prev.map((c, i) => i === index ? { ...c, importe: value } : c));
                };

                const handleCuotaPagadaChange = (index, checked) => {
                    setCuotas(prev => prev.map((c, i) => i === index ? { ...c, pagada: checked } : c));
                };

                return (
                    <>
                        <BaseInput
                            field={fieldProps.fecha}
                            value={values.fecha || ''}
                            onChange={handleFechaChange}
                            disabled={isSubmitting}
                        />

                        <BaseAutocomplete
                            field={fieldProps.costo_recurrente}
                            value={values.costo_recurrente}
                            onChange={(value) => onChange('costo_recurrente', value)}
                            onSelectionChange={handleCostoRecurrenteChange}
                            filterParams={{ activo: true }}
                            disabled={_isEdit || isSubmitting}
                        />

                        <BaseAutocomplete
                            field={fieldProps.categoria_costo}
                            value={values.categoria_costo}
                            onChange={(value) => onChange('categoria_costo', value)}
                            filterParams={{ activo: true }}
                            disabled={isSubmitting}
                        />

                        <BaseInput
                            field={{ ...fieldProps.descripcion, multiline: true, rows: 3 }}
                            value={values.descripcion || ''}
                            onChange={(value) => onChange('descripcion', value)}
                            disabled={isSubmitting}
                        />

                        <BaseInput
                            field={fieldProps.importe}
                            value={values.importe ?? ''}
                            onChange={handleImporteChange}
                            disabled={isSubmitting}
                        />

                        <BaseAutocomplete
                            field={fieldProps.medio_pago}
                            value={values.medio_pago}
                            onChange={(value) => onChange('medio_pago', value)}
                            onSelectionChange={handleMedioPagoSelection}
                            filterParams={{ disponible_pago: true, extra_fields: ['incluye_cuotas_label'] }}
                            disabled={isSubmitting}
                        />

                        {medioPagoIncluye && (
                            <Box
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    p: 2,
                                }}
                            >
                                <TextField
                                    label="Cuotas"
                                    type="number"
                                    value={cantidad}
                                    onChange={(e) => handleCantidadChange(e.target.value)}
                                    disabled={isSubmitting}
                                    size="small"
                                    slotProps={{ htmlInput: { min: 1 } }}
                                    sx={{ width: '100px' }}
                                />
                                <Stack spacing={1.5} sx={{ mt: 2 }}>
                                    {cuotas.map((cuota, i) => (
                                        <Stack key={i} direction="row" spacing={2} alignItems="center">
                                            <Typography variant="body2" sx={{ minWidth: '160px' }}>
                                                {`Cuota ${i + 1} — ${dayjs(cuota.fecha_vencimiento).format('DD/MM/YYYY')}`}
                                            </Typography>
                                            <TextField
                                                label=""
                                                type="number"
                                                value={cuota.importe}
                                                onChange={(e) => handleCuotaImporteChange(i, e.target.value)}
                                                disabled={isSubmitting}
                                                size="small"
                                                sx={{ maxWidth: '150px' }}
                                            />
                                            <FormControlLabel
                                                label="Pagada"
                                                control={
                                                    <Checkbox
                                                        checked={Boolean(cuota.pagada)}
                                                        onChange={(e) => handleCuotaPagadaChange(i, e.target.checked)}
                                                        disabled={isSubmitting}
                                                        size="small"
                                                    />
                                                }
                                            />
                                        </Stack>
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        <BaseAutocomplete
                            field={fieldProps.proveedor}
                            value={values.proveedor}
                            onChange={(value) => onChange('proveedor', value)}
                            filterParams={{ activo: true }}
                            disabled={isSubmitting}
                        />

                        <BaseAutocomplete
                            field={fieldProps.evento}
                            value={values.evento}
                            onChange={(value) => onChange('evento', value)}
                            filterParams={{ estado: 'C' }}
                            disabled={isSubmitting}
                        />
                    </>
                );
            }}
        </BaseCrudPageContainer>
    );
}
