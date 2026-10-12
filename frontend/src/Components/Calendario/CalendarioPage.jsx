import { useState, useCallback } from 'react';
import CardCalendario from './CardCalendario';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageContainer from '../Layout/PageContainer';
import { useEntity } from '../../hooks/api/useEntity';
import apiClient from '../../lib/apiClient';
import useNotifications from '../../hooks/useNotifications/useNotifications';

// Valores del gray palette del theme (themePrimitives.js)
const g = {
  50:  'hsl(220, 35%, 97%)',
  100: 'hsl(220, 30%, 94%)',
  200: 'hsl(220, 20%, 88%)',
  600: 'hsl(220, 20%, 35%)',
  700: 'hsl(220, 20%, 25%)',
  800: 'hsl(220, 30%, 6%)',
  900: 'hsl(220, 35%, 3%)',
};

// Estilos CSS que sobreescriben los botones del toolbar de FullCalendar
// para que sean consistentes con los botones MUI del proyecto.
const fcButtonSx = {
  // ── Botón base (inactivo) → igual que MuiButton contained primary ──
  '& .fc .fc-button-primary': {
    backgroundColor: g[900],
    backgroundImage: `linear-gradient(to bottom, ${g[700]}, ${g[800]})`,
    boxShadow: `inset 0 1px 0 ${g[600]}, inset 0 -1px 0 1px hsl(220, 0%, 0%)`,
    border: `1px solid ${g[700]}`,
    color: 'white',
    textTransform: 'none',
    borderRadius: (theme) => `${theme.shape.borderRadius}px`,
    '&:hover': {
      backgroundImage: 'none',
      backgroundColor: g[700],
      boxShadow: 'none',
    },
    '&:focus': {
      boxShadow: `inset 0 1px 0 ${g[600]}, inset 0 -1px 0 1px hsl(220, 0%, 0%)`,
      outline: 'none',
    },
  },
  // ── Botón activo (período seleccionado) → igual que MuiButton outlined primary ──
  '& .fc .fc-event': {
    cursor: 'pointer',
  },
  // ── Botón activo (período seleccionado) → igual que MuiButton outlined primary ──
  '& .fc .fc-button-primary:not(:disabled).fc-button-active': {
    backgroundImage: 'none',
    backgroundColor: g[100],
    border: `1px solid ${g[200]}`,
    color: g[900],
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: g[200],
      borderColor: g[200],
    },
    '&:focus': {
      boxShadow: 'none',
      outline: 'none',
    },
  },
};

/**
 * Parsea el formato de DurationField de DRF: "H:MM:SS" o "D day(s), H:MM:SS"
 * Retorna la duración en milisegundos, o null si no es válida.
 */
function parseDurationMs(str) {
  if (!str) return null;
  let seconds = 0;
  const dayMatch = str.match(/^(\d+) days?,\s*/);
  if (dayMatch) {
    seconds += parseInt(dayMatch[1], 10) * 86400;
    str = str.slice(dayMatch[0].length);
  }
  const parts = str.split(':');
  if (parts.length === 3) {
    seconds += parseInt(parts[0], 10) * 3600;
    seconds += parseInt(parts[1], 10) * 60;
    seconds += parseFloat(parts[2]);
  }
  return seconds > 0 ? seconds * 1000 : null;
}

// Color por estado del evento
export const ESTADO_COLORS = {
  C: '#1976d2', // Confirmado → azul
  P: '#ed6c02', // Pendiente  → naranja
  X: '#9e9e9e', // Cancelado  → gris
};

export const ESTADO_LABELS = {
  C: 'Confirmado',
  P: 'Pendiente',
  X: 'Cancelado',
};

/**
 * Transforma un Evento (EventoListSerializer) al formato de evento de FullCalendar.
 *
 * Campos de EventoListSerializer usados:
 *   id, fecha, duracion, direccion_servicios,
 *   cliente, cliente_nombre, tipo_evento_nombre,
 *   estado, importe_total, saldo_a_cobrar
 *
 * Campos de FullCalendar producidos:
 *   id       → identificador único (string)
 *   title    → texto visible en el bloque del evento
 *   start    → ISO datetime de inicio (= fecha)
 *   end      → ISO datetime de fin (calculado con duracion, si existe)
 *   backgroundColor / borderColor → azul (C), naranja (P), gris (X)
 *   extendedProps → datos extra disponibles para futuras hover-cards
 */
function eventoToFCEvent(evento) {
  const startMs = new Date(evento.fecha).getTime();
  const durationMs = parseDurationMs(evento.duracion);
  const end = durationMs ? new Date(startMs + durationMs).toISOString() : null;
  const color = ESTADO_COLORS[evento.estado] ?? ESTADO_COLORS.P;

  return {
    id: String(evento.id),
    title: `${evento.tipo_evento_nombre} — ${evento.cliente_nombre}`,
    start: evento.fecha,
    ...(end ? { end } : {}),
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      cliente: evento.cliente,
      cliente_nombre: evento.cliente_nombre,
      cliente_telefono: evento.cliente_telefono,
      tipo_evento_nombre: evento.tipo_evento_nombre,
      estado: evento.estado,
      importe_total: evento.importe_total,
      saldo_a_cobrar: evento.saldo_a_cobrar,
      direccion_servicios: evento.direccion_servicios,
    },
  };
}

export default function CalendarioPage() {
  const { useList } = useEntity('eventos');
  const [dateRange, setDateRange] = useState(null);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const queryClient = useQueryClient();
  const notifications = useNotifications();

  const handleEventClick = useCallback(({ event, el }) => {
    setPopoverAnchor(el);
    setSelectedEvent({ id: event.id, ...event.extendedProps });
  }, []);

  const handleClose = useCallback(() => {
    setPopoverAnchor(null);
    setSelectedEvent(null);
  }, []);

  const { data: eventos = [] } = useList({
    queryKey: ['eventos', dateRange?.start, dateRange?.end],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.start) params.set('fecha_desde', dateRange.start);
      if (dateRange?.end)   params.set('fecha_hasta', dateRange.end);
      return apiClient.get(`/eventos/?${params}`);
    },
    enabled: !!dateRange,
  });

  const { data: gcalStatus } = useQuery({
    queryKey: ['gcal-status'],
    queryFn: () => apiClient.get('/google-calendar/status/'),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/google-calendar/sync/'),
    onSuccess: ({ synced, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] });
      if (errors?.length) {
        const detalle = errors.length === 1
          ? errors[0].error
          : `${errors.length} errores — primer error: ${errors[0].error}`;
        notifications.show(`${synced} sincronizado(s). Error: ${detalle}`, { severity: 'warning', autoHideDuration: 8000 });
      } else {
        notifications.show(`${synced} evento(s) sincronizado(s) con Google Calendar`, { severity: 'success', autoHideDuration: 3000 });
      }
    },
    onError: (err) => {
      notifications.show(`Error al sincronizar: ${err.message}`, { severity: 'error' });
    },
  });

  const fcEvents = eventos.map(eventoToFCEvent);

  return (
    <PageContainer title="Calendario">
      <Box sx={{ flex: 1, minHeight: 0, ...fcButtonSx }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={esLocale}
        height="100%"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
          day: 'Día',
          list: 'Lista',
        }}
        events={fcEvents}
        datesSet={({ startStr, endStr }) => setDateRange({ start: startStr.slice(0, 10), end: endStr.slice(0, 10) })}
        eventClick={handleEventClick}
        scrollTime="11:00:00"
        allDaySlot={false}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
      />
      </Box>
      {gcalStatus?.pending > 0 && (
        <Alert
          severity="info"
          sx={{ mt: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </Button>
          }
        >
          {gcalStatus.pending} evento(s) sin sincronizar con Google Calendar
        </Alert>
      )}
      <CardCalendario
        anchor={popoverAnchor}
        eventoId={selectedEvent?.id}
        staticProps={selectedEvent}
        onClose={handleClose}
      />
    </PageContainer>
  );
}
