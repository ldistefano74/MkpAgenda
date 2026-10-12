import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

/**
 * Hook para obtener los valores iniciales de una nueva instancia desde el backend
 * @param {string} modelName - Nombre del modelo/serializer (ej: 'cliente', 'prestador')
 * @param {Object} options - Opciones adicionales para useQuery
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useNewInstance(modelName, options = {}) {
    const normalizedModelName = modelName?.toLowerCase();

    return useQuery({
        queryKey: ['new', normalizedModelName],
        queryFn: async () => {
            if (!normalizedModelName) {
                throw new Error('El nombre del modelo es requerido');
            }
            return await apiClient.get(`/new/${normalizedModelName}/`);
        },
        enabled: Boolean(normalizedModelName),
        staleTime: 5 * 60 * 1000, // 5 minutos - los defaults pueden cambiar
        gcTime: 10 * 60 * 1000, // 10 minutos en cache
        ...options,
    });
}
