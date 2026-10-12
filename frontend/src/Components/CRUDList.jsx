import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { useNavigate } from 'react-router';
import { useDialogs } from '../hooks/useDialogs/useDialogs';
import useNotifications from '../hooks/useNotifications/useNotifications';
import PageContainer from './Layout/PageContainer';
import BaseDataGrid from './BaseComponents/BaseDataGrid';
import { useEntity } from '../hooks/api/useEntity';

const INITIAL_PAGE_SIZE = 10;

export default function CRUDList({ crudEndpoint, crudTitle, gridColumns, initialSortModel, extraRowActions }) {
  const navigate = useNavigate();

  const dialogs = useDialogs();
  const notifications = useNotifications();

  const { useList, useDelete } = useEntity(crudEndpoint);
  const { data: rows = [], isLoading, error, refetch } = useList();
  const deleteMutation = useDelete();

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRowClick = React.useCallback(
    ({ row }) => {
      navigate(`/${crudEndpoint}/${row.id}/edit`);
    },
    [navigate, crudEndpoint],
  );

  const handleCreateClick = React.useCallback(() => {
    navigate(`/${crudEndpoint}/new`);
  }, [navigate, crudEndpoint]);

  const handleRowDelete = React.useCallback(
    (row) => async () => {
      const confirmed = await dialogs.confirm(
        `¿Confirma la eliminación del registro?`,
        {
          title: 'Eliminar registro',
          severity: 'error',
          okText: 'Eliminar',
          cancelText: 'Cancelar',
        },
      );

      if (confirmed) {
        try {
          await deleteMutation.mutateAsync(row.id);
          notifications.show('Registro eliminado correctamente.', {
            severity: 'success',
            autoHideDuration: 3000,
          });
        } catch (err) {
          notifications.show(
            <span style={{ whiteSpace: 'pre-line' }}>{err.message}</span>,
            {
              severity: 'error',
              autoHideDuration: 6000,
            },
          );
        }
      }
    },
    [dialogs, notifications, deleteMutation],
  );

  const handleDelete = React.useCallback(
    (row) => {
      handleRowDelete(row)();
    },
    [handleRowDelete],
  );

  return (
    <PageContainer
      title={crudTitle}
      // breadcrumbs={[{ title: crudTitle }]}
      actions={
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Recargar datos" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="refresh" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </div>
          </Tooltip>
          <Button
            variant="contained"
            onClick={handleCreateClick}
            startIcon={<AddIcon />}
          >
            Crear
          </Button>
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Box sx={{ flexGrow: 1 }}>
            <Alert severity="error">{error.message}</Alert>
          </Box>
        ) : (
          <BaseDataGrid
            rows={rows}
            columns={gridColumns}
            variant="page"
            onRowClick={handleRowClick}
            onDelete={handleDelete}
            loading={isLoading}
            initialPageSize={INITIAL_PAGE_SIZE}
            initialSortModel={initialSortModel}
            actionsColumnProps={extraRowActions ? { getActions: (params) => extraRowActions(params.row) } : {}}
          />
        )}
      </Box>
    </PageContainer>
  );
}
