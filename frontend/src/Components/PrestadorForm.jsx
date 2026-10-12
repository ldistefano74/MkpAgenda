import * as React from 'react';
import { useParams } from 'react-router';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseSelect from './BaseComponents/BaseSelect';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseSectionDivider from './BaseComponents/BaseSectionDivider';
import BaseFlexBox from './BaseComponents/BaseFlexBox';
import BaseCheckbox from './BaseComponents/BaseCheckbox';
import CuentaCorrienteTab from './CuentaCorrienteTab';

/**
 * PrestadorForm - Formulario específico para crear/editar Prestadores.
 *
 * Implementa una lógica personalizada para:
 * - Gestionar la relación Muchos a Muchos con Servicios mediante una grilla y modal.
 * - Sanitizar los datos de servicios antes de enviarlos (evitando objetos circulares).
 * - Mostrar etiquetas de error personalizadas para campos anidados.
 * - Aplicar validaciones condicionales (ej: CUIT/CUIL obligatorio según condición fiscal).
 * - Pestañas: Datos Generales y Cuenta Corriente (solo en edición).
 *
 * Los valores iniciales se obtienen automáticamente del backend via backendInitialValues.
 */
export default function PrestadorForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [tabIndex, setTabIndex] = React.useState(0);

    // Resetear a tab 0 si se navega de edición a creación
    React.useEffect(() => {
        if (!isEdit) setTabIndex(0);
    }, [isEdit]);

    /**
     * Prepara los datos antes de enviar al backend.
     *
     * Realiza una limpieza de la lista de servicios para enviar únicamente los campos
     * que el backend espera (id, servicio, precio_referencia), evitando el envío de
     * metadatos de la UI o referencias circulares que romperían el JSON.stringify.
     */
    const prepareDataForSubmit = (data) => {
        const prepared = { ...data };

        // Sanitizar servicios para enviar solo lo que el backend necesita y evitar objetos circulares
        if (prepared.servicios_prestador) {
            prepared.servicios_prestador = prepared.servicios_prestador.map(s => ({
                id: s.id,
                servicio: s.servicio,
                tipo_evento: s.tipo_evento || null,
                precio_referencia: s.precio_referencia === '' ? null : s.precio_referencia
            }));
        }

        return prepared;
    };


    return (
        <BaseCrudPageContainer
            endpoint="prestadores"
            modelName="PrestadorDetailSerializer"
            prepareDataForSubmit={prepareDataForSubmit}
        >
            {({ values, onChange, isEdit: _isEdit, isSubmitting, fieldProps }) => {
                // Si no hay metadatos aún, mostramos un spinner o null (BaseCrudPageContainer maneja entity loading, pero no metadata loading explícito en UI layout)
                // Para ser seguros, chequeamos si existe un campo clave
                if (!fieldProps || !fieldProps.nombre) {
                    return <Box sx={{ p: 3, textAlign: 'center' }}>Cargando configuración del formulario...</Box>;
                }

                // Extraer campos anidados de servicios_prestador para el modal
                const serviciosPrestadorField = fieldProps.servicios_prestador;
                const modalFields = serviciosPrestadorField?.fields?.reduce((acc, field) => {
                    acc[field.name] = field;
                    return acc;
                }, {}) || {};

                return (
                    <>
                        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 1 }}>
                            <Tab label="Datos Generales" />
                            <Tab label="Cuenta Corriente" disabled={!isEdit} />
                        </Tabs>

                        {tabIndex === 0 && (
                            <>
                                {/* Sección: Datos Básicos */}
                                {/* <BaseSectionDivider label="Datos Básicos" mt={0} /> */}

                                <BaseInput
                                    field={fieldProps.nombre}
                                    value={values.nombre || ''}
                                    onChange={(value) => onChange('nombre', value)}
                                />

                                <BaseCheckbox
                                    field={fieldProps.activo}
                                    value={values.activo}
                                    onChange={(value) => onChange('activo', value)}
                                    disabled={isSubmitting}
                                />

                                {/* Sección: Datos de Contacto */}
                                <BaseSectionDivider label="Datos de Contacto" />

                                <BaseInput
                                    field={fieldProps.direccion}
                                    value={values.direccion || ''}
                                    onChange={(value) => onChange('direccion', value)}
                                />

                                <BaseInput
                                    field={fieldProps.telefono}
                                    value={values.telefono || ''}
                                    onChange={(value) => onChange('telefono', value)}
                                />

                                <BaseInput
                                    field={fieldProps.email}
                                    value={values.email || ''}
                                    onChange={(value) => onChange('email', value)}
                                />

                                {/* <BaseAutocomplete
                                    field={fieldProps.red_social}
                                    value={values.red_social}
                                    onChange={(value) => onChange('red_social', value)}
                                /> */}

                                {/* Sección: Servicios */}
                                <BaseSectionDivider label="Servicios" />

                                <BaseEditGrid
                                    maxWidth={650}
                                    rows={values.servicios_prestador || []}
                                    columns={[
                                        { field: 'servicio_nombre', headerName: 'Servicio', flex: 1 },
                                        { field: 'tipo_evento_nombre', headerName: 'Tipo de evento', flex: 1, valueFormatter: (value) => value || '-' },
                                        {
                                            field: 'precio_referencia',
                                            headerName: 'Precio',
                                            width: 120,
                                            valueFormatter: (value) => value ? `$${value}` : '-',
                                        },
                                    ]}
                                    getRowId={(row) => row.id ?? row.tempId}
                                    onRowsChange={(newRows) => onChange('servicios_prestador', newRows)}
                                    modalTitle="Servicio"
                                    getEmptyItem={() => ({
                                        servicio: null,
                                        servicio_nombre: '',
                                        tipo_evento: null,
                                        tipo_evento_nombre: '',
                                        precio_referencia: '',
                                    })}
                                    isItemValid={(item) => !!item.servicio}
                                    onBeforeAccept={(item, isEditing, editingIndex) => {
                                        const mismoTipoEvento = (a, b) => {
                                            const nullA = a == null;
                                            const nullB = b == null;
                                            if (nullA && nullB) return true;
                                            if (nullA !== nullB) return false;
                                            return String(a) === String(b);
                                        };
                                        const servicios = values.servicios_prestador || [];
                                        const existe = servicios.some((s, index) => {
                                            if (isEditing && index === editingIndex) return false;
                                            return s.servicio === item.servicio && mismoTipoEvento(s.tipo_evento, item.tipo_evento);
                                        });
                                        if (existe) {
                                            return 'Ya existe este servicio con el mismo tipo de evento';
                                        }
                                        return true;
                                    }}
                                >
                                    {({ currentItem, setCurrentItem }) => (
                                        <>
                                            <BaseAutocomplete
                                                field={modalFields.servicio}
                                                value={currentItem.servicio}
                                                onChange={(value) => setCurrentItem(prev => ({ ...prev, servicio: value }))}
                                                onSelectionChange={(option) => {
                                                    if (option) {
                                                        setCurrentItem(prev => ({ ...prev, servicio_nombre: option.label }));
                                                    }
                                                }}
                                                filterParams={{ activo: true }}
                                            />
                                            <BaseAutocomplete
                                                field={modalFields.tipo_evento}
                                                value={currentItem.tipo_evento}
                                                onChange={(value) => setCurrentItem(prev => ({ ...prev, tipo_evento: value }))}
                                                onSelectionChange={(option) => {
                                                    setCurrentItem(prev => ({ ...prev, tipo_evento_nombre: option?.label || '' }));
                                                }}
                                                filterParams={{ activo: true }}
                                            />
                                            <BaseInput
                                                field={modalFields.precio_referencia}
                                                value={currentItem.precio_referencia}
                                                onChange={(value) => setCurrentItem(prev => ({ ...prev, precio_referencia: value }))}
                                            />
                                        </>
                                    )}
                                </BaseEditGrid>

                                {/* Sección: Datos Fiscales */}
                                <BaseSectionDivider label="Datos Fiscales" />

                                <BaseFlexBox>
                                    <BaseInput
                                        field={fieldProps.dni}
                                        value={values.dni || ''}
                                        onChange={(value) => onChange('dni', value)}
                                    />

                                    <BaseSelect
                                        field={fieldProps.condicion_fiscal}
                                        value={values.condicion_fiscal}
                                        onChange={(value) => onChange('condicion_fiscal', value)}
                                    />

                                    <BaseInput
                                        field={{
                                            ...fieldProps.cuit_cuil,
                                            required: values.condicion_fiscal !== 'CF', // Override condicional
                                        }}
                                        value={values.cuit_cuil || ''}
                                        onChange={(value) => onChange('cuit_cuil', value)}
                                    />
                                </BaseFlexBox>
                            </>
                        )}

                        {tabIndex === 1 && isEdit && (
                            <CuentaCorrienteTab prestadorId={id} />
                        )}
                    </>
                )
            }}
        </BaseCrudPageContainer>

    );
}
