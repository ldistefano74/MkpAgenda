import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

/**
 * Hook para obtener datos de lookup usando React Query
 * @param {string} entityName - Nombre de la entidad o custom lookup (ej: 'redsocial', 'cliente', 'servicio')
 * @param {Object} options - Opciones adicionales para useQuery
 * @param {Object} filterParams - Parámetros de filtro opcionales (ej: { activo: true, extra_fields: ['campo1', 'campo2'] })
 * @returns {Object} { data, isLoading, error, refetch }
 *
 * El endpoint devuelve una lista de arrays [descripción, id, ...extra_fields]
 * Ejemplo: [["Servicio 1", 1, "02:30:00"], ["Servicio 2", 2, "01:00:00"]]
 */
export function useLookup(entityName, options = {}, filterParams = {}) {
    const normalizedEntityName = entityName?.toLowerCase();

    // Construir query string a partir de filterParams (soporta arrays para parámetros repetidos)
    const queryString = Object.entries(filterParams)
        .filter(([_, value]) => value != null && value !== '')
        .flatMap(([key, value]) =>
            Array.isArray(value)
                ? value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
                : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join('&');

    const url = queryString
        ? `/lookup/${normalizedEntityName}/?${queryString}`
        : `/lookup/${normalizedEntityName}/`;

    return useQuery({
        queryKey: ['lookup', normalizedEntityName, filterParams],
        queryFn: async () => {
            if (!normalizedEntityName) {
                throw new Error('El nombre del lookup es requerido');
            }
            return await apiClient.get(url);
        },
        enabled: Boolean(normalizedEntityName),
        gcTime: 30 * 60 * 1000,
        ...options,
    });
}
