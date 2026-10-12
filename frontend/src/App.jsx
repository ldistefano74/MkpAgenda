
import CrudDashboard from "./CrudDashboard";
import { createHashRouter, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './Components/LoginPage';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import DashboardLayout from './Components/Layout/DashboardLayout';
import { ServiciosList, ServiciosEdit } from './Components/Servicios';
import { RedesSocialesList, RedesSocialesEdit } from './Components/RedesSociales';
import { TipoEventoList, TipoEventoEdit } from './Components/TiposEvento';
import { ClientesList, ClientesEdit } from './Components/Clientes';
import { FuentesContactoList, FuentesContactoEdit } from './Components/FuentesContacto';
import { MediosPagoCobroList, MediosPagoCobroEdit } from './Components/MediosPagoCobro';
import { PrestadoresList, PrestadoresEdit } from './Components/Prestadores';
import { EventosList, EventosEdit } from './Components/Eventos';
import { ProveedoresList, ProveedoresEdit } from './Components/Proveedores';
import { CategoriasCostoList, CategoriasCostoEdit } from './Components/CategoriasCosto';
import { CostosRecurrentesList, CostosRecurrentesEdit } from './Components/CostosRecurrentes';
import { CostosList, CostosEdit } from './Components/Costos';
import CalendarioPage from './Components/Calendario/CalendarioPage';
import MainDashboard from './Components/Dashboard/MainDashboard';
import ConfigForm from './Components/ConfigForm';
import MovimientosReport from './Components/Reports/MovimientosReport';
import ResultadosReport from './Components/Reports/ResultadosReport';

const router = createHashRouter([
  {
    Component: DashboardLayout,
    children: [
      { path: '/maindashboard', Component: MainDashboard },
      { path: '/servicios', Component: ServiciosList },
      { path: '/servicios/new', Component: ServiciosEdit },
      { path: '/servicios/:id/edit', Component: ServiciosEdit },
      { path: '/redes', Component: RedesSocialesList },
      { path: '/redes/new', Component: RedesSocialesEdit },
      { path: '/redes/:id/edit', Component: RedesSocialesEdit },
      { path: '/tiposevento', Component: TipoEventoList },
      { path: '/tiposevento/new', Component: TipoEventoEdit },
      { path: '/tiposevento/:id/edit', Component: TipoEventoEdit },
      { path: '/clientes', Component: ClientesList },
      { path: '/clientes/new', Component: ClientesEdit },
      { path: '/clientes/:id/edit', Component: ClientesEdit },
      { path: '/fuentescontacto', Component: FuentesContactoList },
      { path: '/fuentescontacto/new', Component: FuentesContactoEdit },
      { path: '/fuentescontacto/:id/edit', Component: FuentesContactoEdit },
      { path: '/mediospagocobro', Component: MediosPagoCobroList },
      { path: '/mediospagocobro/new', Component: MediosPagoCobroEdit },
      { path: '/mediospagocobro/:id/edit', Component: MediosPagoCobroEdit },
      { path: '/prestadores', Component: PrestadoresList },
      { path: '/prestadores/new', Component: PrestadoresEdit },
      { path: '/prestadores/:id/edit', Component: PrestadoresEdit },
      { path: '/eventos', Component: EventosList },
      { path: '/eventos/new', Component: EventosEdit },
      { path: '/eventos/:id/edit', Component: EventosEdit },
      { path: '/proveedores', Component: ProveedoresList },
      { path: '/proveedores/new', Component: ProveedoresEdit },
      { path: '/proveedores/:id/edit', Component: ProveedoresEdit },
      { path: '/categoriascosto', Component: CategoriasCostoList },
      { path: '/categoriascosto/new', Component: CategoriasCostoEdit },
      { path: '/categoriascosto/:id/edit', Component: CategoriasCostoEdit },
      { path: '/costosrecurrentes', Component: CostosRecurrentesList },
      { path: '/costosrecurrentes/new', Component: CostosRecurrentesEdit },
      { path: '/costosrecurrentes/:id/edit', Component: CostosRecurrentesEdit },
      { path: '/costos', Component: CostosList },
      { path: '/costos/new', Component: CostosEdit },
      { path: '/costos/:id/edit', Component: CostosEdit },
      { path: '/configuracion', Component: ConfigForm },
      { path: '/reportes/movimientos', Component: MovimientosReport },
      { path: '/reportes/resultados', Component: ResultadosReport },
      { path: '/calendario', Component: CalendarioPage },
      { path: '*', Component: MainDashboard },
    ],
  },
]);

function AppContent() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <CrudDashboard>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </CrudDashboard>
  );
}
