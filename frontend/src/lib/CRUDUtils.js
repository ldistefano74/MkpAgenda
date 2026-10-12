
import React from 'react';
import CRUDList from "../Components/CRUDList";
import CRUDForm from "../Components/CRUDForm";
import { useMetadata } from "../hooks/api/useMetadata";

/**
 * Procesa un campo individual de metadata y retorna su definición
 * @param {Object} field - Objeto de campo de metadata
 * @returns {Object} Definición del campo procesada
 */
function processField(field) {
    // Transformar choices de tuplas de Django a objetos
    // Django devuelve: [["CF", "Consumidor Final"], ...]
    // Frontend necesita: [{value: "CF", display_name: "Consumidor Final"}, ...]
    let choices = null;
    if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
        choices = field.choices.map(choice => ({
            value: choice[0],
            display_name: choice[1]
        }));
    }

    const definition = {
        // Propiedades comunes
        field: field.name,      // Para DataGrid
        name: field.name,       // Para CRUDForm
        headerName: field.verbose_name, // Para DataGrid
        label: field.verbose_name,      // Para CRUDForm
        flex: 1,
        required: !field.blank && !field.null, // Para CRUDForm
        maxLength: field.max_length,
        defaultValue: field.default,  // Valor por defecto del modelo
        input_mask: field.input_mask, // Máscara de entrada
        mask_options: field.mask_options, // Opciones de la máscara
        choices: choices,
        related_model: field.related_model,
        tooltip: field.tooltip, // Texto de ayuda para mostrar en tooltip
    };

    // Si el campo tiene campos anidados (ReverseRelation, etc.), procesarlos recursivamente
    if (field.fields && Array.isArray(field.fields)) {
        definition.fields = field.fields.map(nestedField => processField(nestedField));
    }

    // Configurar tipo según el tipo de campo de Django
    switch (field.type) {
        case 'BooleanField':
            definition.type = 'boolean';
            definition.flex = 0.5;
            definition.defaultValue = field.default === true;
            break;
        case 'DecimalField':
        case 'IntegerField':
        case 'FloatField':
        case 'BigIntegerField':
            definition.type = 'number';
            // Para DecimalField y sus subclases, usar max_digits
            if (field.max_digits) {
                definition.maxDigits = field.max_digits;
            }
            if (field.decimal_places !== undefined) {
                definition.decimalPlaces = field.decimal_places;
            }
            break;
        case 'DateField':
            definition.type = 'date';
            definition.valueGetter = (value) => value ? new Date(value) : null;
            definition.valueFormatter = (value) => {
                if (!value) return '';
                const date = value instanceof Date ? value : new Date(value);
                return date.toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            };
            break;
        case 'DateTimeField':
            definition.type = 'datetime-local';
            definition.valueGetter = (value) => value ? new Date(value) : null;
            definition.valueFormatter = (value) => {
                if (!value) return '';
                const date = value instanceof Date ? value : new Date(value);
                return date.toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            };
            break;
        case 'TimeField':
            definition.type = 'time';
            break;
        case 'DurationField':
            definition.type = 'duration';
            break;
        case 'TextField':
            definition.type = 'text';
            definition.multiline = true; // Para CRUDForm
            definition.flex = 2;
            break;
        case 'EmailField':
            definition.type = 'email'; // Para CRUDForm (si lo soporta) o text
            definition.flex = 1.5;
            break;
        case 'URLField':
            definition.type = 'url';
            definition.flex = 1.5;
            break;
        case 'ForeignKey':
            definition.type = 'lookup';
            definition.flex = 2;
            definition.maxLength = 50;
            break;
        case 'ReverseRelation':
            definition.type = 'nested';
            definition.flex = 2;
            break;
        default:
            // CharField, etc.
            definition.type = 'text';
            definition.flex = 2;
    }

    return definition;
}

// Anchos mínimos por defecto según tipo de campo (en píxeles)
const DEFAULT_MIN_WIDTHS = {
    boolean: 80,
    number: 100,
    date: 110,
    'datetime-local': 150,
    time: 90,
    duration: 100,
    email: 180,
    url: 200,
    lookup: 150,
    nested: 200,
    text: 120,
};

// Píxeles por caracter para calcular minWidth basado en maxLength
const CHAR_WIDTH_PX = 8;

/**
 * Procesa las columnas para uso en DataGrid, agregando minWidth basado en maxLength.
 * El minWidth se calcula como el 75% del maxLength * CHAR_WIDTH_PX.
 *
 * @param {Array} columns - Array de definiciones de columnas
 * @returns {Array} Columnas con minWidth calculado
 */
export function processColumnsForGrid(columns, overrides = {}) {
    return columns.map(col => {
        const processed = { ...col };

        if (col.maxLength) {
            // 75% del maxLength convertido a píxeles
            processed.minWidth = Math.round(col.maxLength * 0.75 * CHAR_WIDTH_PX);
        } else {
            // Usar ancho mínimo por defecto según tipo
            processed.minWidth = DEFAULT_MIN_WIDTHS[col.type] || DEFAULT_MIN_WIDTHS.text;
        }

        if (overrides[col.field]) {
            Object.assign(processed, overrides[col.field]);
        }

        return processed;
    });
}

/**
 * Genera definiciones de campos basadas en la metadata del modelo de Django.
 * Estas definiciones son compatibles tanto con DataGrid (columnas) como con CRUDForm (campos).
 *
 * @param {Object} metadata - Objeto de metadata obtenido del backend.
 * @param {Object} options - Opciones de filtrado.
 * @param {string[]} [options.include] - Lista de nombres de campos a incluir. Si se especifica, solo estos campos se incluirán.
 * @param {string[]} [options.exclude] - Lista de nombres de campos a excluir. Ignorado si 'include' está presente.
 * @returns {Array} Array de definiciones de campos.
 */
export function generateFieldsList(metadata, options = {}) {
    if (!metadata?.fields) {
        return [];
    }

    let fields = metadata.fields;

    // Filtrar campos
    if (options.include && options.include.length > 0) {
        // Si hay 'include', filtramos y ordenamos según el orden de 'include'
        fields = options.include
            .map(name => metadata.fields.find(f => f.name === name))
            .filter(f => f !== undefined);
    } else if (options.exclude && options.exclude.length > 0) {
        // Si hay 'exclude', filtramos los que estén en la lista
        fields = fields.filter(field => !options.exclude.includes(field.name));
    }

    // Mapear a definición unificada usando processField recursivamente
    return fields.map(field => processField(field));
}

/**
 * Genera un componente de Lista CRUD para un modelo dado.
 * @param {string} modelName - Nombre del modelo (ej: 'servicio').
 * @param {Object} fieldOptions - Opciones para filtrar campos (include/exclude).
 * @param {string} [endpoint] - Endpoint opcional (por defecto usa el plural del modelo o modelName + 's').
 * @returns {React.Component} Componente de Lista.
 */
export function GenerateCRUDList(modelName, endpoint, fieldOptions) {
    const { initialSortModel, columnOverrides, extraRowActions, ...filterOptions } = fieldOptions || {};
    return function GeneratedCRUDList() {
        const { data: metadata, isLoading } = useMetadata(modelName);

        const columns = React.useMemo(() => {
            if (!metadata) return [];
            const fields = generateFieldsList(metadata, filterOptions);
            return processColumnsForGrid(fields, columnOverrides);
        }, [metadata]);

        if (isLoading || !metadata) return null;

        return <CRUDList
            crudEndpoint={endpoint}
            crudTitle={metadata.plural_name}
            gridColumns={columns}
            initialSortModel={initialSortModel}
            extraRowActions={extraRowActions}
        />;
    };
}

/**
 * Genera un componente de Edición/Creación CRUD para un modelo dado.
 * @param {string} modelName - Nombre del modelo.
 * @param {Object} fieldOptions - Opciones para filtrar campos.
 * @param {string} [idParamName] - Nombre del parámetro de ID en la URL.
 * @param {string} [endpoint] - Endpoint opcional.
 * @returns {React.Component} Componente de Formulario.
 */
export function GenerateCRUDEdit(modelName, endpoint, fieldOptions, idParamName) {
    return function GeneratedCRUDEdit() {
        const { data: metadata, isLoading } = useMetadata(modelName);

        const fields = React.useMemo(() => {
            if (!metadata) return [];
            return generateFieldsList(metadata, fieldOptions);
        }, [metadata]);

        if (isLoading || !metadata) {
            return <div>Cargando...</div>;
        }

        return (
            <CRUDForm
                endpoint={endpoint}
                modelName={modelName}
                title={metadata.model}
                fields={fields}
                idParamName={idParamName}
            />
        );
    };
}

/**
 * Parsea recursivamente los valores de error (pueden ser strings, arrays u objetos)
 * @param {any} value - El valor del error a parsear
 * @param {Function} getLabel - Función opcional para obtener un label amigable dado un key
 * @returns {string} Mensaje de error formateado
 */
export const parseErrorValue = (value, getLabel = (k) => k) => {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === 'object' && item !== null) {
                return Object.entries(item)
                    .map(([k, v]) => {
                        const label = getLabel(k);
                        return `${label}: ${parseErrorValue(v, getLabel)}`;
                    })
                    .join(', ');
            }
            return String(item);
        }).join(' ');
    }

    if (typeof value === 'object' && value !== null) {
        return Object.entries(value)
            .map(([k, v]) => {
                const label = getLabel(k);
                return `${label}: ${parseErrorValue(v, getLabel)}`;
            })
            .join(', ');
    }

    return String(value);
};
