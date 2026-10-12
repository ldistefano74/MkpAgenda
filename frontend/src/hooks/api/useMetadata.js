import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

/**
 * Hook para obtener metadata de un modelo usando React Query
 * @param {string} modelName - Nombre del modelo (ej: 'servicio', 'redesocial')
 * @param {Object} options - Opciones adicionales para useQuery
 * @returns {Object} { data, isLoading, error, refetch }
 */
export function useMetadata(modelName, options = {}) {
    const normalizedModelName = modelName?.toLowerCase();

    return useQuery({
        queryKey: ['metadata', normalizedModelName],
        queryFn: async () => {
            if (!normalizedModelName) {
                throw new Error('El nombre del modelo es requerido');
            }
            return await apiClient.get(`/metadata/${normalizedModelName}/`);
        },
        enabled: Boolean(normalizedModelName),
        staleTime: 30 * 60 * 1000, // 30 minutos - metadata raramente cambia
        gcTime: 60 * 60 * 1000, // 1 hora en cache
        ...options,
    });
}
