import { useState } from 'react';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import PropTypes from 'prop-types';
import BaseTooltip from './BaseTooltip';

const BaseSelect = ({ field, value, onChange, disabled }) => {
    const [hovered, setHovered] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    // Calcular ancho basado en la opción más larga de choices
    const calculateWidth = () => {
        if (field.choices && field.choices.length > 0) {
            // Encontrar la opción con el texto más largo
            const longestOption = field.choices.reduce((longest, current) => {
                return current.display_name.length > longest.length
                    ? current.display_name
                    : longest;
            }, '');

            // Calcular ancho: ~8px por carácter + 30px de padding/icono
            const calculatedWidth = Math.max(80, Math.min(600, longestOption.length * 8 + 30));
            return `${calculatedWidth}px`;
        }
        return '150px'; // Ancho mínimo por defecto
    };


    const width = calculateWidth();

    return (
        <BaseTooltip title={field.tooltip} wrap open={field.tooltip ? (hovered && !dropdownOpen) : undefined}>
            <FormControl
                size="small"
                required={field.required}
                disabled={disabled}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                sx={{
                    width,
                    maxWidth: width,
                }}
            >
                <InputLabel id={`${field.name}-label`}>{field.label}</InputLabel>
                <Select
                    labelId={`${field.name}-label`}
                    id={field.name}
                    name={field.name}
                    value={value ?? ''}
                    label={field.label}
                    onChange={(e) => onChange(e.target.value)}
                    onOpen={() => setDropdownOpen(true)}
                    onClose={() => { setDropdownOpen(false); setHovered(false); }}
                    sx={{
                        backgroundColor: 'background.default',
                    }}
                >
                    {field.choices && field.choices.map((choice) => (
                        <MenuItem key={choice.value} value={choice.value}>
                            {choice.display_name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </BaseTooltip>
    );
};

BaseSelect.propTypes = {
    field: PropTypes.shape({
        name: PropTypes.string.isRequired,
        label: PropTypes.string,
        required: PropTypes.bool,
        maxLength: PropTypes.number,
        tooltip: PropTypes.string,
        choices: PropTypes.arrayOf(PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            display_name: PropTypes.string.isRequired,
        })).isRequired,
    }).isRequired,
    value: PropTypes.any,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default BaseSelect;
