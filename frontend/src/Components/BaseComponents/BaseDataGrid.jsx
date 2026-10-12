import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridActionsCellItem, gridClasses } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PropTypes from 'prop-types';

/**
 * BaseDataGrid - Componente base para grillas de datos reutilizable.
 *
 * Proporciona estilos y comportamientos comunes para DataGrids en la aplicación:
 * - Estilos que eliminan outlines de focus en celdas y headers
 * - Columna de acciones configurable con botón de eliminar
 * - Soporte para modo "inline" (formularios embebidos) y modo "page" (páginas completas)
 *
 * @example
 * // Modo inline (dentro de formularios, altura dinámica hasta 5 filas por defecto)
 * <BaseDataGrid
 *   rows={items}
 *   columns={[{ field: 'nombre', headerName: 'Nombre', flex: 1 }]}
 *   getRowId={(row) => row.id || row.tempId}
 *   onRowClick={(params) => handleEdit(params.row)}
 *   onDelete={(row) => handleDelete(row)}
 *   variant="inline"
 *   maxRows={3}  // Opcional: limitar a 3 filas antes de scroll
 * />
 *
 * @example
 * // Modo page (páginas de listado con paginación)
 * <BaseDataGrid
 *   rows={data}
 *   columns={columns}
 *   loading={isLoading}
 *   onRowClick={handleRowClick}
 *   onDelete={handleDelete}
 *   variant="page"
 * />
 *
 * @example
 * // Filas expandibles (drilldown): agrega una columna con flecha que, al
 * // hacer click, despliega debajo de la fila el contenido devuelto por
 * // `getDetailPanelContent`. Implementado con el truco de colSpan (no
 * // requiere MUI X Pro), por eso el sorting por columna se deshabilita
 * // mientras la feature está activa: reordenar rompería la posición de la
 * // fila sintética inyectada justo debajo de su fila padre.
 * <BaseDataGrid
 *   rows={data}
 *   columns={columns}
 *   getDetailPanelContent={(row) => <MiDetalle row={row} />}
 * />
 */

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MAX_INLINE_ROWS = 5;

// Alturas aproximadas de filas según densidad (en píxeles)
const ROW_HEIGHT = {
    compact: 36,
    standard: 52,
    comfortable: 67,
};
const HEADER_HEIGHT = 40;

// Ancho aproximado que ocupa cada ícono de la columna de acciones (en píxeles)
const ACTION_ICON_WIDTH = 50;
// Piso de ancho para columnas flex que no declaran uno propio
const FLEX_COLUMN_MIN_WIDTH = 120;

// Estilos comunes que eliminan los outlines de focus
const commonSx = {
    [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: {
        outline: 'transparent',
    },
    [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
        outline: 'none',
    },
};

const DETAIL_ROW_PREFIX = '__detail__';

const BaseDataGrid = ({
    rows,
    columns,
    getRowId = (row) => row.id,
    onRowClick,
    onDelete,
    variant = 'page',
    height,
    maxRows = DEFAULT_MAX_INLINE_ROWS,
    loading = false,
    density = 'compact',
    showActions = true,
    actionsColumnProps = {},
    initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions = [5, DEFAULT_PAGE_SIZE, 25, 50],
    initialSortModel,
    getDetailPanelContent,
    sx: sxProp = {},
    ...otherProps
}) => {
    // Ids expandidos del drilldown (feature de detail panel, ver getDetailPanelContent)
    const [expandedIds, setExpandedIds] = React.useState(() => new Set());

    const toggleExpanded = React.useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Construir columnas incluyendo la columna de acciones y/o la de expandir si corresponden
    const gridColumns = React.useMemo(() => {
        // El scroll horizontal lo maneja el propio DataGrid: se activa cuando la
        // suma de los minWidth supera el ancho disponible. Una columna flex sin
        // minWidth cae al default de 50px de MUI y se comprime en vez de hacer
        // scrollear la grilla, así que le damos un piso legible.
        let cols = columns.map((col) => (
            col.flex && col.minWidth == null && col.width == null
                ? { ...col, minWidth: FLEX_COLUMN_MIN_WIDTH }
                : col
        ));

        if (getDetailPanelContent) {
            const expandColumn = {
                field: '__expand',
                headerName: '',
                width: 40,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                display: 'flex',
                // Fila sintética de detalle: ocupa todo el ancho de la grilla
                // (clamp automático de MUI X si excede la cantidad de columnas).
                colSpan: (_value, row) => (row.__isDetailRow ? 100 : undefined),
                renderCell: (params) => {
                    if (params.row.__isDetailRow) {
                        return (
                            <Box sx={{ width: '100%', py: 1 }}>{params.row.__detailContent}</Box>
                        );
                    }
                    const rowId = getRowId(params.row);
                    const expanded = expandedIds.has(rowId);
                    return (
                        <IconButton
                            size="small"
                            aria-label={expanded ? 'Contraer' : 'Expandir'}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(rowId);
                            }}
                        >
                            {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                        </IconButton>
                    );
                },
            };
            cols = [expandColumn, ...cols];
        }

        if (showActions && onDelete) {
            // Cantidad de acciones custom (además de eliminar) para dimensionar la
            // columna: sin minWidth explícito MUI usa 50px y, en pantallas angostas
            // donde el resto de las columnas ya consume todo el ancho, los íconos
            // extra quedan recortados.
            const sampleRow = rows.find((row) => !row.__isDetailRow);
            const customActionsCount = sampleRow
                ? (actionsColumnProps.getActions?.({ id: getRowId(sampleRow), row: sampleRow }) || []).length
                : 0;

            const actionsColumn = {
                field: 'actions',
                type: 'actions',
                flex: 0.8,
                minWidth: ACTION_ICON_WIDTH * (customActionsCount + 1),
                align: 'right',
                headerName: '',
                ...actionsColumnProps,
                getActions: (params) => {
                    if (params.row.__isDetailRow) return [];
                    const customActions = actionsColumnProps.getActions?.(params) || [];
                    const deleteAction = (
                        <GridActionsCellItem
                            key="delete-action"
                            icon={<DeleteIcon />}
                            label="Eliminar"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(params.row, params);
                            }}
                        />
                    );
                    return [...customActions, deleteAction];
                },
            };
            cols = [...cols, actionsColumn];
        }

        return cols;
    }, [columns, rows, showActions, onDelete, actionsColumnProps, getDetailPanelContent, expandedIds, getRowId, toggleExpanded]);

    // Intercala, después de cada fila expandida, una fila sintética con el
    // contenido de detalle (truco de colSpan: no requiere MUI X Pro).
    const displayRows = React.useMemo(() => {
        if (!getDetailPanelContent) return rows;
        const result = [];
        rows.forEach((row) => {
            result.push(row);
            const rowId = getRowId(row);
            if (expandedIds.has(rowId)) {
                result.push({
                    __isDetailRow: true,
                    __detailRowId: `${DETAIL_ROW_PREFIX}${rowId}`,
                    __detailContent: getDetailPanelContent(row),
                });
            }
        });
        return result;
    }, [rows, expandedIds, getDetailPanelContent, getRowId]);

    const gridGetRowId = React.useCallback(
        (row) => (row.__isDetailRow ? row.__detailRowId : getRowId(row)),
        [getRowId],
    );

    const gridOnRowClick = React.useCallback(
        (params, event, details) => {
            if (params.row.__isDetailRow) return;
            onRowClick?.(params, event, details);
        },
        [onRowClick],
    );

    // Props específicos según variante
    const variantProps = React.useMemo(() => {
        if (variant === 'inline') {
            return {
                hideFooter: true,
                disableColumnMenu: true,
            };
        }
        // variant === 'page'
        return {
            pagination: true,
            showToolbar: true,
            pageSizeOptions,
            initialState: {
                pagination: { paginationModel: { pageSize: initialPageSize } },
                ...(initialSortModel ? { sorting: { sortModel: initialSortModel } } : {}),
            },
        };
    }, [variant, pageSizeOptions, initialPageSize, initialSortModel]);

    // Calcular altura dinámica para variante inline
    const calculatedHeight = React.useMemo(() => {
        if (height) return height; // Si se pasa altura explícita, usarla
        if (variant !== 'inline') return undefined; // Solo calcular para inline

        const rowHeight = ROW_HEIGHT[density] || ROW_HEIGHT.compact;
        const visibleRows = Math.min(rows.length, maxRows);
        // Altura = header + filas visibles (mínimo 1 fila para mostrar "No rows")
        return HEADER_HEIGHT + rowHeight * Math.max(visibleRows, 1) + 2; // +2 para bordes
    }, [height, variant, density, rows.length, maxRows]);

    // Combinar estilos
    const combinedSx = React.useMemo(() => ({
        ...commonSx,
        ...(calculatedHeight ? { height: calculatedHeight } : {}),
        ...sxProp,
    }), [calculatedHeight, sxProp]);

    return (
        <DataGrid
            rows={displayRows}
            columns={gridColumns}
            getRowId={gridGetRowId}
            density={density}
            disableRowSelectionOnClick
            onRowClick={gridOnRowClick}
            loading={loading}
            // Con detail panel activo, reordenar rompería la posición de la
            // fila sintética inyectada justo debajo de su fila padre.
            disableColumnSorting={Boolean(getDetailPanelContent)}
            getRowHeight={getDetailPanelContent ? (params) => (params.model.__isDetailRow ? 'auto' : undefined) : undefined}
            sx={combinedSx}
            {...variantProps}
            {...otherProps}
        />
    );
};

BaseDataGrid.propTypes = {
    /** Array de datos a mostrar en la grilla */
    rows: PropTypes.array.isRequired,
    /** Definición de columnas (sin incluir la columna de acciones) */
    columns: PropTypes.array.isRequired,
    /** Función para obtener el ID único de cada fila */
    getRowId: PropTypes.func,
    /** Callback cuando se hace click en una fila */
    onRowClick: PropTypes.func,
    /** Callback para eliminar una fila. Recibe (row, params) */
    onDelete: PropTypes.func,
    /**
     * Variante de la grilla:
     * - 'inline': Sin paginación, altura dinámica, para uso dentro de formularios
     * - 'page': Con paginación y toolbar, para páginas de listado
     */
    variant: PropTypes.oneOf(['inline', 'page']),
    /** Altura fija de la grilla (sobreescribe el cálculo automático) */
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    /** Número máximo de filas visibles antes de hacer scroll (solo variant='inline', default: 5) */
    maxRows: PropTypes.number,
    /** Indica si los datos están cargando */
    loading: PropTypes.bool,
    /** Densidad de la grilla */
    density: PropTypes.oneOf(['compact', 'standard', 'comfortable']),
    /** Mostrar columna de acciones */
    showActions: PropTypes.bool,
    /** Props adicionales para la columna de acciones */
    actionsColumnProps: PropTypes.object,
    /** Tamaño de página inicial (solo para variant='page') */
    initialPageSize: PropTypes.number,
    /** Opciones de tamaño de página (solo para variant='page') */
    pageSizeOptions: PropTypes.array,
    /**
     * Habilita filas expandibles (drilldown): agrega una columna de flecha
     * que, al expandirse, despliega el nodo devuelto por esta función debajo
     * de la fila. Mientras esté seteado, se deshabilita el sorting por
     * columna (ver nota en el ejemplo de arriba).
     */
    getDetailPanelContent: PropTypes.func,
    /** Estilos adicionales */
    sx: PropTypes.object,
};

export default BaseDataGrid;
