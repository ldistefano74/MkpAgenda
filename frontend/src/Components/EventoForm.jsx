import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';

import apiClient from '../lib/apiClient';
import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseSectionDivider from './BaseComponents/BaseSectionDivider';
import BaseSelect from './BaseComponents/BaseSelect';
import BaseFlexBox from './BaseComponents/BaseFlexBox';
import CobrosTab from './CobrosTab';
import PagosTab from './PagosTab';
import CostosTab from './CostosTab';
import { useMetadata } from '../hooks/api/useMetadata';
import { generateFieldsList } from '../lib/CRUDUtils';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { openPresupuestoPdf } from '../lib/presupuesto';
import { formatRecordatorioEnviado } from '../lib/recordatorio';
import RecordatorioButton from './RecordatorioButton';

/**
 * EventoForm - Formulario específico para crear/editar Eventos.
 *
 * Implementa:
 * - Gestión de la relación con ServicioEvento mediante grilla y modal.
 * - Sanitización de datos antes de enviar al backend.
 * - Creación de nuevo cliente inline durante la creación del evento.
 * - Solapas: Datos del Evento, Cobros (solo edición), Pagos (solo edición).
 * - Chequeo de conflictos de horario al grabar, con dialog de confirmación.
 */
export default function EventoForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const notifications = useNotifications();
    const [tabIndex, setTabIndex] = useState(0);

    const [newEventoId, setNewEventoId] = useState(null);
    const [showPresupuestoDialog, setShowPresupuestoDialog] = useState(false);

    const handleAfterCreate = useCallback((newRecord) => {
        setNewEventoId(newRecord.id);
        setShowPresupuestoDialog(true);
    }, []);

    const handlePresupuestoDialogClose = useCallback(async (generar) => {
        setShowPresupuestoDialog(false);
        if (generar) {
            try {
                await openPresupuestoPdf(newEventoId);
            } catch (err) {
                notifications.show(err.message, { severity: 'error' });
            }
        }
        navigate('/eventos');
    }, [newEventoId, navigate, notifications]);

    // Estado para controlar la creación de nuevo cliente
    const [creatingNewClient, setCreatingNewClient] = useState(false);
    const [newClientData, setNewClientData] = useState({
        nombre: '',
        telefono: '',
        email: '',
        fuente_contacto: null,
    });

    // Estado de conflictos de horario
    const [conflicts, setConflicts] = useState([]);
    const [conflictError, setConflictError] = useState(false);
    const [showConflictDialog, setShowConflictDialog] = useState(false);
    const conflictResolveRef = useRef(null); // resuelve la promesa del dialog

    // Labels locales para construir el concepto (se actualizan al seleccionar)
    const localLabelsRef = useRef({ cliente: '', tipoEvento: '' });

    // Resetear a tab 0 si se navega a creación
    useEffect(() => {
        if (!isEdit) setTabIndex(0);
    }, [isEdit]);

    // Obtener metadata de cliente para los campos del formulario inline
    const { data: clienteMetadata } = useMetadata('cliente');

    // Procesar campos de cliente para obtener fieldProps
    const clienteFieldProps = useMemo(() => {
        if (!clienteMetadata) return {};
        const processed = generateFieldsList(clienteMetadata);
        return processed.reduce((acc, field) => {
            acc[field.name] = field;
            return acc;
        }, {});
    }, [clienteMetadata]);

    /**
     * Prepara los datos antes de enviar al backend.
     */
    const prepareDataForSubmit = (data) => {
        const prepared = { ...data };

        // Si se está creando un nuevo cliente, agregarlo a los datos
        if (creatingNewClient) {
            prepared.nuevo_cliente = {
                nombre: newClientData.nombre,
                telefono: newClientData.telefono,
                email: newClientData.email || null,
                fuente_contacto: newClientData.fuente_contacto || null,
            };
            // Remover el cliente seleccionado ya que se creará uno nuevo
            delete prepared.cliente;
        }

        // Sanitizar servicios_evento para enviar solo lo que el backend necesita
        if (prepared.servicios_evento) {
            prepared.servicios_evento = prepared.servicios_evento.map(s => ({
                id: s.id,
                servicio: s.servicio,
                descripcion: s.descripcion || null,
                prestador: s.prestador || null,
                // Normalizar a null cuando coincide con el cliente del evento (redundante)
                cliente_cuenta: (s.cliente_cuenta && s.cliente_cuenta !== data.cliente) ? s.cliente_cuenta : null,
                lugar: s.lugar || null,
                duracion: s.duracion || null,
                importe: s.importe === '' ? 0 : s.importe,
                importe_prestador: s.importe_prestador === '' ? null : s.importe_prestador,
                activo: s.activo ?? true,
                presupuesto: s.presupuesto || null,
                observaciones: s.observaciones || null,
            }));
        }

        return prepared;
    };

    /**
     * Valida conflictos de horario antes de grabar.
     * Si hay conflictos, muestra un dialog de confirmación.
     * Retorna null para continuar, false para cancelar (sin mensaje de error).
     */
    const validateBeforeSubmit = async (values) => {
        if (!values.fecha) return null;
        if (values.estado === 'X') return null;
        try {
            const params = new URLSearchParams({ fecha: values.fecha });
            if (values.duracion) params.append('duracion', values.duracion);
            if (id) params.append('exclude_id', id);
            const data = await apiClient.get(`/eventos/check_conflicts/?${params.toString()}`);
            const found = data?.conflicts || [];
            if (found.length === 0) return null;

            setConflicts(found);
            setConflictError(true);
            setShowConflictDialog(true);

            const shouldContinue = await new Promise(resolve => {
                conflictResolveRef.current = resolve;
            });

            setShowConflictDialog(false);
            return shouldContinue ? null : false;
        } catch (e) {
            console.error('Error chequeando conflictos de evento', e);
            return null;
        }
    };

    /**
     * Toggle entre crear nuevo cliente o seleccionar existente
     */
    const handleToggleNewClient = () => {
        setCreatingNewClient(prev => !prev);
        if (creatingNewClient) {
            // Limpiar datos del nuevo cliente al cancelar
            setNewClientData({ nombre: '', telefono: '', email: '', fuente_contacto: null });
        }
    };

    /**
     * Formatea una fecha YYYY-MM-DD como "DD/MM/YYYY"
     */
    const formatFecha = (fecha) => {
        if (!fecha) return '';
        const [y, m, d] = fecha.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    };

    /**
     * Construye el concepto para cobros usando los labels actuales del evento
     */
    const buildConceptoCobro = (values) => {
        const cliente = localLabelsRef.current.cliente || values.cliente_nombre || '';
        const tipoEvento = localLabelsRef.current.tipoEvento || values.tipo_evento_nombre || '';
        const fecha = formatFecha(values.fecha);
        return ['Cobro', tipoEvento, fecha ? `el ${fecha}` : '', cliente ? `para ${cliente}` : '']
            .filter(Boolean).join(' ');
    };

    /**
     * Construye el concepto para pagos
     */
    const buildConceptoPago = (values, servicioNombre) => {
        const cliente = localLabelsRef.current.cliente || values.cliente_nombre || '';
        const tipoEvento = localLabelsRef.current.tipoEvento || values.tipo_evento_nombre || '';
        const fecha = formatFecha(values.fecha);
        return ['Pago', servicioNombre, tipoEvento ? `en ${tipoEvento}` : '', cliente ? `para ${cliente}` : '', fecha ? `el ${fecha}` : '']
            .filter(Boolean).join(' ');
    };

    const conflictMessage = conflicts.length > 0
        ? `Conflicto con: ${conflicts.join(', ')}`
        : null;


    return (
        <>
            <BaseCrudPageContainer
                endpoint="eventos"
                modelName="EventoDetailSerializer"
                prepareDataForSubmit={prepareDataForSubmit}
                validateBeforeSubmit={validateBeforeSubmit}
                onAfterCreate={handleAfterCreate}
                createExtraInvalidations={[['lookup', 'cliente']]}
            >
                {({ values, onChange, isEdit: _isEdit, isSubmitting, fieldProps }) => {
                    if (!fieldProps || !fieldProps.cliente) {
                        return <Box sx={{ p: 3, textAlign: 'center' }}>Cargando configuración del formulario...</Box>;
                    }

                    const serviciosEventoField = fieldProps.servicios_evento;
                    const modalFields = serviciosEventoField?.fields?.reduce((acc, field) => {
                        acc[field.name] = field;
                        return acc;
                    }, {}) || {};

                    return (
                        <>
                            <Tabs
                                value={tabIndex}
                                onChange={(_, v) => setTabIndex(v)}
                                sx={{ mb: 1 }}
                            >
                                <Tab label="Datos del Evento" />
                                <Tab label="Cobros" disabled={!isEdit} />
                                <Tab label="Pagos" disabled={!isEdit} />
                                <Tab label="Costos" disabled={!isEdit} />
                            </Tabs>

                            {/* ── Tab 0: Datos del Evento ── */}
                            {tabIndex === 0 && (
                                <>
                                    {/* <BaseSectionDivider label="Datos del Evento" mt={0} /> */}

                                    <BaseFlexBox>
                                        <BaseInput
                                            field={fieldProps.fecha}
                                            value={values.fecha || ''}
                                            onChange={(value) => {
                                                onChange('fecha', value);
                                                if (conflictError) setConflictError(false);
                                            }}
                                            error={conflictError}
                                            errorMessage={conflictMessage}
                                        />

                                        <BaseFlexBox sx={{ gap: 0.5, flex: 1, flexWrap: 'nowrap'}}>
                                            <BaseAutocomplete
                                                field={{ ...fieldProps.cliente, required: !creatingNewClient }}
                                                value={values.cliente}
                                                onChange={(value) => onChange('cliente', value)}
                                                onSelectionChange={(opt) => {
                                                    localLabelsRef.current.cliente = opt?.label || '';
                                                }}
                                                disabled={creatingNewClient}
                                                filterParams={{ extra_fields: ['telefono'] }}
                                            />
                                            {/* Botón para crear nuevo cliente - solo visible en creación */}
                                            {!isEdit && (
                                                <Tooltip title={creatingNewClient ? "Seleccionar un cliente existente" : "Crear un nuevo cliente"}>
                                                    {/* span: el Tooltip necesita un hijo habilitado */}
                                                    <span>
                                                        <IconButton
                                                            onClick={handleToggleNewClient}
                                                            color={creatingNewClient ? "primary" : "default"}
                                                            disabled={!clienteMetadata}
                                                            sx={{ mt: 0.5 }}
                                                        >
                                                            {creatingNewClient ? <PersonIcon /> : <PersonAddIcon />}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </BaseFlexBox>
                                    </BaseFlexBox>

                                    {/* Formulario inline para nuevo cliente */}
                                    {!isEdit && creatingNewClient && (
                                        <Box
                                            sx={{
                                                border: 1,
                                                borderColor: 'primary.main',
                                                borderRadius: 1,
                                                p: 2,
                                                mb: 2,
                                                bgcolor: 'background.paper',
                                            }}
                                        >
                                            <BaseFlexBox>
                                                <BaseInput
                                                    field={clienteFieldProps.nombre}
                                                    value={newClientData.nombre}
                                                    onChange={(value) => setNewClientData(prev => ({ ...prev, nombre: value }))}
                                                />
                                                <BaseInput
                                                    field={clienteFieldProps.telefono}
                                                    value={newClientData.telefono}
                                                    onChange={(value) => setNewClientData(prev => ({ ...prev, telefono: value }))}
                                                />
                                                <BaseInput
                                                    field={clienteFieldProps.email}
                                                    value={newClientData.email}
                                                    onChange={(value) => setNewClientData(prev => ({ ...prev, email: value }))}
                                                />
                                                <BaseAutocomplete
                                                    field={clienteFieldProps.fuente_contacto}
                                                    value={newClientData.fuente_contacto}
                                                    onChange={(value) => setNewClientData(prev => ({ ...prev, fuente_contacto: value }))}
                                                />
                                            </BaseFlexBox>
                                        </Box>
                                    )}

                                    <BaseAutocomplete
                                        field={fieldProps.tipo_evento}
                                        value={values.tipo_evento}
                                        onChange={(value) => onChange('tipo_evento', value)}
                                        onSelectionChange={(opt) => {
                                            localLabelsRef.current.tipoEvento = opt?.label || '';
                                        }}
                                        filterParams={{ activo: true }}
                                    />

                                    <BaseAutocomplete
                                        field={fieldProps.direccion_servicios}
                                        value={values.direccion_servicios}
                                        onChange={(value) => onChange('direccion_servicios', value)}
                                        lookupName="direccionesfrecuentes"
                                        freeSolo
                                    />

                                    <BaseFlexBox sx={{ alignItems: 'center' }}>
                                        <BaseSelect
                                            field={fieldProps.estado}
                                            value={values.estado}
                                            onChange={(value) => onChange('estado', value)}
                                            disabled={isSubmitting}
                                        />

                                        {/* Recordatorio: solo para eventos confirmados ya guardados */}
                                        {isEdit && values.estado === 'C' && (
                                            <BaseFlexBox sx={{ gap: 1, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {values.recordatorio_enviado
                                                        ? `Recordatorio enviado ${formatRecordatorioEnviado(values.recordatorio_enviado)}`
                                                        : 'Recordatorio no enviado'}
                                                </Typography>
                                                <RecordatorioButton
                                                    eventoId={id}
                                                    enviado={values.recordatorio_enviado}
                                                    variant="button"
                                                    invalidate={false}
                                                    onEnviado={(timestamp) => onChange('recordatorio_enviado', timestamp)}
                                                />
                                            </BaseFlexBox>
                                        )}
                                    </BaseFlexBox>

                                    {/* Sección: Servicios del Evento */}
                                    <BaseSectionDivider label="Servicios del Evento" />

                                    <BaseEditGrid
                                        rows={values.servicios_evento || []}
                                        disabledAdd={!values.tipo_evento}
                                        disabledAddTooltip="Seleccioná el tipo de evento antes de agregar servicios"
                                        footerContent={
                                            <Typography variant="subtitle2" sx={{ textAlign: 'right' }}>
                                                Total: ${(values.servicios_evento || []).reduce((sum, s) => sum + (Number(s.importe) || 0), 0).toLocaleString('es-AR')}
                                            </Typography>
                                        }
                                        columns={[
                                            { field: 'servicio_nombre', headerName: 'Servicio', flex: 1 },
                                            { field: 'prestador_nombre', headerName: 'Prestador', flex: 1 },
                                            { field: 'descripcion', headerName: 'Descripción', flex: 1 },
                                            {
                                                field: 'duracion',
                                                headerName: 'Duración',
                                                flex: 1,
                                                valueFormatter: (value) => {
                                                    if (!value) return '-';
                                                    // Si viene en formato HH:MM:SS, mostrar solo HH:MM
                                                    const parts = value.split(':');
                                                    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : value;
                                                },
                                            },
                                            {
                                                field: 'importe',
                                                headerName: 'Importe',
                                                width: 120,
                                                valueFormatter: (value) => value ? `$${value}` : '-',
                                            },
                                            {
                                                field: 'importe_prestador',
                                                headerName: 'Imp. Prestador',
                                                width: 130,
                                                valueFormatter: (value) => value ? `$${value}` : '-',
                                            },
                                            {
                                                field: 'cliente_cuenta_nombre',
                                                headerName: 'A cargo de',
                                                flex: 1,
                                                valueFormatter: (value) => value || '—',
                                            },
                                        ]}
                                        getRowId={(row) => row.id ?? row.tempId}
                                        onRowsChange={(newRows) => onChange('servicios_evento', newRows)}
                                        modalTitle="Servicio del Evento"
                                        getEmptyItem={() => ({
                                            servicio: null,
                                            servicio_nombre: '',
                                            descripcion: '',
                                            prestador: null,
                                            prestador_nombre: '',
                                            cliente_cuenta: null,
                                            cliente_cuenta_nombre: '',
                                            lugar: '',
                                            duracion: null,
                                            importe: 0,
                                            importe_prestador: null,
                                            activo: true,
                                            presupuesto: '',
                                            observaciones: '',
                                        })}
                                        isItemValid={(item) => !!item.servicio}
                                    >
                                        {({ currentItem, setCurrentItem }) => (
                                            <>
                                                <BaseAutocomplete
                                                    field={modalFields.servicio}
                                                    value={currentItem.servicio}
                                                    onChange={(value) => setCurrentItem(prev => ({
                                                        ...prev,
                                                        servicio: value,
                                                        // Limpiar prestador al cambiar servicio
                                                        prestador: null,
                                                        prestador_nombre: '',
                                                    }))}
                                                    onSelectionChange={async (option) => {
                                                        if (option) {
                                                            const duracionEstimada = option.extra?.[0] || '';
                                                            setCurrentItem(prev => ({
                                                                ...prev,
                                                                servicio_nombre: option.label,
                                                                duracion: duracionEstimada,
                                                            }));
                                                            try {
                                                                const tipoEventoParam = values.tipo_evento ? `&tipo_evento=${values.tipo_evento}` : '';
                                                                const data = await apiClient.get(
                                                                    `/lookup/precioservicio/?servicio=${option.id}${tipoEventoParam}`
                                                                );
                                                                setCurrentItem(prev => ({
                                                                    ...prev,
                                                                    importe: data?.precio ?? 0,
                                                                }));
                                                            } catch (error) {
                                                                console.error('Error al obtener precio del servicio:', error);
                                                            }
                                                        }
                                                    }}
                                                    filterParams={{ activo: true, extra_fields: ['duracion_estimada'] }}
                                                />
                                                <BaseAutocomplete
                                                    field={modalFields.prestador}
                                                    value={currentItem.prestador}
                                                    onChange={(value) => setCurrentItem(prev => ({
                                                        ...prev,
                                                        prestador: value,
                                                        ...(!value && { importe_prestador: 0, prestador_nombre: '' }),
                                                    }))}
                                                    onSelectionChange={async (option) => {
                                                        if (option) {
                                                            setCurrentItem(prev => ({
                                                                ...prev,
                                                                prestador_nombre: option.label,
                                                            }));
                                                            // Buscar precio de referencia del prestador para este servicio y tipo de evento
                                                            try {
                                                                const tipoEventoParam = values.tipo_evento ? `&tipo_evento=${values.tipo_evento}` : '';
                                                                const data = await apiClient.get(
                                                                    `/lookup/precioprestador/?prestador=${option.id}&servicio=${currentItem.servicio}${tipoEventoParam}`
                                                                );
                                                                if (data?.precio != null) {
                                                                    setCurrentItem(prev => ({
                                                                        ...prev,
                                                                        importe_prestador: data.precio,
                                                                    }));
                                                                }
                                                            } catch (error) {
                                                                console.error('Error al obtener precio del prestador:', error);
                                                            }
                                                        }
                                                    }}
                                                    lookupName="prestador"
                                                    disabled={!currentItem.servicio}
                                                    filterParams={{
                                                        servicios_prestador__servicio: currentItem.servicio,
                                                        activo: true,
                                                    }}
                                                />
                                                <BaseAutocomplete
                                                    field={modalFields.cliente_cuenta}
                                                    value={currentItem.cliente_cuenta}
                                                    onChange={(value) => setCurrentItem(prev => ({
                                                        ...prev,
                                                        cliente_cuenta: value,
                                                        ...(!value && { cliente_cuenta_nombre: '' }),
                                                    }))}
                                                    onSelectionChange={(option) => setCurrentItem(prev => ({
                                                        ...prev,
                                                        cliente_cuenta_nombre: option?.label || '',
                                                    }))}
                                                    lookupName="cliente"
                                                    filterParams={{ extra_fields: ['telefono'] }}
                                                />
                                                <BaseInput
                                                    field={modalFields.lugar}
                                                    value={currentItem.lugar || ''}
                                                    onChange={(value) => setCurrentItem(prev => ({ ...prev, lugar: value }))}
                                                />
                                                <BaseInput
                                                    field={modalFields.descripcion}
                                                    value={currentItem.descripcion || ''}
                                                    onChange={(value) => setCurrentItem(prev => ({ ...prev, descripcion: value }))}
                                                />
                                                <BaseInput
                                                    field={modalFields.duracion}
                                                    value={currentItem.duracion || ''}
                                                    onChange={(value) => setCurrentItem(prev => ({ ...prev, duracion: value }))}
                                                />
                                                <BaseFlexBox>
                                                    <BaseInput
                                                        field={modalFields.importe}
                                                        value={currentItem.importe}
                                                        onChange={(value) => setCurrentItem(prev => ({ ...prev, importe: value }))}
                                                    />
                                                    <BaseInput
                                                        field={modalFields.importe_prestador}
                                                        value={currentItem.importe_prestador}
                                                        onChange={(value) => setCurrentItem(prev => ({ ...prev, importe_prestador: value }))}
                                                        disabled={!currentItem.prestador}
                                                    />
                                                </BaseFlexBox>
                                                <BaseInput
                                                    field={{ ...modalFields.observaciones, minRows:2, rows: 2 }}
                                                    value={currentItem.observaciones || ''}
                                                    onChange={(value) => setCurrentItem(prev => ({ ...prev, observaciones: value }))}
                                                />
                                            </>
                                        )}
                                    </BaseEditGrid>

                                    <BaseInput
                                        field={fieldProps.duracion}
                                        value={values.duracion || ''}
                                        onChange={(value) => onChange('duracion', value)}
                                    />

                                    <BaseInput
                                        field={{ ...fieldProps.observaciones, minRows:2, rows: 3}}
                                        value={values.observaciones || ''}
                                        onChange={(value) => onChange('observaciones', value)}
                                    />

                                    <BaseInput
                                        field={fieldProps.nro_factura_emitida}
                                        value={values.nro_factura_emitida || ''}
                                        onChange={(value) => onChange('nro_factura_emitida', value)}
                                    />
                                </>
                            )}

                            {/* ── Tab 1: Cobros ── */}
                            {tabIndex === 1 && isEdit && (
                                <CobrosTab
                                    eventoId={id}
                                    eventoEstado={values.estado}
                                    clienteId={values.cliente}
                                    clienteNombre={localLabelsRef.current.cliente || values.cliente_nombre || ''}
                                    serviciosEvento={values.servicios_evento}
                                    concepto={buildConceptoCobro(values)}
                                />
                            )}

                            {/* ── Tab 2: Pagos ── */}
                            {tabIndex === 2 && isEdit && (
                                <PagosTab
                                    eventoId={id}
                                    serviciosEvento={values.servicios_evento}
                                    buildConceptoPago={(servicioNombre) => buildConceptoPago(values, servicioNombre)}
                                />
                            )}

                            {/* ── Tab 3: Costos ── */}
                            {tabIndex === 3 && isEdit && (
                                <CostosTab eventoId={id} />
                            )}
                        </>
                    );
                }}
            </BaseCrudPageContainer>

            <Dialog open={showPresupuestoDialog}>
                <DialogTitle>Evento creado</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        ¿Querés generar el presupuesto PDF?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handlePresupuestoDialogClose(false)}>No</Button>
                    <Button
                        variant="contained"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => handlePresupuestoDialogClose(true)}
                    >
                        Sí, generar
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={showConflictDialog} onClose={() => conflictResolveRef.current?.(false)}>
                <DialogTitle>Conflicto de horario</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        La fecha y horario elegidos se superponen con los siguientes eventos:
                    </DialogContentText>
                    <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                        {conflicts.map((c, i) => (
                            <li key={i}>{c}</li>
                        ))}
                    </Box>
                    <DialogContentText sx={{ mt: 1 }}>
                        ¿Querés guardar el evento de todas formas?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => conflictResolveRef.current?.(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={() => conflictResolveRef.current?.(true)}>
                        Guardar igual
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
