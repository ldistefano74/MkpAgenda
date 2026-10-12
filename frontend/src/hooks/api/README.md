# API Hooks

Esta carpeta contiene todos los hooks personalizados para interactuar con la API usando React Query.

## Hooks Disponibles

### `useEntity(endpoint)`
Hook genérico para operaciones CRUD sobre cualquier entidad.

**Retorna:**
- `useList()` - Obtener lista de entidades
- `useDetail(id)` - Obtener detalle de una entidad
- `useCreate()` - Crear nueva entidad
- `useUpdate()` - Actualizar entidad existente
- `usePatch()` - Actualización parcial
- `useDelete()` - Eliminar entidad

**Ejemplo:**
```javascript
import { useEntity } from '../hooks/api';

function MyComponent() {
  const { useList, useDelete } = useEntity('servicios');
  const { data: servicios, isLoading } = useList();
  const deleteMutation = useDelete();
  
  // ...
}
```

### `useMetadata(modelName)`
Hook para obtener metadata de modelos Django.

**Parámetros:**
- `modelName` - Nombre del modelo (ej: 'servicio', 'cliente')
- `options` - Opciones adicionales de React Query

**Retorna:**
- `data` - Metadata del modelo (fields, verbose_name, etc.)
- `isLoading` - Estado de carga
- `error` - Error si ocurrió
- `refetch` - Función para refrescar

**Ejemplo:**
```javascript
import { useMetadata } from '../hooks/api';

function MyComponent() {
  const { data: metadata, isLoading } = useMetadata('servicio');
  
  if (isLoading) return <div>Cargando...</div>;
  
  return <div>{metadata.verbose_name}</div>;
}
```

### `useLookup(entityName)`
Hook para obtener datos de lookup (listas de opciones) desde el endpoint de lookup.

**Parámetros:**
- `entityName` - Nombre de la entidad o lookup custom (ej: 'redsocial', 'cliente', 'servicio')
- `options` - Opciones adicionales de React Query

**Retorna:**
- `data` - Array de arrays `[descripción, id]` (ej: `[["Red Social 1", 1], ["Red Social 2", 2]]`)
- `isLoading` - Estado de carga
- `error` - Error si ocurrió
- `refetch` - Función para refrescar

**Ejemplo:**
```javascript
import { useLookup } from '../hooks/api';

function MyComponent() {
  const { data: opciones, isLoading } = useLookup('redsocial');
  
  if (isLoading) return <div>Cargando...</div>;
  
  return (
    <select>
      {opciones?.map(([descripcion, id]) => (
        <option key={id} value={id}>{descripcion}</option>
      ))}
    </select>
  );
}
```

## Configuración

La configuración de React Query se encuentra en `src/lib/queryClient.js`.

## Caché

Todos los hooks utilizan el sistema de caché de React Query:
- **Entidades**: 5 minutos de stale time, 10 minutos en caché
- **Metadata**: 30 minutos de stale time, 1 hora en caché
- **Lookup**: 5 minutos de stale time, 30 minutos en caché
