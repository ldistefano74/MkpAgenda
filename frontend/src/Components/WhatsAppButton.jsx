import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { buildWhatsAppUrl } from '../lib/phoneUtils';

export default function WhatsAppButton({ phone, sx }) {
    const url = phone ? buildWhatsAppUrl(phone) : null;
    if (!url) return null;

    return (
        <Tooltip title="Abrir en WhatsApp">
            <IconButton
                component="a"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#25D366', ...sx }}
                size="small"
            >
                <WhatsAppIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}
