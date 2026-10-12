import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import PageContainer from './Layout/PageContainer';
import BaseEditGrid from './BaseComponents/BaseEditGrid';
import BaseInput from './BaseComponents/BaseInput';
import { useQueryClient } from '@tanstack/react-query';
import { useEntity } from '../hooks/api/useEntity';
import useNotifications from '../hooks/useNotifications/useNotifications';
import apiClient from '../lib/apiClient';

const COLUMNS = [
    { field: 'clave', headerName: 'Clave', flex: 1, minWidth: 150 },
    { field: 'valor', headerName: 'Valor', flex: 2, minWidth: 200 },
    { field: 'descripcion', headerName: 'Descripción', flex: 2, minWidth: 200 },
];

const EMPTY_ITEM = () => ({ tempId: `new_${Date.now()}`, clave: '', valor: '', descripcion: '' });

export default function ConfigForm() {
    const queryClient = useQueryClient();
    const { useList } = useEntity('configuracion');
    const { data: serverData, isLoading } = useList({ refetchOnWindowFocus: false });
    const notifications = useNotifications();

    const [rows, setRows] = React.useState([]);
    const [isDirty, setIsDirty] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (serverData && !isDirty) {
            setRows(serverData);
        }
    }, [serverData, isDirty]);

    const handleRowsChange = (newRows) => {
        setRows(newRows);
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const cleanRows = rows.map(({ tempId, ...rest }) => rest);
            const result = await apiClient.post('/configuracion/bulk_update/', cleanRows);
            queryClient.setQueryData(['configuracion'], result);
            setRows(result);
            setIsDirty(false);
            notifications.show('Configuración guardada correctamente', { severity: 'success', autoHideDuration: 3000 });
        } catch (err) {
            notifications.show(`Error al guardar: ${err.message}`, { severity: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (serverData) {
            setRows(serverData);
            setIsDirty(false);
        }
    };

    return (
        <PageContainer title="Configuración">
            <Box sx={{ pb: 10, flex: 1 }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <BaseEditGrid
                        rows={rows}
                        columns={COLUMNS}
                        onRowsChange={handleRowsChange}
                        modalTitle="Configuración"
                        modalMaxWidth="sm"
                        getEmptyItem={EMPTY_ITEM}
                        getRowId={(row) => row.id ?? row.tempId}
                        isItemValid={(item) => Boolean(item.clave?.trim())}
                        density="standard"
                        variant="page"
                    >
                        {({ currentItem, setCurrentItem, isEditing }) => (
                            <>
                                <BaseInput
                                    field={{ name: 'clave', label: 'Clave', type: 'text', required: true }}
                                    value={currentItem.clave}
                                    onChange={(val) => setCurrentItem(prev => ({ ...prev, clave: val?.toUpperCase() }))}
                                    disabled={isEditing}
                                    inputProps={{ style: { textTransform: 'uppercase' } }}
                                />
                                <BaseInput
                                    field={{ name: 'valor', label: 'Valor', type: 'text', multiline: true, minRows: 3, rows: 10 }}
                                    value={currentItem.valor}
                                    onChange={(val) => setCurrentItem(prev => ({ ...prev, valor: val }))}
                                />
                                <BaseInput
                                    field={{ name: 'descripcion', label: 'Descripción', type: 'text', multiline: true, minRows: 2, rows: 6 }}
                                    value={currentItem.descripcion}
                                    onChange={(val) => setCurrentItem(prev => ({ ...prev, descripcion: val }))}
                                />
                            </>
                        )}
                    </BaseEditGrid>
                )}
            </Box>

            <Paper
                elevation={3}
                sx={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    py: 2,
                    px: 3,
                    mt: 2,
                    mx: -3,
                    mb: -3,
                    borderRadius: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1100,
                }}
            >
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button variant="outlined" onClick={handleCancel} disabled={isSaving || !isDirty}>
                        Cancelar
                    </Button>
                    <Button variant="contained" onClick={handleSave} disabled={isSaving || !isDirty}>
                        Guardar
                    </Button>
                </Stack>
            </Paper>
        </PageContainer>
    );
}
