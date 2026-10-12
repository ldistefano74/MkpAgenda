import React, { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import PropTypes from 'prop-types';
import { useLookup } from '../../hooks/api';
import BaseTooltip from './BaseTooltip';

const BaseAutocomplete = ({ field, value, onChange, onSelectionChange, lookupName, filterParams = {}, disabled = false, freeSolo = false }) => {
    const [hovered, setHovered] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Use lookupName if provided, otherwise fall back to related_model
    const lookupSource = lookupName || field.related_model;

    // Use the useLookup hook with filter params support
    const { data: lookupData = [], isLoading, isError } = useLookup(
        lookupSource,
        { enabled: !!lookupSource },
        filterParams
    );

    // Transform lookup data based on freeSolo mode
    const options = useMemo(() => {
        if (freeSolo) {
            // For freeSolo, options are simple strings
            return lookupData;
        }
        // Standard mode: [description, id, ...extra] format to { id, label, ...extra }
        return lookupData.map(([description, id, ...extra]) => ({
            id,
            label: description,
            ...(extra.length > 0 && { extra }),
        }));
    }, [lookupData, freeSolo]);

    // Find the current selected object based on value (ID) - only for non-freeSolo mode
    const selectedOption = freeSolo ? (value || '') : (options.find(option => option.id === value) || null);

    // Calcular ancho basado en maxLength (similar a BaseInput)
    const calculateWidth = () => {
        if (field.maxLength) {
            const calculatedWidth = Math.max(150, Math.min(600, field.maxLength * 8 + 40));
            return `${calculatedWidth}px`;
        }
        return '300px';
    };

    // Props específicos para freeSolo vs standard mode
    const autocompleteProps = freeSolo
        ? {
            freeSolo: true,
            value: selectedOption,
            onChange: (event, newValue) => {
                onChange(newValue || '');
            },
            onInputChange: (event, newInputValue, reason) => {
                if (reason === 'input') {
                    onChange(newInputValue);
                }
            },
        }
        : {
            getOptionLabel: (option) => option.label || '',
            getOptionKey: (option) => option.id,
            isOptionEqualToValue: (option, val) => option.id === (typeof val === 'object' ? val?.id : val),
            value: selectedOption,
            onChange: (event, newValue) => {
                onChange(newValue ? newValue.id : null);
                if (onSelectionChange) {
                    onSelectionChange(newValue);
                }
            },
            filterOptions: (options, { inputValue }) => {
                const lower = inputValue.toLowerCase();
                return options.filter(option =>
                    option.label.toLowerCase().includes(lower) ||
                    option.extra?.some(e => String(e).toLowerCase().includes(lower))
                );
            },
            renderOption: ({ key, ...props }, option) => (
                <li key={key} {...props}>
                    {option.label}
                    {option.extra?.[0] && (
                        <span style={{ color: 'rgba(0,0,0,0.54)', fontSize: '0.75rem', marginLeft: '0.5em' }}>
                            ({option.extra[0]})
                        </span>
                    )}
                </li>
            ),
        };

    return (
        <BaseTooltip title={field.tooltip} wrap open={field.tooltip ? (hovered && !dropdownOpen) : undefined}>
            <Autocomplete
                id={field.name}
                options={options}
                {...autocompleteProps}
                loading={isLoading}
                disabled={disabled}
                onOpen={() => setDropdownOpen(true)}
                onClose={() => { setDropdownOpen(false); setHovered(false); }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                sx={{ width: calculateWidth(), maxWidth: '100%' }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={field.label}
                        required={field.required}
                        size="small"
                    />
                )}
            />
        </BaseTooltip>
    );
};

BaseAutocomplete.propTypes = {
    field: PropTypes.shape({
        name: PropTypes.string.isRequired,
        label: PropTypes.string,
        required: PropTypes.bool,
        related_model: PropTypes.string,
        maxLength: PropTypes.number,
        tooltip: PropTypes.string,
    }).isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func.isRequired,
    onSelectionChange: PropTypes.func,
    lookupName: PropTypes.string,
    filterParams: PropTypes.object,
    disabled: PropTypes.bool,
    freeSolo: PropTypes.bool, // Permite entrada de texto libre con sugerencias
};

export default BaseAutocomplete;
