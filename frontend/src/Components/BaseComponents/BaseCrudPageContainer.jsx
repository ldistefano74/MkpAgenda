import * as React from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import PageContainer from '../Layout/PageContainer';
import { useEntity } from '../../hooks/api/useEntity';
import { useMetadata } from '../../hooks/api/useMetadata';
import { useNewInstance } from '../../hooks/api/useNewInstance';
import { generateFieldsList, parseErrorValue } from '../../lib/CRUDUtils';
import useNotifications from '../../hooks/useNotifications/useNotifications';

// Objetos vacíos estables para evitar re-renders infinitos
const INITIAL_VALUES = {};

/**
 * BaseCrudPageContainer - Componente base para páginas CRUD
 *
 * Este componente encapsula la lógica genérica de CRUD:
 * - Manejo de estado (crear vs editar)
 * - Carga de datos desde la API
 * - Operaciones create/update
 * - Navegación y notificaciones
 * - Botones de acción (Cancelar/Guardar)
 *
 * Los formularios específicos que usen este componente deben:
 * - Definir sus propios campos internamente
 * - Manejar la inicialización de valores
 * - Renderizar sus campos específicos
 * - Opcionalmente, customizar la preparación de datos y formateo de errores
 *
 * @param {Object} props
 * @param {string} props.endpoint - Endpoint de la API para este recurso
 * @param {string} [props.modelName] - Nombre del modelo para obtener metadata (opcional)
 * @param {string} props.title - Título del recurso (singular)
 * @param {Object} props.initialValues - Valores iniciales del formulario (para crear)
 * @param {boolean} [props.backendInitialValues=true] - Si true, obtiene valores iniciales del backend (requiere modelName)
 * @param {Object} [props.overrideInitialValues] - Valores para sobrescribir los que vienen del backend
 * @param {Function} props.children - Función render prop que recibe { values, onChange, isEdit, isSubmitting, entityData }
 * @param {string} [props.idParamName='id'] - Nombre del parámetro de ID en la URL
 * @param {Function} [props.prepareDataForSubmit] - Función opcional para preparar datos antes de enviar
 * @param {Function} [props.formatError] - Función opcional para formatear errores de validación
 * @param {string|number} [props.maxWidth=600] - Ancho máximo del formulario
 * @param {string} [props.successMessageCreate] - Mensaje personalizado al crear
 * @param {string} [props.successMessageUpdate] - Mensaje personalizado al actualizar
 */
export default function BaseCrudPageContainer({
    endpoint,
    modelName,
    title,
    initialValues = INITIAL_VALUES,
    backendInitialValues = true,
    overrideInitialValues = INITIAL_VALUES,
    children,
    idParamName = 'id',
    prepareDataForSubmit = null,
    validateBeforeSubmit = null,
    formatError = null,
    maxWidth = "100%",
    successMessageCreate = 'Registro creado correctamente',
    successMessageUpdate = 'Registro actualizado correctamente',
    additionalLabels = {},
    titleSuffix = null,
    extraActions = null,
    onAfterCreate = null,
    createExtraInvalidations = [],
}) {
    const params = useParams();
    const id = params[idParamName];
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const notifications = useNotifications();
    const queryClient = useQueryClient();

    // Entity hooks
    const { useDetail, useCreate, useUpdate } = useEntity(endpoint);
    const { data: entityData, isLoading: isLoadingData, error: loadError } = useDetail(id, { enabled: isEdit });
    const createMutation = useCreate();
    const updateMutation = useUpdate();

    // Metadata hook
    const { data: metadata, isLoading: isLoadingMetadata } = useMetadata(modelName, { enabled: Boolean(modelName) });

    // Hook para obtener valores iniciales del backend (solo en modo crear y si está habilitado)
    const shouldFetchNewInstance = backendInitialValues && Boolean(modelName) && !isEdit;
    const { data: backendDefaults, isLoading: isLoadingDefaults } = useNewInstance(modelName, {
        enabled: shouldFetchNewInstance,
    });

    // Referencia para trackear si ya se inicializaron los valores del backend
    const initializedFromBackend = React.useRef(false);

    // Generar props de campos usando la utilidad compartida y transformando a objeto
    const fieldProps = React.useMemo(() => {
        const fieldsArray = generateFieldsList(metadata);
        // Transformar array [ {name: 'foo', ...} ] a objeto { foo: {name: 'foo', ...} }
        return fieldsArray.reduce((acc, field) => {
            acc[field.name] = field;
            return acc;
        }, {});
    }, [metadata]);

    const effectiveTitle = title || metadata?.verbose_name || '';

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const [values, setValues] = React.useState(() => ({ ...initialValues, ...overrideInitialValues }));

    /**
     * Inicializa los valores con backend defaults cuando llegan (solo una vez)
     */
    React.useEffect(() => {
        if (backendDefaults && !initializedFromBackend.current) {
            initializedFromBackend.current = true;
            setValues(prev => ({ ...backendDefaults, ...initialValues, ...overrideInitialValues, ...prev }));
        }
    }, [backendDefaults, initialValues, overrideInitialValues]);

    /**
     * Actualiza los valores cuando se cargan datos (modo edición)
     */
    React.useEffect(() => {
        if (entityData) {
            setValues(prev => ({ ...prev, ...entityData }));
        }
    }, [entityData]);

    /**
     * Maneja errores de carga
     */
    React.useEffect(() => {
        if (loadError) {
            notifications.show(`Error al cargar datos: ${loadError.message}`, { severity: 'error' });
        }
    }, [loadError, notifications]);

    /**
     * Maneja cambios en los campos del formulario
     */
    const handleChange = React.useCallback((name, value) => {
        setValues(prev => ({ ...prev, [name]: value }));
    }, []);

    /**
     * Formatea errores de validación del backend
     * Usa la función custom si se proporciona, sino usa formato simple
     */
    const defaultFormatError = React.useCallback((err) => {
        let message = `Error al guardar: ${err.message}`;
        if (err.body && typeof err.body === 'object' && !Array.isArray(err.body)) {
            const details = [];

            // Helper para buscar labels en additionalLabels o fieldProps
            const getLabel = (key) => additionalLabels[key] || fieldProps[key]?.label || key;

            Object.entries(err.body).forEach(([key, value]) => {
                if (key === 'detail' || key === 'message') return;

                const msgText = parseErrorValue(value, getLabel);

                if (key === '__all__') {
                    details.push(msgText);
                } else {
                    const fieldDisplay = getLabel(key);
                    details.push(`${fieldDisplay}: ${msgText}`);
                }
            });

            if (details.length > 0) {
                message = `Error al guardar:\n${details.join('\n')}`;
            }
        }
        return message;
    }, [fieldProps, additionalLabels]);

    /**
     * Maneja el envío del formulario
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación opcional antes de enviar (soporta async)
        if (validateBeforeSubmit) {
            const validationError = await validateBeforeSubmit(values, isEdit);
            if (validationError === false) return; // cancelado sin mensaje
            if (validationError) {
                notifications.show(validationError, { severity: 'error' });
                return;
            }
        }

        // Preparar datos usando función custom o los valores tal cual
        const dataToSubmit = prepareDataForSubmit ? prepareDataForSubmit(values) : values;

        try {
            if (isEdit) {
                await updateMutation.mutateAsync({ id, data: dataToSubmit });
                notifications.show(successMessageUpdate, {
                    severity: 'success',
                    autoHideDuration: 3000
                });
            } else {
                const newRecord = await createMutation.mutateAsync(dataToSubmit);
                for (const queryKey of createExtraInvalidations) {
                    queryClient.invalidateQueries({ queryKey });
                }
                notifications.show(successMessageCreate, {
                    severity: 'success',
                    autoHideDuration: 3000
                });
                if (onAfterCreate) {
                    onAfterCreate(newRecord);
                    return;
                }
            }
            navigate(`/${endpoint}`);
        } catch (err) {
            const errorFormatter = formatError || defaultFormatError;
            const formattedMsg = errorFormatter(err);
            notifications.show(
                <div style={{ whiteSpace: 'pre-line' }}>{formattedMsg}</div>,
                { severity: 'error' }
            );
        }
    };

    /**
     * Maneja la cancelación del formulario
     */
    const handleCancel = React.useCallback(() => {
        navigate(`/${endpoint}`);
    }, [navigate, endpoint]);

    /**
     * Captura la tecla Escape para cancelar el formulario
     */
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isSubmitting) {
                e.preventDefault();
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleCancel, isSubmitting]);

    // Mostrar loading mientras se cargan datos, metadata o defaults del backend
    const isWaitingForMetadata = Boolean(modelName) && !metadata && !title;
    const isWaitingForDefaults = shouldFetchNewInstance && isLoadingDefaults;
    if (isLoadingData || isWaitingForMetadata || isWaitingForDefaults || (Boolean(modelName) && isLoadingMetadata && !metadata)) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    }

    const resolvedTitleSuffix = typeof titleSuffix === 'function'
        ? titleSuffix({ values, onChange: handleChange })
        : titleSuffix;

    return (
        <PageContainer
            title={`${isEdit ? 'Editar' : 'Crear'} ${effectiveTitle}`}
            titleSuffix={resolvedTitleSuffix}
            // breadcrumbs={[
            //     { title: effectiveTitle, path: `/${endpoint}` },
            //     { title: isEdit ? 'Editar' : 'Crear' }
            // ]}
        >
            <Box component="form" id="crud-form" onSubmit={handleSubmit} sx={{ maxWidth, width: '100%', pb: 10, flex: 1 }}>
                {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError.message}</Alert>}

                <Stack spacing={3}>
                    {/* Renderizar el formulario usando children como render prop */}
                    {children({
                        values,
                        onChange: handleChange,
                        isEdit,
                        isSubmitting,
                        entityData,
                        fieldProps,
                    })}
                </Stack>
            </Box>

            {/* Footer flotante con botones de acción */}
            <Paper
                elevation={3}
                sx={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    py: 2,
                    px: 3,
                    mt: 2,
                    mx: -3,
                    mb: -3,
                    borderRadius: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1100,
                }}
            >
                <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center" sx={{ maxWidth, width: '100%' }}>
                    {extraActions && (
                        <Stack direction="row" spacing={1} sx={{ mr: 'auto' }}>
                            {typeof extraActions === 'function'
                                ? extraActions({ values, isEdit })
                                : extraActions}
                        </Stack>
                    )}
                    <Button variant="outlined" onClick={handleCancel} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSubmitting} form="crud-form">
                        Guardar
                    </Button>
                </Stack>
            </Paper>
        </PageContainer>
    );
}

BaseCrudPageContainer.propTypes = {
    endpoint: PropTypes.string.isRequired,
    modelName: PropTypes.string,
    title: PropTypes.string,
    initialValues: PropTypes.object,
    backendInitialValues: PropTypes.bool,
    overrideInitialValues: PropTypes.object,
    children: PropTypes.func.isRequired,
    idParamName: PropTypes.string,
    prepareDataForSubmit: PropTypes.func,
    validateBeforeSubmit: PropTypes.func,
    formatError: PropTypes.func,
    maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    successMessageCreate: PropTypes.string,
    successMessageUpdate: PropTypes.string,
    additionalLabels: PropTypes.object,
    titleSuffix: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    extraActions: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    onAfterCreate: PropTypes.func,
    createExtraInvalidations: PropTypes.arrayOf(PropTypes.array),
};
