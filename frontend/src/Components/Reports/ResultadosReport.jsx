import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ReportPageContainer from './ReportPageContainer';
import ReportField from './ReportField';
import ResultadosPeriodoDetail from './ResultadosPeriodoDetail';

/**
 * Informe de resultados: ingresos, costos, pagos y resultado neto agrupados
 * por mes/año.
 *
 * El endpoint backend `reportes/resultados` devuelve una fila por período
 * (mes/año) con los totales ya agregados.
 */

const ENDPOINT = 'reportes/resultados';

const formatImporte = (value) =>
    `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPeriodo = (value) => {
    if (!value) return '';
    const [year, month] = value.split('-');
    return `${month}/${year}`;
};

const columns = [
    {
        field: 'periodo',
        headerName: 'Período',
        flex: 1,
        minWidth: 110,
        valueFormatter: (value) => formatPeriodo(value),
    },
    {
        field: 'ingresos',
        headerName: 'Ingresos',
        flex: 1,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatImporte(value),
    },
    {
        field: 'costos',
        headerName: 'Costos',
        flex: 1,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatImporte(value),
    },
    {
        field: 'pagos',
        headerName: 'Pagos',
        flex: 1,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatImporte(value),
    },
    {
        field: 'resultado',
        headerName: 'Resultado',
        flex: 1,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatImporte(value),
    },
];

function Summary(rows) {
    const totales = rows.reduce(
        (acc, r) => {
            acc.ingresos += Number(r.ingresos ?? 0);
            acc.costos += Number(r.costos ?? 0);
            acc.pagos += Number(r.pagos ?? 0);
            acc.resultado += Number(r.resultado ?? 0);
            return acc;
        },
        { ingresos: 0, costos: 0, pagos: 0, resultado: 0 },
    );

    return (
        <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            justifyContent="flex-end"
            alignItems="baseline"
            sx={{ gap: 3, pr: 1 }}
        >
            <Typography variant="body2" color="text.secondary">
                Ingresos: <strong>{formatImporte(totales.ingresos)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Costos: <strong>{formatImporte(totales.costos)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Pagos: <strong>{formatImporte(totales.pagos)}</strong>
            </Typography>
            <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
                color={totales.resultado < 0 ? 'error.main' : 'success.main'}
            >
                Resultado: {formatImporte(totales.resultado)}
            </Typography>
        </Stack>
    );
}

export default function ResultadosReport() {
    return (
        <ReportPageContainer
            endpoint={ENDPOINT}
            title="Informe de resultados"
            columns={columns}
            getRowId={(row) => row.periodo}
            summary={Summary}
            getDetailPanelContent={(row) => <ResultadosPeriodoDetail row={row} />}
        >
            <ReportField.DateRange name="fecha" label="Fecha" defaultMonths={6} />
        </ReportPageContainer>
    );
}
