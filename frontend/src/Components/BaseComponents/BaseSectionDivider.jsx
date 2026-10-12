import React from 'react';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import PropTypes from 'prop-types';

/**
 * BaseSectionDivider - Un divisor de sección estandarizado con título
 * 
 * @param {string} label - El texto a mostrar
 * @param {number|string} mt - Margen superior (por defecto 3)
 * @param {number|string} mb - Margen inferior del divisor (por defecto 2)
 */
const BaseSectionDivider = ({ label, mt = 3, mb = 0 }) => {
    return (
        <Box sx={{ mt }}>
            <Typography variant="h6" gutterBottom>
                {label}
            </Typography>
            <Divider sx={{ mb }} />
        </Box>
    );
};

BaseSectionDivider.propTypes = {
    label: PropTypes.string.isRequired,
    mt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    mb: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default BaseSectionDivider;
