import React from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { IMaskInput } from 'react-imask';
import PropTypes from 'prop-types';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import BaseTooltip from './BaseTooltip';

const BaseInput = ({ field, value, onChange, disabled, endAdornment, sx, error = false, errorMessage }) => {
    // Calcular ancho basado en el tipo de campo (lógica extraída de CRUDForm)
    const calculateWidth = () => {
        if (field.type === 'number' && field.maxDigits) {
            const calculatedWidth = Math.max(100, Math.min(300, field.maxDigits * 12 + 60));
            return `${calculatedWidth}px`;
        }
        if (field.maxLength) {
            const calculatedWidth = Math.max(150, Math.min(600, field.maxLength * 8 + 40));
            return `${calculatedWidth}px`;
        }
        return '100%';
    };

    const hasAdaptiveWidth = (field.type === 'number' && field.maxDigits) || field.maxLength;

    let inputType = 'text';
    if (field.type === 'number') inputType = 'number';
    else if (field.type === 'email') inputType = 'email';
    else if (field.type === 'password') inputType = 'password';

    const commonProps = {
        label: field.label,
        name: field.name,
        type: inputType,
        value: value ?? '',
        onChange: (e) => onChange(e.target.value),
        error,
        helperText: error ? errorMessage : undefined,
        required: field.required,
        disabled,
        fullWidth: !hasAdaptiveWidth,
        size: 'small',
        sx: {
            // width: hasAdaptiveWidth ? calculateWidth() : '100%',
            width: '100%',
            maxWidth: hasAdaptiveWidth ? calculateWidth() : '600px',
            '& .MuiInputBase-root': field.multiline ? { height: 'auto' } : {},
            ...sx,
        },
        slotProps: {
            htmlInput: {
                maxLength: field.type === 'number' ? undefined : field.maxLength,
                max: field.type === 'number' && field.maxDigits ? Math.pow(10, field.maxDigits) - 1 : undefined,
                min: field.type === 'number' && field.minValue !== undefined ? field.minValue : undefined,
            }
        }
    };

    const endAdornmentNode = endAdornment
        ? <InputAdornment position="end">{endAdornment}</InputAdornment>
        : undefined;
    const inputSlotProps = endAdornmentNode ? { input: { endAdornment: endAdornmentNode } } : {};

    // Memoizamos el componente de máscara para evitar que se recree en cada render,
    // lo que causaría un bucle infinito al desmontar/remontar el input.
    const maskOptionsStr = JSON.stringify(field.mask_options);
    const TextMaskCustom = React.useMemo(() => {
        if (!field.input_mask || field.input_mask === 'currency') return null;

        return React.forwardRef(function TextMaskCustom(props, ref) {
            const { onChange, ...other } = props;
            return (
                <IMaskInput
                    {...other}
                    mask={field.input_mask}
                    definitions={{
                        '9': /[0-9]/,
                    }}
                    inputRef={ref}
                    onAccept={(val) => onChange({ target: { name: props.name, value: val } })}
                    overwrite
                    {...(field.mask_options || {})}
                />
            );
        });
    }, [field.input_mask, maskOptionsStr]);

    if (field.type === 'date') {
        const handleDateChange = (dateValue) => {
            if (dateValue?.isValid()) {
                onChange(dateValue.format('YYYY-MM-DD'));
            } else {
                onChange(null);
            }
        };

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <BaseTooltip title={field.tooltip} wrap>
                    <DatePicker
                        value={value ? dayjs(value) : null}
                        onChange={handleDateChange}
                        label={field.label}
                        format="DD/MM/YYYY"
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: field.required,
                                error,
                                helperText: error ? errorMessage : undefined,
                                sx: {
                                    maxWidth: '135px',
                                },
                                InputLabelProps: {
                                    sx: {
                                        maxWidth: 'none !important',
                                        whiteSpace: 'nowrap',
                                    }
                                }
                            }
                        }}
                    />
                </BaseTooltip>
            </LocalizationProvider>
        );
    }

    if (field.type === 'datetime-local') {
        const handleDateTimeChange = (dateValue) => {
            if (dateValue?.isValid()) {
                onChange(dateValue.format('YYYY-MM-DDTHH:mm:ss'));
            } else {
                onChange(null);
            }
        };

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <BaseTooltip title={field.tooltip} wrap>
                    <DateTimePicker
                        value={value ? dayjs(value) : null}
                        onChange={handleDateTimeChange}
                        label={field.label}
                        format="DD/MM/YYYY HH:mm"
                        ampm={false}
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: field.required,
                                error,
                                helperText: error ? errorMessage : undefined,
                                sx: {
                                    maxWidth: '180px',
                                },
                                InputLabelProps: {
                                    sx: {
                                        maxWidth: 'none !important',
                                        whiteSpace: 'nowrap',
                                    }
                                }
                            }
                        }}
                    />
                </BaseTooltip>
            </LocalizationProvider>
        );
    }

    if (field.type === 'time') {
        const handleTimeChange = (timeValue) => {
            if (timeValue?.isValid()) {
                onChange(timeValue.format('HH:mm:ss'));
            } else {
                onChange(null);
            }
        };

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <BaseTooltip title={field.tooltip} wrap>
                    <TimePicker
                        value={value ? dayjs(value, 'HH:mm:ss') : null}
                        onChange={handleTimeChange}
                        label={field.label}
                        ampm={false}
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: field.required,
                                error,
                                helperText: error ? errorMessage : undefined,
                                sx: {
                                    maxWidth: '120px',
                                },
                                InputLabelProps: {
                                    sx: {
                                        maxWidth: 'none !important',
                                        whiteSpace: 'nowrap',
                                    }
                                }
                            }
                        }}
                    />
                </BaseTooltip>
            </LocalizationProvider>
        );
    }

    if (field.type === 'duration') {
        const handleDurationChange = (timeValue) => {
            if (timeValue?.isValid()) {
                onChange(timeValue.format('HH:mm:ss'));
            } else {
                onChange(null);
            }
        };

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <BaseTooltip title={field.tooltip} wrap>
                    <TimePicker
                        value={value ? dayjs(value, 'HH:mm:ss') : null}
                        onChange={handleDurationChange}
                        label={field.label}
                        ampm={false}
                        views={['hours', 'minutes']}
                        format="HH:mm"
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: field.required,
                                error,
                                helperText: error ? errorMessage : undefined,
                                sx: {
                                    maxWidth: '120px',
                                },
                                InputLabelProps: {
                                    sx: {
                                        maxWidth: 'none !important',
                                        whiteSpace: 'nowrap',
                                    }
                                }
                            }
                        }}
                    />
                </BaseTooltip>
            </LocalizationProvider>
        );
    }

    if (field.multiline) {
        return (
            <BaseTooltip title={field.tooltip}>
                <TextField
                    {...commonProps}
                    multiline
                    minRows={field.minRows || 1}
                    maxRows={field.rows || 2}
                    slotProps={{ ...commonProps.slotProps, ...inputSlotProps }}
                />
            </BaseTooltip>
        );
    }

    if (field.input_mask) {
        if (field.input_mask === 'currency') {
            return (
                <BaseTooltip title={field.tooltip}>
                    <TextField
                        {...commonProps}
                        slotProps={{ ...commonProps.slotProps, ...inputSlotProps }}
                    />
                </BaseTooltip>
            );
        }

        return (
            <BaseTooltip title={field.tooltip}>
                <TextField
                    {...commonProps}
                    slotProps={{
                        ...commonProps.slotProps,
                        input: {
                            inputComponent: TextMaskCustom,
                            ...(endAdornmentNode ? { endAdornment: endAdornmentNode } : {}),
                        },
                    }}
                />
            </BaseTooltip>
        );
    }

    return (
        <BaseTooltip title={field.tooltip}>
            <TextField
                {...commonProps}
                slotProps={{ ...commonProps.slotProps, ...inputSlotProps }}
            />
        </BaseTooltip>
    );
};

BaseInput.propTypes = {
    field: PropTypes.shape({
        name: PropTypes.string.isRequired,
        label: PropTypes.string,
        type: PropTypes.string,
        required: PropTypes.bool,
        multiline: PropTypes.bool,
        rows: PropTypes.number,
        maxLength: PropTypes.number,
        maxDigits: PropTypes.number,
        minValue: PropTypes.number,
        input_mask: PropTypes.string,
        mask_options: PropTypes.object,
        tooltip: PropTypes.string,
    }).isRequired,
    value: PropTypes.any,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    endAdornment: PropTypes.node,
    sx: PropTypes.object,
    error: PropTypes.bool,
    errorMessage: PropTypes.node,
};

export default BaseInput;
