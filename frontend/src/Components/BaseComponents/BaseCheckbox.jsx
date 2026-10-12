import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import PropTypes from 'prop-types';
import BaseTooltip from './BaseTooltip';

const BaseCheckbox = ({ field, value, onChange, disabled = false }) => {
    return (
        <BaseTooltip title={field?.tooltip}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={Boolean(value)}
                        onChange={(e) => onChange(e.target.checked)}
                        disabled={disabled}
                    />
                }
                label={field?.label || field?.name || ''}
                sx={{ width: 'fit-content' }}
            />
        </BaseTooltip>
    );
};

BaseCheckbox.propTypes = {
    field: PropTypes.shape({
        name: PropTypes.string,
        label: PropTypes.string,
        tooltip: PropTypes.string,
    }),
    value: PropTypes.any,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default BaseCheckbox;
