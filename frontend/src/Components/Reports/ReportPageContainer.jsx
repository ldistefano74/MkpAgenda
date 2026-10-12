import * as React from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { GridActionsCellItem } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import PageContainer from '../Layout/PageContainer';
import BaseDataGrid from '../BaseComponents/BaseDataGrid';
import BaseFlexBox from '../BaseComponents/BaseFlexBox';
import apiClient from '../../lib/apiClient';
import { ReportContext } from './ReportContext';

/**
 * ReportPageContainer - Componente base para páginas de informes.
 *
 * Patrón "query/report view": una sección de filtros arriba y una grilla de
 * resultados abajo. A diferencia de un CRUD list, el fetch es EXPLÍCITO: el
 * usuario arma los filtros y presiona "Generar". La grilla muestra siempre el
 * resultado del último "Generar", no el estado de edición de los filtros.
 *
 * Los filtros se declaran como children usando los wrappers `ReportField.*`,
 * que se auto-registran en el contexto y reportan sus valores. El contenedor
 * arma el query string solo a partir de esos valores; la página no cablea
 * estado de filtros.
 *
 * @param {string} endpoint - Endpoint del informe (ej: 'reportes/movimientos').
 *   Se consulta como `GET /${endpoint}/?<filtros>`.
 * @param {string} title - Título de la página
 * @param {Array} columns - Columnas de la grilla (sin columna de acciones)
 * @param {React.ReactNode} children - Filtros (`ReportField.*`)
 * @param {Function} [getRowId] - Obtiene el id único de cada fila
 * @param {Function} [summary] - Render opcional de totales; recibe las filas
 * @param {Array} [initialSortModel] - Orden inicial de la grilla
 * @param {React.ReactNode} [actions] - Acciones del header (ej: exportar a PDF)
 * @param {Function} [getRowEditUrl] - Dada una fila, devuelve la URL de edición
 *   del registro, o `null`/`undefined` si esa fila no es navegable. Cuando se
 *   provee, la grilla muestra una acción de "Editar" por fila.
 * @param {Function} [getDetailPanelContent] - Habilita filas expandibles
 *   (drilldown): dada una fila, devuelve el nodo a desplegar debajo. Ver
 *   `BaseDataGrid` para la implementación (truco de colSpan, sin MUI X Pro).
 */
export default function ReportPageContainer({
    endpoint,
    title,
    columns,
    children,
    getRowId = (row) => row.id,
    summary = null,
    initialSortModel,
    actions = null,
    getRowEditUrl = null,
    getDetailPanelContent = null,
}) {
    // Estado de edición de los filtros (lo que el usuario está tipeando)
    const [values, setValues] = React.useState({});
    // Filtros efectivamente aplicados (los del último "Generar"). null = aún no generó.
    const [appliedValues, setAppliedValues] = React.useState(null);
    // Valores por defecto registrados por cada filtro (para "Limpiar")
    const defaultsRef = React.useRef({});
    // Metadata registrada por cada filtro (ej: { required: true })
    const metaRef = React.useRef({});

    const registerFilter = React.useCallback((key, defaultValue, meta) => {
        defaultsRef.current[key] = defaultValue;
        if (meta) metaRef.current[key] = meta;
        setValues((prev) => (key in prev ? prev : { ...prev, [key]: defaultValue }));
    }, []);

    const setValue = React.useCallback((key, value) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const contextValue = React.useMemo(
        () => ({ values, setValue, registerFilter }),
        [values, setValue, registerFilter],
    );

    const queryString = React.useMemo(
        () => (appliedValues ? buildQueryString(appliedValues) : ''),
        [appliedValues],
    );

    const { data: rows = [], isFetching, error } = useQuery({
        queryKey: ['report', endpoint, queryString],
        queryFn: () =>
            apiClient.get(queryString ? `/${endpoint}/?${queryString}` : `/${endpoint}/`),
        enabled: appliedValues !== null,
    });

    // Filtros obligatorios que están vacíos: bloquean "Generar".
    const missingRequired = React.useMemo(
        () =>
            Object.entries(metaRef.current)
                .filter(([key, meta]) => meta.required && isEmpty(values[key]))
                .map(([key]) => key),
        [values],
    );
    const canGenerate = missingRequired.length === 0;

    const handleGenerate = React.useCallback(() => {
        if (missingRequired.length > 0) return;
        setAppliedValues({ ...values });
    }, [values, missingRequired]);

    const handleClear = React.useCallback(() => {
        setValues({ ...defaultsRef.current });
        setAppliedValues(null);
    }, []);

    const hasGenerated = appliedValues !== null;

    // Si el reporte define URLs de edición, agregamos una columna de acción que
    // abre la fila en una pestaña nueva. Devolver null/undefined en getRowEditUrl
    // oculta la acción para esa fila (ej: fuentes sin página de edición).
    const gridColumns = React.useMemo(() => {
        if (!getRowEditUrl) return columns;
        const actionsColumn = {
            field: '__report_actions',
            type: 'actions',
            headerName: '',
            width: 60,
            getActions: (params) => {
                const url = getRowEditUrl(params.row);
                if (!url) return [];
                return [
                    <GridActionsCellItem
                        key="edit"
                        icon={<OpenInNewIcon />}
                        label="Abrir en pestaña nueva"
                        onClick={() => openInNewTab(url)}
                    />,
                ];
            },
        };
        return [...columns, actionsColumn];
    }, [columns, getRowEditUrl]);

    return (
        <ReportContext.Provider value={contextValue}>
            <PageContainer title={title} actions={actions}>
                <Stack spacing={2} sx={{ flex: 1, width: '100%' }}>
                    {/* Sección de filtros */}
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={2}>
                            <BaseFlexBox sx={{ alignItems: 'flex-start' }}>
                                {children}
                            </BaseFlexBox>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Button
                                    variant="contained"
                                    startIcon={<SearchIcon />}
                                    onClick={handleGenerate}
                                    disabled={!canGenerate}
                                >
                                    Generar
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<ClearIcon />}
                                    onClick={handleClear}
                                >
                                    Limpiar
                                </Button>
                                {!canGenerate ? (
                                    <Typography variant="caption" color="error">
                                        Completá los filtros obligatorios para generar el informe.
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Stack>
                    </Paper>

                    {/* Resultados */}
                    <Box sx={{ flex: 1, width: '100%' }}>
                        {error ? (
                            <Alert severity="error">{error.message}</Alert>
                        ) : !hasGenerated ? (
                            <Alert severity="info">
                                Configurá los filtros y presioná «Generar» para ver el informe.
                            </Alert>
                        ) : (
                            <>
                                <BaseDataGrid
                                    rows={rows}
                                    columns={gridColumns}
                                    getRowId={getRowId}
                                    variant="page"
                                    showActions={false}
                                    loading={isFetching}
                                    initialSortModel={initialSortModel}
                                    getDetailPanelContent={getDetailPanelContent}
                                />
                                {summary && rows.length > 0 ? (
                                    <Box sx={{ mt: 2 }}>{summary(rows)}</Box>
                                ) : null}
                            </>
                        )}
                    </Box>
                </Stack>
            </PageContainer>
        </ReportContext.Provider>
    );
}

/** Un valor de filtro se considera vacío (= "todos") cuando es null o cadena vacía. */
function isEmpty(value) {
    return value == null || value === '';
}

/**
 * Abre una ruta de la app en una pestaña nueva. Como el router es hash-based
 * (`createHashRouter`), construye la URL absoluta con el `#` correspondiente.
 */
function openInNewTab(url) {
    const { origin, pathname } = window.location;
    window.open(`${origin}${pathname}#${url}`, '_blank', 'noopener');
}

/**
 * Arma un query string a partir de los valores de filtros, ignorando los
 * vacíos. Soporta arrays (genera el param repetido).
 */
function buildQueryString(values) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value == null || value === '') return;
        if (Array.isArray(value)) {
            value.forEach((v) => {
                if (v != null && v !== '') params.append(key, v);
            });
        } else {
            params.append(key, value);
        }
    });
    return params.toString();
}

ReportPageContainer.propTypes = {
    endpoint: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    columns: PropTypes.array.isRequired,
    children: PropTypes.node,
    getRowId: PropTypes.func,
    summary: PropTypes.func,
    initialSortModel: PropTypes.array,
    actions: PropTypes.node,
    getRowEditUrl: PropTypes.func,
    getDetailPanelContent: PropTypes.func,
};
