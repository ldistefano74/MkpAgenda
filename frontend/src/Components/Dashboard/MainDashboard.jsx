import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import PageContainer from '../Layout/PageContainer';
import BaseSelect from '../BaseComponents/BaseSelect';
import EventosCarousel from './EventosCarousel';
import CobrosDashboard from './CobrosDashboard';
import PagosDashboard from './PagosDashboard';
import CostosRecurrentesDashboard from './CostosRecurrentesDashboard';
import apiClient from '../../lib/apiClient';

const DIAS_CHOICES = [
    { value: 7, display_name: 'Una semana' },
    { value: 15, display_name: 'Quince días' },
    { value: 30, display_name: 'Un mes' },
    { value: 180, display_name: 'Seis meses' },
    { value: 365, display_name: 'Un año' },
];

const DIAS_FIELD = {
    name: 'dias_dashboard',
    choices: DIAS_CHOICES,
};

export default function MainDashboard() {
    const [dias, setDias] = useState(7);

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => apiClient.get('/dashboard/'),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today.getTime() + dias * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const diasLabel = DIAS_CHOICES.find((c) => c.value === dias)?.display_name ?? '';

    return (
        <PageContainer title="Dashboard Principal">
            <Stack spacing={3}>
                {/* Carrusel de eventos próximos */}
                <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6">Próximos eventos confirmados</Typography>
                        <BaseSelect field={DIAS_FIELD} value={dias} onChange={setDias} />
                    </Box>
                    <EventosCarousel
                        queryKey={['eventos', 'carousel', todayStr, endStr]}
                        queryFn={() => apiClient.get(`/eventos/?fecha_desde=${todayStr}&fecha_hasta=${endStr}&estado=C`)}
                        emptyMessage={`No hay eventos confirmados para ${diasLabel.toLowerCase()}`}
                    />
                </Stack>

                {/* Carrusel de eventos pendientes de confirmación */}
                <Stack spacing={1}>
                    <Typography variant="h6">Pendientes de confirmación</Typography>
                    <EventosCarousel
                        queryKey={['eventos', 'pendientes', todayStr, endStr]}
                        queryFn={() => apiClient.get(`/eventos/?fecha_desde=${todayStr}&fecha_hasta=${endStr}&estado=P`)}
                        emptyMessage="No hay eventos pendientes de confirmación"
                        showRecordatorio={false}
                    />
                </Stack>

                <Divider />

                {/* Finanzas */}
                {isLoading ? (
                    <Stack spacing={2}>
                        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
                        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <CobrosDashboard cobros={data?.cobros} />
                        <PagosDashboard pagos={data?.pagos} />
                        <CostosRecurrentesDashboard />
                    </Stack>
                )}
            </Stack>
        </PageContainer>
    );
}
