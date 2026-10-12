import * as React from 'react';
import { useParams } from 'react-router';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';
import BaseInput from './BaseComponents/BaseInput';
import BaseSelect from './BaseComponents/BaseSelect';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseSectionDivider from './BaseComponents/BaseSectionDivider';
import BaseFlexBox from './BaseComponents/BaseFlexBox';
import CuentaCorrienteTab from './CuentaCorrienteTab';
import WhatsAppButton from './WhatsAppButton';

/**
 * ClienteForm - Formulario específico para crear/editar Clientes.
 *
 * Implementa una lógica personalizada para:
 * - Aplicar validaciones condicionales (ej: CUIT/CUIL obligatorio según condición fiscal).
 * - Pestañas: Datos Generales y Cuenta Corriente (solo en edición).
 *
 * Los valores iniciales se obtienen automáticamente del backend via backendInitialValues.
 */

export default function ClienteForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [tabIndex, setTabIndex] = React.useState(0);

    // Resetear a tab 0 si se navega de edición a creación
    React.useEffect(() => {
        if (!isEdit) setTabIndex(0);
    }, [isEdit]);

    return (
        <BaseCrudPageContainer
            endpoint="clientes"
            modelName="cliente"
            titleSuffix={({ values, onChange }) => (
                <Tooltip title={values.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}>
                    <IconButton onClick={() => onChange('favorito', !values.favorito)} size="large">
                        {values.favorito
                            ? <StarIcon sx={{ color: 'warning.main', fontSize: 32 }} />
                            : <StarBorderIcon sx={{ fontSize: 32 }} />}
                    </IconButton>
                </Tooltip>
            )}
        >
            {({ values, onChange, isEdit: _isEdit, fieldProps }) => {
                // Si no hay metadatos aún, mostramos un mensaje de carga
                if (!fieldProps || !fieldProps.nombre) {
                    return <Box sx={{ p: 3, textAlign: 'center' }}>Cargando configuración del formulario...</Box>;
                }

                return (
                    <>
                        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 1 }}>
                            <Tab label="Datos Generales" />
                            <Tab label="Cuenta Corriente" disabled={!isEdit} />
                        </Tabs>

                        {tabIndex === 0 && (
                            <>
                                {/* Sección: Datos Básicos */}
                                <BaseInput
                                    field={fieldProps.nombre}
                                    value={values.nombre || ''}
                                    onChange={(value) => onChange('nombre', value)}
                                />

                                <BaseInput
                                    field={fieldProps.fecha_nacimiento}
                                    value={values.fecha_nacimiento || ''}
                                    onChange={(value) => onChange('fecha_nacimiento', value)}
                                />

                                {/* Sección: Datos de Contacto */}
                                <BaseSectionDivider label="Datos de Contacto" />

                                <BaseInput
                                    field={fieldProps.telefono}
                                    value={values.telefono || ''}
                                    onChange={(value) => onChange('telefono', value)}
                                    endAdornment={values.telefono ? <WhatsAppButton phone={values.telefono} /> : null}
                                />

                                <BaseInput
                                    field={fieldProps.email}
                                    value={values.email || ''}
                                    onChange={(value) => onChange('email', value)}
                                />

                                <BaseInput
                                    field={fieldProps.direccion}
                                    value={values.direccion || ''}
                                    onChange={(value) => onChange('direccion', value)}
                                />

                                <BaseAutocomplete
                                    field={fieldProps.fuente_contacto}
                                    value={values.fuente_contacto}
                                    onChange={(value) => onChange('fuente_contacto', value)}
                                />

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
                            <CuentaCorrienteTab clienteId={id} />
                        )}
                    </>
                )
            }}
        </BaseCrudPageContainer>

    );
}
