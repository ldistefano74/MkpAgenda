import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

/**
 * Hook genérico para operaciones CRUD
 * @param {string} endpoint - El endpoint base de la entidad (ej: 'servicios', 'clientes')
 */
export function useEntity(endpoint) {
    const queryClient = useQueryClient();

    // GET lista
    const useList = (options = {}) => {
        return useQuery({
            queryKey: [endpoint],
            queryFn: () => apiClient.get(`/${endpoint}/`),
            ...options,
        });
    };

    // GET por ID
    const useDetail = (id, options = {}) => {
        return useQuery({
            queryKey: [endpoint, id],
            queryFn: () => apiClient.get(`/${endpoint}/${id}/`),
            enabled: Boolean(id),
            ...options,
        });
    };

    // POST crear
    const useCreate = (options = {}) => {
        return useMutation({
            mutationFn: (data) => apiClient.post(`/${endpoint}/`, data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [endpoint] });
                queryClient.invalidateQueries({ queryKey: ['lookup'] });
            },
            ...options,
        });
    };

    // PUT actualizar
    const useUpdate = (options = {}) => {
        return useMutation({
            mutationFn: ({ id, data }) => apiClient.put(`/${endpoint}/${id}/`, data),
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({ queryKey: [endpoint] });
                queryClient.invalidateQueries({ queryKey: [endpoint, variables.id] });
                queryClient.invalidateQueries({ queryKey: ['lookup'] });
            },
            ...options,
        });
    };

    // PATCH actualizar parcial
    const usePatch = (options = {}) => {
        return useMutation({
            mutationFn: ({ id, data }) => apiClient.patch(`/${endpoint}/${id}/`, data),
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({ queryKey: [endpoint] });
                queryClient.invalidateQueries({ queryKey: [endpoint, variables.id] });
                queryClient.invalidateQueries({ queryKey: ['lookup'] });
            },
            ...options,
        });
    };

    // DELETE eliminar
    const useDelete = (options = {}) => {
        return useMutation({
            mutationFn: (id) => apiClient.delete(`/${endpoint}/${id}/`),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [endpoint] });
                queryClient.invalidateQueries({ queryKey: ['lookup'] });
            },
            ...options,
        });
    };

    return {
        useList,
        useDetail,
        useCreate,
        useUpdate,
        usePatch,
        useDelete,
    };
}
