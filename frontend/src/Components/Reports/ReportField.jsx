import * as React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import BaseInput from '../BaseComponents/BaseInput';
import BaseSelect from '../BaseComponents/BaseSelect';
import BaseAutocomplete from '../BaseComponents/BaseAutocomplete';
import BaseFlexBox from '../BaseComponents/BaseFlexBox';
import { useReportFilter } from './useReportFilter';

/**
 * ReportField.* — wrappers de filtros para usar dentro de <ReportPageContainer>.
 *
 * Cada wrapper se auto-registra en el contexto del reporte y reporta su valor,
 * así el contenedor arma el query string solo. Son la ÚNICA forma soportada de
 * declarar filtros: cualquier input que no pase por acá es invisible para el
 * contenedor.
 *
 * Tipos disponibles:
 * - <ReportField.DateRange name="fecha" />  → fecha_desde / fecha_hasta
 * - <ReportField.Lookup name="medio_pago_cobro" lookup="mediopagocobro" />
 * - <ReportField.Select name="tipo" choices={[...]} />
 * - <ReportField.Text name="concepto" />
 */

/**
 * Calcula el rango por defecto de un DateRange.
 *
 * Con `defaultMonths = N` sugiere los últimos N meses, arrancando en el día 1
 * del mes (desde = día 1 del mes de hoy - N meses, hasta = hoy).
 * Con `defaultDays = N` sugiere los últimos N días (desde = hoy - N, hasta = hoy).
 * Con ambos `null`/no seteados no sugiere nada (rango vacío). Estos valores
 * quedan registrados como default del filtro, así `handleClear` los restaura
 * solo. `defaultMonths` tiene prioridad sobre `defaultDays` si se pasan los dos.
 */
function dateRangeDefaults(defaultDays, defaultMonths) {
    if (defaultMonths != null) {
        return {
            desde: dayjs().subtract(defaultMonths, 'month').startOf('month').format('YYYY-MM-DD'),
            hasta: dayjs().format('YYYY-MM-DD'),
        };
    }
    if (defaultDays == null) return { desde: '', hasta: '' };
    return {
        desde: dayjs().subtract(defaultDays, 'day').format('YYYY-MM-DD'),
        hasta: dayjs().format('YYYY-MM-DD'),
    };
}

/**
 * Rango de fechas. Registra dos filtros: `${name}_desde` y `${name}_hasta`,
 * que mapean directo a los query params que espera el backend.
 *
 * Por defecto sugiere los últimos 30 días; pasá `defaultDays` para cambiar la
 * ventana, `defaultMonths` para sugerir los últimos N meses completos (desde
 * el día 1) o `defaultDays={null}` para arrancar en blanco.
 */
function DateRange({ name, label, desdeLabel = 'Desde', hastaLabel = 'Hasta', defaultDays = 30, defaultMonths = null, required = false }) {
    const defaults = React.useMemo(() => dateRangeDefaults(defaultDays, defaultMonths), [defaultDays, defaultMonths]);
    const [desde, setDesde] = useReportFilter(`${name}_desde`, defaults.desde, { required });
    const [hasta, setHasta] = useReportFilter(`${name}_hasta`, defaults.hasta, { required });

    const invalid = Boolean(desde && hasta && desde > hasta);

    return (
        <BaseFlexBox sx={{ gap: 1 }}>
            <BaseInput
                field={{
                    name: `${name}_desde`,
                    label: label ? `${label} (${desdeLabel.toLowerCase()})` : desdeLabel,
                    type: 'date',
                    required,
                }}
                value={desde}
                onChange={setDesde}
                error={invalid}
                errorMessage={invalid ? '«Desde» no puede ser posterior a «Hasta»' : undefined}
            />
            <BaseInput
                field={{
                    name: `${name}_hasta`,
                    label: label ? `${label} (${hastaLabel.toLowerCase()})` : hastaLabel,
                    type: 'date',
                    required,
                }}
                value={hasta}
                onChange={setHasta}
            />
        </BaseFlexBox>
    );
}

DateRange.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    desdeLabel: PropTypes.string,
    hastaLabel: PropTypes.string,
    /** Días hacia atrás sugeridos por defecto (null = sin sugerencia) */
    defaultDays: PropTypes.number,
    /** Meses hacia atrás sugeridos por defecto, desde el día 1 del mes (tiene prioridad sobre defaultDays) */
    defaultMonths: PropTypes.number,
    /** Si es obligatorio, ambos extremos deben completarse antes de generar */
    required: PropTypes.bool,
};

/**
 * Filtro de selección contra un endpoint de lookup del backend.
 */
function Lookup({ name, lookup, label, filterParams, required = false }) {
    const [value, setValue] = useReportFilter(name, null, { required });
    return (
        <BaseAutocomplete
            field={{ name, label, required }}
            lookupName={lookup}
            value={value}
            onChange={setValue}
            filterParams={filterParams || {}}
        />
    );
}

Lookup.propTypes = {
    name: PropTypes.string.isRequired,
    lookup: PropTypes.string.isRequired,
    label: PropTypes.string,
    filterParams: PropTypes.object,
    required: PropTypes.bool,
};

/**
 * Filtro de selección sobre un conjunto fijo de opciones (choices estáticos).
 *
 * Cuando NO es obligatorio, antepone una opción vacía ("Todos") para poder
 * volver a "sin filtro" — de lo contrario un Select de MUI no se puede des-elegir.
 */
function Select({ name, label, choices, defaultValue = '', required = false, allLabel = 'Todos' }) {
    const [value, setValue] = useReportFilter(name, defaultValue, { required });
    const options = required
        ? choices
        : [{ value: '', display_name: allLabel }, ...choices];
    return (
        <BaseSelect
            field={{ name, label, choices: options, required }}
            value={value}
            onChange={setValue}
        />
    );
}

Select.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    choices: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            display_name: PropTypes.string.isRequired,
        }),
    ).isRequired,
    defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    required: PropTypes.bool,
    /** Etiqueta de la opción "sin filtro" (solo cuando no es obligatorio) */
    allLabel: PropTypes.string,
};

/**
 * Filtro de texto libre.
 */
function Text({ name, label, required = false }) {
    const [value, setValue] = useReportFilter(name, '', { required });
    return (
        <BaseInput
            field={{ name, label, type: 'text', required }}
            value={value}
            onChange={setValue}
        />
    );
}

Text.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    required: PropTypes.bool,
};

const ReportField = { DateRange, Lookup, Select, Text };

export default ReportField;
