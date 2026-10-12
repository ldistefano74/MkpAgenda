import * as React from 'react';
import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseSectionDivider from './BaseComponents/BaseSectionDivider';
import BaseCheckbox from './BaseComponents/BaseCheckbox';

export default function ServicioForm() {
    const prepareDataForSubmit = (data) => {
        const prepared = { ...data };
        if (prepared.precios) {
            prepared.precios = prepared.precios.map(p => ({
                id: p.id,
                tipo_evento: p.tipo_evento,
                precio: p.precio === '' ? '0.00' : p.precio,
            }));
        }
        return prepared;
    };

    return (
        <BaseCrudPageContainer
            endpoint="servicios"
            modelName="ServicioDetailSerializer"
            prepareDataForSubmit={prepareDataForSubmit}
        >
            {({ values, onChange, isSubmitting, fieldProps }) => {
                if (!fieldProps || !fieldProps.nombre) {
                    return null;
                }

                const preciosField = fieldProps.precios;
                const modalFields = preciosField?.fields?.reduce((acc, field) => {
                    acc[field.name] = field;
                    return acc;
                }, {}) || {};

                return (
                    <>
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

                        <BaseInput
                            field={fieldProps.precio_referencia}
                            value={values.precio_referencia || ''}
                            onChange={(value) => onChange('precio_referencia', value)}
                        />

                        <BaseSectionDivider label="Precios por tipo de evento" />

                        <BaseEditGrid
                            maxWidth={500}
                            rows={values.precios || []}
                            columns={[
                                { field: 'tipo_evento_nombre', headerName: 'Tipo de evento', flex: 1 },
                                {
                                    field: 'precio',
                                    headerName: 'Precio',
                                    width: 130,
                                    valueFormatter: (value) => value != null ? `$${value}` : '-',
                                },
                            ]}
                            getRowId={(row) => row.id ?? row.tipo_evento}
                            onRowsChange={(newRows) => onChange('precios', newRows)}
                            modalTitle="Precio por tipo de evento"
                            getEmptyItem={() => ({
                                tipo_evento: null,
                                tipo_evento_nombre: '',
                                precio: '0.00',
                            })}
                            isItemValid={(item) => !!item.tipo_evento}
                            onBeforeAccept={(item, isEditing, editingIndex) => {
                                const precios = values.precios || [];
                                const existe = precios.some((p, index) => {
                                    if (isEditing && index === editingIndex) return false;
                                    return p.tipo_evento === item.tipo_evento;
                                });
                                if (existe) return 'Ya existe un precio para este tipo de evento';
                                return true;
                            }}
                        >
                            {({ currentItem, setCurrentItem }) => (
                                <>
                                    <BaseAutocomplete
                                        field={modalFields.tipo_evento}
                                        value={currentItem.tipo_evento}
                                        onChange={(value) => setCurrentItem(prev => ({ ...prev, tipo_evento: value }))}
                                        onSelectionChange={(option) => {
                                            if (option) {
                                                setCurrentItem(prev => ({ ...prev, tipo_evento_nombre: option.label }));
                                            }
                                        }}
                                        filterParams={{ activo: true }}
                                    />
                                    <BaseInput
                                        field={modalFields.precio}
                                        value={currentItem.precio}
                                        onChange={(value) => setCurrentItem(prev => ({ ...prev, precio: value }))}
                                    />
                                </>
                            )}
                        </BaseEditGrid>
                        
                        <BaseInput
                            field={fieldProps.duracion_estimada}
                            value={values.duracion_estimada || ''}
                            onChange={(value) => onChange('duracion_estimada', value)}
                        />

                        <BaseInput
                            field={fieldProps.descripcion}
                            value={values.descripcion || ''}
                            onChange={(value) => onChange('descripcion', value)}
                            multiline
                            rows={3}
                        />
                    </>
                );
            }}
        </BaseCrudPageContainer>
    );
}
