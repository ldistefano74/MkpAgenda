import * as React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Toolbar from '@mui/material/Toolbar';

import PersonIcon from '@mui/icons-material/Person';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EventIcon from '@mui/icons-material/Event';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CategoryIcon from '@mui/icons-material/Category';
import RepeatIcon from '@mui/icons-material/Repeat';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { matchPath, useLocation } from 'react-router';
import DashboardSidebarContext from '../../context/DashboardSidebarContext';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from '../../constants';
import DashboardSidebarPageItem from './DashboardSidebarPageItem';
import DashboardSidebarHeaderItem from './DashboardSidebarHeaderItem';
import DashboardSidebarDividerItem from './DashboardSidebarDividerItem';
import {
  getDrawerSxTransitionMixin,
  getDrawerWidthTransitionMixin,
} from '../../mixins';


function DashboardSidebar({
  expanded = true,
  setExpanded,
  disableCollapsibleSidebar = false,
  container,
}) {
  const theme = useTheme();

  const { pathname } = useLocation();

  const isOverSmViewport = useMediaQuery(theme.breakpoints.up('sm'));
  const isOverMdViewport = useMediaQuery(theme.breakpoints.up('md'));

  const [isFullyExpanded, setIsFullyExpanded] = React.useState(expanded);
  const [isFullyCollapsed, setIsFullyCollapsed] = React.useState(!expanded);

  // Cuando el drawer temporal abre, MUI aplica aria-hidden al resto del DOM.
  // Si un elemento externo (e.g. un botón de FullCalendar) tiene foco en ese
  // instante, el navegador emite un warning de aria-hidden sobre elemento enfocado.
  // Blurring preventivo elimina el conflicto sin alterar el comportamiento de MUI.
  React.useEffect(() => {
    if (expanded && document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }, [expanded]);

  React.useEffect(() => {
    if (expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyExpanded(true);
      }, theme.transitions.duration.enteringScreen);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyExpanded(false);

    return () => { };
  }, [expanded, theme.transitions.duration.enteringScreen]);

  React.useEffect(() => {
    if (!expanded) {
      const drawerWidthTransitionTimeout = setTimeout(() => {
        setIsFullyCollapsed(true);
      }, theme.transitions.duration.leavingScreen);

      return () => clearTimeout(drawerWidthTransitionTimeout);
    }

    setIsFullyCollapsed(false);

    return () => { };
  }, [expanded, theme.transitions.duration.leavingScreen]);

  const mini = !disableCollapsibleSidebar && !expanded;

  const handleSetSidebarExpanded = React.useCallback(
    (newExpanded) => () => {
      setExpanded(newExpanded);
    },
    [setExpanded],
  );

  const handlePageItemClick = React.useCallback(
    (_itemId, hasNestedNavigation) => {
      if (!isOverSmViewport && !hasNestedNavigation) {
        setExpanded(false);
      }
    },
    [setExpanded, isOverSmViewport],
  );

  const hasDrawerTransitions =
    isOverSmViewport && (!disableCollapsibleSidebar || isOverMdViewport);

  const getDrawerContent = React.useCallback(
    (viewport) => (
      <React.Fragment>
        <Toolbar />
        <Box
          component="nav"
          aria-label={`${viewport.charAt(0).toUpperCase()}${viewport.slice(1)}`}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'auto',
            scrollbarGutter: mini ? 'stable' : 'auto',
            overflowX: 'hidden',
            pt: !mini ? 0 : 2,
            ...(hasDrawerTransitions
              ? getDrawerSxTransitionMixin(isFullyExpanded, 'padding')
              : {}),
          }}
        >
          <List
            dense
            sx={{
              padding: mini ? 0 : 0.5,
              mb: 4,
              width: mini ? MINI_DRAWER_WIDTH : 'auto',
            }}
          >
            {/* <DashboardSidebarHeaderItem>Main items</DashboardSidebarHeaderItem> */}
            <DashboardSidebarPageItem
              id="mainDashboard"
              title="Dashboard"
              icon={<DashboardIcon />}
              href="/maindashboard"
              selected={!!matchPath('/maindashboard', pathname) || pathname === '/'}
            />
            <DashboardSidebarPageItem
              id="calendario"
              title="Calendario"
              icon={<CalendarMonthIcon />}
              href="/calendario"
              selected={!!matchPath('/calendario', pathname)}
            />
            <DashboardSidebarPageItem
              id="eventos"
              title="Eventos"
              icon={<EventIcon />}
              href="/eventos"
              selected={!!matchPath('/eventos/*', pathname)}
            />
            <DashboardSidebarDividerItem />
            <DashboardSidebarHeaderItem>Costos</DashboardSidebarHeaderItem>
            <DashboardSidebarPageItem
              id="costos"
              title="Costos"
              icon={<ReceiptLongIcon />}
              href="/costos"
              selected={!!matchPath('/costos/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="categoriascosto"
              title="Categorías de Costo"
              icon={<CategoryIcon />}
              href="/categoriascosto"
              selected={!!matchPath('/categoriascosto/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="costosrecurrentes"
              title="Costos Recurrentes"
              icon={<RepeatIcon />}
              href="/costosrecurrentes"
              selected={!!matchPath('/costosrecurrentes/*', pathname)}
            />
            <DashboardSidebarDividerItem />
            <DashboardSidebarHeaderItem>Informes</DashboardSidebarHeaderItem>
            <DashboardSidebarPageItem
              id="reporteMovimientos"
              title="Movimientos"
              icon={<SummarizeIcon />}
              href="/reportes/movimientos"
              selected={!!matchPath('/reportes/movimientos', pathname)}
            />
            <DashboardSidebarPageItem
              id="reporteResultados"
              title="Resultados"
              icon={<SummarizeIcon />}
              href="/reportes/resultados"
              selected={!!matchPath('/reportes/resultados', pathname)}
            />
            <DashboardSidebarDividerItem />
            <DashboardSidebarHeaderItem>Tablas</DashboardSidebarHeaderItem>
            <DashboardSidebarPageItem
              id="clientes"
              title="Clientes"
              icon={<PersonIcon />}
              href="/clientes"
              selected={!!matchPath('/clientes/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="prestadores"
              title="Prestadores"
              icon={<AssignmentIndIcon />}
              href="/prestadores"
              selected={!!matchPath('/prestadores/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="proveedores"
              title="Proveedores"
              icon={<StorefrontIcon />}
              href="/proveedores"
              selected={!!matchPath('/proveedores/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="servicios"
              title="Servicios"
              icon={<RoomServiceIcon />}
              href="/servicios"
              selected={!!matchPath('/servicios/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="tiposevento"
              title="Tipos de Evento"
              icon={<BookmarksIcon />}
              href="/tiposevento"
              selected={!!matchPath('/tiposevento/*', pathname)}
            />
            {/* <DashboardSidebarPageItem
              id="redes"
              title="Redes Sociales"
              icon={<ShareIcon />}
              href="/redes"
              selected={!!matchPath('/redes/*', pathname)}
            /> */}
            <DashboardSidebarPageItem
              id="fuentescontacto"
              title="Fuentes de Contacto"
              icon={<ContactSupportIcon />}
              href="/fuentescontacto"
              selected={!!matchPath('/fuentescontacto/*', pathname)}
            />
            <DashboardSidebarPageItem
              id="mediospagocobro"
              title="Medios de Pago/Cobro"
              icon={<AttachMoneyIcon />}
              href="/mediospagocobro"
              selected={!!matchPath('/mediospagocobro/*', pathname)}
            />
            <DashboardSidebarDividerItem />
            <DashboardSidebarHeaderItem>Sistema</DashboardSidebarHeaderItem>
            <DashboardSidebarPageItem
              id="configuracion"
              title="Configuración"
              icon={<SettingsIcon />}
              href="/configuracion"
              selected={!!matchPath('/configuracion', pathname)}
            />
          </List>
        </Box>
      </React.Fragment>
    ),
    [mini, hasDrawerTransitions, isFullyExpanded, pathname],
  );

  const getDrawerSharedSx = React.useCallback(
    (isTemporary) => {
      const drawerWidth = mini ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;

      return {
        displayPrint: 'none',
        width: drawerWidth,
        flexShrink: 0,
        ...getDrawerWidthTransitionMixin(expanded),
        ...(isTemporary ? { position: 'absolute' } : {}),
        [`& .MuiDrawer-paper`]: {
          position: 'absolute',
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundImage: 'none',
          ...getDrawerWidthTransitionMixin(expanded),
        },
      };
    },
    [expanded, mini],
  );

  const sidebarContextValue = React.useMemo(() => {
    return {
      onPageItemClick: handlePageItemClick,
      mini,
      fullyExpanded: isFullyExpanded,
      fullyCollapsed: isFullyCollapsed,
      hasDrawerTransitions,
    };
  }, [
    handlePageItemClick,
    mini,
    isFullyExpanded,
    isFullyCollapsed,
    hasDrawerTransitions,
  ]);

  return (
    <DashboardSidebarContext.Provider value={sidebarContextValue}>
      <Drawer
        container={container}
        variant="temporary"
        open={expanded}
        onClose={handleSetSidebarExpanded(false)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: {
            xs: 'block',
            sm: disableCollapsibleSidebar ? 'block' : 'none',
            md: 'none',
          },
          ...getDrawerSharedSx(true),
        }}
      >
        {getDrawerContent('phone')}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: {
            xs: 'none',
            sm: disableCollapsibleSidebar ? 'none' : 'block',
            md: 'none',
          },
          ...getDrawerSharedSx(false),
        }}
      >
        {getDrawerContent('tablet')}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          ...getDrawerSharedSx(false),
        }}
      >
        {getDrawerContent('desktop')}
      </Drawer>
    </DashboardSidebarContext.Provider>
  );
}

DashboardSidebar.propTypes = {
  container: (props, propName) => {
    if (props[propName] == null) {
      return null;
    }
    if (typeof props[propName] !== 'object' || props[propName].nodeType !== 1) {
      return new Error(`Expected prop '${propName}' to be of type Element`);
    }
    return null;
  },
  disableCollapsibleSidebar: PropTypes.bool,
  expanded: PropTypes.bool,
  setExpanded: PropTypes.func.isRequired,
};

export default DashboardSidebar;
