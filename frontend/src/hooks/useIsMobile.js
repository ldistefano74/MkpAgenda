import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Hook para detectar si el dispositivo es móvil basado en el breakpoint 'sm' de MUI.
 * @returns {boolean} true si el ancho de pantalla es menor al breakpoint 'sm'
 */
export default function useIsMobile() {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down('sm'));
}
