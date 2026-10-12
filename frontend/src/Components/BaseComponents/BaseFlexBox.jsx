import Box from '@mui/material/Box';

/**
 * BaseFlexBox - Contenedor flex con defaults comunes para formularios.
 *
 * Defaults:
 * - display: flex
 * - gap: 2 (16px)
 * - flexWrap: wrap
 * - alignItems: flex-start
 * - maxWidth: 100%
 */
export default function BaseFlexBox({ children, sx, ...props }) {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                maxWidth: '100%',
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
}
