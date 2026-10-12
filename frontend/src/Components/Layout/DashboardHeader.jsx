import * as React from 'react';
import PropTypes from 'prop-types';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiAppBar from '@mui/material/AppBar';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import Stack from '@mui/material/Stack';
import { Link } from 'react-router';
import ThemeSwitcher from './ThemeSwitcher';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../context/AuthContext';

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  borderWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: (theme.vars ?? theme).palette.divider,
  boxShadow: 'none',
  zIndex: theme.zIndex.drawer + 1,
}));

const LogoContainer = styled('div')({
  position: 'relative',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  '& img': {
    maxHeight: 40,
  },
});

const ENV_COLORS = {
  development: '#2e7d32', // green
  stage: '#f9a825',       // amber/yellow
};

function DashboardHeader({ logo, title, menuOpen, onToggleMenu }) {
  const theme = useTheme();
  const { logout, user } = useAuth();
  const envColor = user?.environment ? ENV_COLORS[user.environment] : undefined;

  const handleMenuOpen = React.useCallback(() => {
    onToggleMenu(!menuOpen);
  }, [menuOpen, onToggleMenu]);

  const getMenuIcon = React.useCallback(
    (isExpanded) => {
      const expandMenuActionText = 'Expand';
      const collapseMenuActionText = 'Collapse';

      return (
        <Tooltip
          title={`${isExpanded ? collapseMenuActionText : expandMenuActionText} menu`}
          enterDelay={1000}
        >
          <div>
            <IconButton
              size="small"
              aria-label={`${isExpanded ? collapseMenuActionText : expandMenuActionText} navigation menu`}
              onClick={handleMenuOpen}
            >
              {isExpanded ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </div>
        </Tooltip>
      );
    },
    [handleMenuOpen],
  );

  return (
    <AppBar color="inherit" position="absolute" sx={{ displayPrint: 'none', ...(envColor && { backgroundColor: envColor }) }}>
      <Toolbar sx={{ backgroundColor: 'inherit', mx: { xs: -0.75, sm: -1 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <Stack direction="row" alignItems="center">
            <Box sx={{ mr: 1 }}>{getMenuIcon(menuOpen)}</Box>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Stack direction="row" alignItems="center">
                {logo ? <LogoContainer>{logo}</LogoContainer> : null}
                {title ? (
                  <Typography
                    variant="h6"
                    sx={{
                      color: (theme.vars ?? theme).palette.primary.main,
                      fontWeight: '700',
                      ml: 1,
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {title}
                  </Typography>
                ) : null}
              </Stack>
            </Link>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ marginLeft: 'auto' }}
          >
            <Stack direction="row" alignItems="center">
              <ThemeSwitcher />
              <Tooltip title={`Cerrar sesión${user ? ` (${user.name})` : ''}`} enterDelay={500}>
                <IconButton size="small" onClick={logout} aria-label="Cerrar sesión">
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

DashboardHeader.propTypes = {
  logo: PropTypes.node,
  menuOpen: PropTypes.bool.isRequired,
  onToggleMenu: PropTypes.func.isRequired,
  title: PropTypes.string,
};

export default DashboardHeader;
