import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ReportPageContainer from './ReportPageContainer';
import ReportField from './ReportField';
import { formatFecha } from '../../lib/dateFormat';

/**
 * Informe de movimientos (cobros, pagos y costos) ordenado por fecha.
 *
 * Primer consumidor del framework de reportes. Sirve como referencia para
 * armar nuevos informes: declarar filtros con `ReportField.*` y pasar columnas.
 *
 * El endpoint backend `reportes/movimientos` devuelve filas unificadas con la
 * forma que consumen las columnas de abajo.
 */

const ENDPOINT = 'reportes/movimientos';

const formatImporte = (value) =>
    `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tipo de movimiento unificado entre las distintas fuentes
const TIPO_CHOICES = [
    { value: 'I', display_name: 'Cobro' },
    { value: 'E', display_name: 'Pago' },
    { value: 'C', display_name: 'Costo' },
];

const columns = [
    {
        field: 'fecha',
        headerName: 'Fecha',
        width: 110,
        valueFormatter: (value) => formatFecha(value),
    },
    { field: 'tipo_display', headerName: 'Tipo', width: 100 },
    { field: 'concepto', headerName: 'Concepto', flex: 1, minWidth: 200 },
    { field: 'medio_pago_cobro_nombre', headerName: 'Medio de pago/cobro', width: 180 },
    {
        field: 'importe',
        headerName: 'Importe',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatImporte(value),
    },
];

const getRowId = (row) => `${row.origen}-${row.id}`;

// URL de edición según la fuente de la fila:
// - costo: tiene página propia de edición.
// - movimiento (cobro/pago): se edita dentro de su evento; si no tiene evento
//   asociado (movimiento de cuenta corriente), no es navegable.
const getRowEditUrl = (row) => {
    if (row.origen === 'costo') return `/costos/${row.id}/edit`;
    if (row.origen === 'movimiento' && row.evento_id) return `/eventos/${row.evento_id}/edit`;
    return null;
};

function Summary(rows) {
    // Subtotal por tipo de movimiento + total general (sobre las filas ya filtradas).
    const totalesPorTipo = rows.reduce((acc, r) => {
        acc[r.tipo] = (acc[r.tipo] || 0) + Number(r.importe ?? 0);
        return acc;
    }, {});
    // Balance = Cobros - Pagos - Costos (los egresos restan).
    const balance =
        (totalesPorTipo.I || 0) - (totalesPorTipo.E || 0) - (totalesPorTipo.C || 0);

    return (
        <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            justifyContent="flex-end"
            alignItems="baseline"
            sx={{ gap: 3, pr: 1 }}
        >
            {TIPO_CHOICES.filter((t) => totalesPorTipo[t.value] != null).map((t) => (
                <Typography key={t.value} variant="body2" color="text.secondary">
                    {t.display_name}: <strong>{formatImporte(totalesPorTipo[t.value])}</strong>
                </Typography>
            ))}
            <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
                color={balance < 0 ? 'error.main' : 'success.main'}
            >
                Balance: {formatImporte(balance)}
            </Typography>
        </Stack>
    );
}

export default function MovimientosReport() {
    return (
        <ReportPageContainer
            endpoint={ENDPOINT}
            title="Informe de movimientos"
            columns={columns}
            getRowId={getRowId}
            getRowEditUrl={getRowEditUrl}
            summary={Summary}
            initialSortModel={[{ field: 'fecha', sort: 'asc' }]}
        >
            <ReportField.DateRange name="fecha" label="Fecha" />
            <ReportField.Select name="tipo" label="Tipo" choices={TIPO_CHOICES} />
            <ReportField.Lookup
                name="medio_pago_cobro"
                lookup="mediopagocobro"
                label="Medio de pago/cobro"
            />
        </ReportPageContainer>
    );
}
