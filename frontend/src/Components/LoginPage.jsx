import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GoogleIcon from '../assets/icons/GoogleIcon';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
 
export default function LoginPage() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="h4" fontWeight={700} color="primary">
        Makeup Agenda
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Ingresá con tu cuenta de Google para continuar
      </Typography>
      <Button
        variant="contained"
        size="large"
        startIcon={<GoogleIcon />}
        href={`${BACKEND_URL}/accounts/google/login/`}
        sx={{ textTransform: 'none', px: 4 }}
      >
        Continuar con Google
      </Button>
    </Box>
  );
}
