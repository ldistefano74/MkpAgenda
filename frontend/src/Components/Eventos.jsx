import { GridActionsCellItem } from '@mui/x-data-grid';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { GenerateCRUDList } from "../lib/CRUDUtils";
import useNotifications from '../hooks/useNotifications/useNotifications';
import { openPresupuestoPdf } from '../lib/presupuesto';

function PresupuestoPdfAction({ row }) {
    const notifications = useNotifications();
    const handleClick = async (e) => {
        e.stopPropagation();
        try {
            await openPresupuestoPdf(row.id);
        } catch (err) {
            notifications.show(err.message, { severity: 'error' });
        }
    };
    return (
        <GridActionsCellItem
            icon={<PictureAsPdfIcon fontSize="small" />}
            label="Presupuesto PDF"
            onClick={handleClick}
            showInMenu={false}
        />
    );
}

export const EventosList = GenerateCRUDList("eventolistserializer", "eventos", {
    include: ['fecha', 'cliente_nombre', 'cliente_telefono', 'tipo_evento_nombre', 'estado_display', 'importe_total', 'saldo_a_cobrar'],
    extraRowActions: (row) => [
        <PresupuestoPdfAction key="presupuesto-pdf" row={row} />,
    ],
});

export { default as EventosEdit } from './EventoForm';
