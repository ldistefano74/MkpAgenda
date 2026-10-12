import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import PropTypes from 'prop-types';

import BaseDataGrid from './BaseDataGrid';

/**
 * BaseEditGrid - Grilla editable con modal para agregar/editar elementos.
 *
 * Combina una BaseDataGrid con un modal de edición y un botón de agregar (+).
 * Gestiona internamente el estado del modal y proporciona callbacks para
 * integrar lógica personalizada al agregar, editar o cancelar.
 *
 * @example
 * // Uso básico con children como contenido del modal
 * <BaseEditGrid
 *   rows={items}
 *   columns={[
 *     { field: 'nombre', headerName: 'Nombre', flex: 1 },
 *     { field: 'precio', headerName: 'Precio', width: 150 },
 *   ]}
 *   getRowId={(row) => row.id || row.tempId}
 *   onRowsChange={(newRows) => setItems(newRows)}
 *   modalTitle="Producto"
 *   getEmptyItem={() => ({ nombre: '', precio: '' })}
 * >
 *   {({ currentItem, setCurrentItem }) => (
 *     <>
 *       <TextField
 *         label="Nombre"
 *         value={currentItem.nombre}
 *         onChange={(e) => setCurrentItem(prev => ({ ...prev, nombre: e.target.value }))}
 *       />
 *       <TextField
 *         label="Precio"
 *         value={currentItem.precio}
 *         onChange={(e) => setCurrentItem(prev => ({ ...prev, precio: e.target.value }))}
 *       />
 *     </>
 *   )}
 * </BaseEditGrid>
 */

// Contador global para generar identificadores temporales únicos para las filas
// nuevas (todavía sin id del backend). Evita colisiones cuando dos filas nuevas
// comparten los mismos valores de negocio.
let tempIdCounter = 0;
const nextTempId = () => `tmp_${Date.now()}_${++tempIdCounter}`;

const BaseEditGrid = ({
    // Datos y columnas
    rows = [],
    columns,
    getRowId = (row) => row.id ?? row.tempId,

    // Callbacks principales
    onRowsChange,
    onBeforeAccept,
    onAccept,
    onCancel,
    onDelete,

    // Configuración del modal
    modalTitle = 'Elemento',
    modalMaxWidth = 'sm',
    getEmptyItem = () => ({}),

    // Validación
    isItemValid = () => true,

    // Props para BaseDataGrid
    variant = 'inline',
    maxRows,
    density = 'compact',
    showActions = true,

    // Estilos
    maxWidth,
    sx = {},
    gridSx = {},

    // Contenido extra en el footer (junto al botón +)
    footerContent,

    // Deshabilitar el botón de agregar
    disabledAdd = false,
    disabledAddTooltip = '',

    // Datos del modal todavía cargando (ej: metadata): deshabilita el + y no
    // renderiza children hasta que estén listos.
    loading = false,

    // Contenido del modal (render prop)
    children,
}) => {
    const [open, setOpen] = React.useState(false);
    const [currentItem, setCurrentItem] = React.useState(getEmptyItem());
    const [editingIndex, setEditingIndex] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [saving, setSaving] = React.useState(false);

    const isEditing = editingIndex !== null;

    // Abrir modal para agregar nuevo
    const handleAdd = () => {
        setCurrentItem({ ...getEmptyItem(), tempId: nextTempId() });
        setEditingIndex(null);
        setError(null);
        setOpen(true);
    };

    // Abrir modal para editar existente
    const handleEdit = (row, index) => {
        setCurrentItem({ ...row });
        setEditingIndex(index);
        setError(null);
        setOpen(true);
    };

    // Cerrar modal (Cancelar)
    const handleClose = () => {
        if (saving) return; // no cerrar mientras hay un guardado en curso
        setOpen(false);
        setCurrentItem(getEmptyItem());
        setEditingIndex(null);
        setError(null);
        onCancel?.();
    };

    // Aceptar cambios
    const handleAccept = async () => {
        setError(null);

        if (!isItemValid(currentItem) || saving) {
            return;
        }

        // Validación pre-aceptación (puede ser async)
        // Si retorna false o un string con mensaje de error, cancela el guardado
        if (onBeforeAccept) {
            let result;
            setSaving(true);
            try {
                result = await onBeforeAccept(currentItem, isEditing, editingIndex);
            } finally {
                setSaving(false);
            }
            if (result === false) {
                return;
            }
            // Si retorna un string, mostrar como error
            if (typeof result === 'string') {
                setError(result);
                return;
            }
        }

        let updatedRows;
        if (isEditing) {
            updatedRows = [...rows];
            updatedRows[editingIndex] = currentItem;
        } else {
            updatedRows = [...rows, currentItem];
        }

        // Notificar el cambio de filas
        onRowsChange?.(updatedRows);

        // Callback adicional si se necesita lógica extra
        onAccept?.(currentItem, isEditing, updatedRows);

        // Cerrar modal
        setOpen(false);
        setCurrentItem(getEmptyItem());
        setEditingIndex(null);
    };

    // Eliminar fila
    const handleDelete = (row) => {
        const rowId = getRowId(row);
        const newRows = rows.filter((r) => getRowId(r) !== rowId);
        onRowsChange?.(newRows);
        onDelete?.(row, newRows);
    };

    // Handler para click en fila
    const handleRowClick = (params) => {
        const index = rows.findIndex((r) => getRowId(r) === params.id);
        handleEdit(params.row, index);
    };

    return (
        <Box sx={{ width: '100%', maxWidth, ...sx }}>
            <BaseDataGrid
                rows={rows}
                columns={columns}
                getRowId={getRowId}
                variant={variant}
                maxRows={maxRows}
                density={density}
                showActions={showActions}
                onRowClick={handleRowClick}
                onDelete={handleDelete}
                sx={{ mb: 2, ...gridSx }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                {footerContent && <Box sx={{ flex: 1 }}>{footerContent}</Box>}
                <Tooltip title={disabledAdd ? disabledAddTooltip : ''} arrow>
                    <span>
                        <Button
                            variant="contained"
                            onClick={handleAdd}
                            disabled={disabledAdd || loading}
                            sx={{ minWidth: 0, width: 40, height: 40, p: 0 }}
                            aria-label="Agregar"
                        >
                            <AddIcon />
                        </Button>
                    </span>
                </Tooltip>
            </Box>

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth={modalMaxWidth}
                disableRestoreFocus
            >
                <DialogTitle>
                    {isEditing ? `Editar ${modalTitle}` : `Agregar ${modalTitle}`}
                </DialogTitle>
                <DialogContent>
                    <Collapse in={!!error}>
                        <Alert
                            severity="error"
                            onClose={() => setError(null)}
                            sx={{ mb: 2 }}
                        >
                            {error}
                        </Alert>
                    </Collapse>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : typeof children === 'function'
                            ? children({
                                currentItem,
                                setCurrentItem,
                                isEditing,
                            })
                            : children
                        }
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleAccept}
                        variant="contained"
                        disabled={loading || !isItemValid(currentItem) || saving}
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        Aceptar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

BaseEditGrid.propTypes = {
    /** Array de datos a mostrar en la grilla */
    rows: PropTypes.array,
    /** Definición de columnas para la grilla */
    columns: PropTypes.array.isRequired,
    /** Función para obtener el ID único de cada fila */
    getRowId: PropTypes.func,

    /** Callback cuando cambian las filas (agregar, editar, eliminar). Recibe (newRows) */
    onRowsChange: PropTypes.func,
    /** Callback de validación antes de aceptar. Recibe (item, isEditing, editingIndex). Retorna false para cancelar silenciosamente, un string para mostrar error, o true/undefined para continuar. Puede ser async. */
    onBeforeAccept: PropTypes.func,
    /** Callback adicional al aceptar en el modal. Recibe (item, isEditing, newRows) */
    onAccept: PropTypes.func,
    /** Callback al cancelar/cerrar el modal */
    onCancel: PropTypes.func,
    /** Callback adicional al eliminar. Recibe (deletedRow, newRows) */
    onDelete: PropTypes.func,

    /** Título base para el modal (se prefija con "Agregar" o "Editar") */
    modalTitle: PropTypes.string,
    /** Ancho máximo del modal */
    modalMaxWidth: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
    /** Función que retorna un objeto vacío/inicial para nuevos elementos */
    getEmptyItem: PropTypes.func,

    /** Función de validación que determina si el item es válido para guardar */
    isItemValid: PropTypes.func,

    /** Variante de la grilla (inline o page) */
    variant: PropTypes.oneOf(['inline', 'page']),
    /** Número máximo de filas visibles antes de scroll */
    maxRows: PropTypes.number,
    /** Densidad de la grilla */
    density: PropTypes.oneOf(['compact', 'standard', 'comfortable']),
    /** Mostrar columna de acciones con botón eliminar */
    showActions: PropTypes.bool,

    /** Ancho máximo del contenedor */
    maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    /** Estilos adicionales para el contenedor */
    sx: PropTypes.object,
    /** Estilos adicionales para la grilla */
    gridSx: PropTypes.object,

    /** Contenido extra para mostrar en el footer junto al botón de agregar */
    footerContent: PropTypes.node,

    /** Deshabilita el botón de agregar */
    disabledAdd: PropTypes.bool,
    /** Texto del tooltip cuando el botón está deshabilitado */
    disabledAddTooltip: PropTypes.string,
    /** Datos del modal cargando: deshabilita el + y muestra un spinner en lugar de children */
    loading: PropTypes.bool,

    /**
     * Contenido del modal. Puede ser:
     * - Una función (render prop) que recibe { currentItem, setCurrentItem, isEditing }
     * - Elementos React directos
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
};

export default BaseEditGrid;
