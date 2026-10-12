import * as React from 'react';
import PropTypes from 'prop-types';
import BaseInput from './BaseComponents/BaseInput';
import BaseSelect from './BaseComponents/BaseSelect';
import BaseAutocomplete from './BaseComponents/BaseAutocomplete';
import BaseCheckbox from './BaseComponents/BaseCheckbox';
import BaseCrudPageContainer from './BaseComponents/BaseCrudPageContainer';

export default function CRUDForm({ endpoint, modelName, title, fields, idParamName = 'id' }) {

    // Initialize form values
    const initialValues = React.useMemo(() => {
        const initial = {};
        fields.forEach(field => {
            if (field.type === 'boolean') {
                // Para booleanos, usar el defaultValue o false si no está definido
                initial[field.name] = field.defaultValue ?? false;
            } else {
                // Para otros tipos, usar defaultValue o string vacío
                initial[field.name] = field.defaultValue ?? '';
            }
        });
        return initial;
    }, [fields]);

    const prepareDataForSubmit = (values) => {
        const dataToSubmit = { ...values };
        fields.forEach(field => {
            // Convert empty strings to null for date fields
            if (["date"].includes(field.type) && dataToSubmit[field.name] === '') {
                dataToSubmit[field.name] = null;
            }
        });
        return dataToSubmit;
    };

    const additionalLabels = React.useMemo(() => {
        return fields.reduce((acc, field) => {
            acc[field.field || field.name] = field.label;
            return acc;
        }, {});
    }, [fields]);

    return (
        <BaseCrudPageContainer
            endpoint={endpoint}
            modelName={modelName}
            title={title}
            idParamName={idParamName}
            initialValues={initialValues}
            prepareDataForSubmit={prepareDataForSubmit}
            additionalLabels={additionalLabels}
        >
            {({ values, onChange }) => (
                <>
                    {fields.map((fieldAttributes) => {
                        if (fieldAttributes.type === 'boolean') {
                            return (
                                <BaseCheckbox
                                    key={fieldAttributes.name}
                                    field={fieldAttributes}
                                    value={values[fieldAttributes.name]}
                                    onChange={(value) => onChange(fieldAttributes.name, value)}
                                />
                            );
                        }

                        // Renderizar BaseSelect para campos con choices
                        else if (fieldAttributes.choices && fieldAttributes.choices.length > 0) {
                            return (
                                <BaseSelect
                                    key={fieldAttributes.name}
                                    field={fieldAttributes}
                                    value={values[fieldAttributes.name]}
                                    onChange={(value) => onChange(fieldAttributes.name, value)}
                                />
                            );
                        }
                        // Renderizar BaseAutocomplete para campos relacionados
                        else if (fieldAttributes.type === 'lookup') {
                            return (
                                <BaseAutocomplete
                                    key={fieldAttributes.name}
                                    field={fieldAttributes}
                                    value={values[fieldAttributes.name]}
                                    onChange={(value) => onChange(fieldAttributes.name, value)}
                                />
                            );
                        }

                        // Para el resto de campos (texto, números, multiline, etc.) usamos BaseInput
                        return (
                            <BaseInput
                                key={fieldAttributes.name}
                                field={fieldAttributes}
                                value={values[fieldAttributes.name]}
                                onChange={(value) => onChange(fieldAttributes.name, value)}
                            />
                        );
                    })}
                </>
            )}
        </BaseCrudPageContainer>
    );
}

CRUDForm.propTypes = {
    endpoint: PropTypes.string.isRequired,
    modelName: PropTypes.string,
    title: PropTypes.string.isRequired,
    fields: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['text', 'number', 'boolean', 'email', 'password', 'date', 'datetime', 'datetime-local', 'lookup']),
        required: PropTypes.bool,
        defaultValue: PropTypes.any,
        multiline: PropTypes.bool,
        rows: PropTypes.number,
        maxLength: PropTypes.number,
        maxDigits: PropTypes.number,
        minValue: PropTypes.number,
        choices: PropTypes.arrayOf(PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            display_name: PropTypes.string.isRequired,
        })),
    })).isRequired,
    idParamName: PropTypes.string,
};
