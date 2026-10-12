import { useEffect } from 'react';
import { useReportContext } from './ReportContext';

/**
 * Hook INTERNO del framework de reportes.
 *
 * Registra un filtro en el contexto del reporte (para que el contenedor sepa
 * que existe y conozca su valor por defecto al "Limpiar") y expone su valor
 * actual junto con un setter, al estilo `useState`.
 *
 * No es API pública: usalo únicamente a través de los wrappers `ReportField.*`.
 * Si algún día aparece un filtro que ningún wrapper cubre, recién ahí conviene
 * promover este hook a API pública.
 *
 * @param {string} key - Nombre del filtro (será la key del query param)
 * @param {*} defaultValue - Valor por defecto / al limpiar
 * @param {{required?: boolean}} [meta] - Metadata del filtro (ej: obligatorio).
 *   El contenedor la usa para validar antes de "Generar".
 * @returns {[*, function]} [value, setValue]
 */
export function useReportFilter(key, defaultValue = '', meta) {
    const { values, setValue, registerFilter } = useReportContext();

    // Registrar el filtro una sola vez (por key). El default se usa para
    // inicializar el valor y para restaurarlo al presionar "Limpiar"; la meta
    // (ej: required) le permite al contenedor validar antes de generar.
    useEffect(() => {
        registerFilter(key, defaultValue, meta);
        // defaultValue/meta intencionalmente fuera de deps: el registro es por key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return [values[key] ?? defaultValue, (value) => setValue(key, value)];
}
