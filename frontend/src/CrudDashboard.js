import * as React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import NotificationsProvider from './hooks/useNotifications/NotificationsProvider';
import DialogsProvider from './hooks/useDialogs/DialogsProvider';
import AppTheme from './shared-theme/AppTheme';
import {
  dataGridCustomizations,
  datePickersCustomizations,
  sidebarCustomizations,
  formInputCustomizations,
  autocompleteCustomizations,
  feedbackCustomizations,
} from './theme/customizations';



const themeComponents = {
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...sidebarCustomizations,
  ...formInputCustomizations,
  ...autocompleteCustomizations,
  ...feedbackCustomizations,
};

export default function CrudDashboard(props) {
  return (
    <AppTheme {...props} themeComponents={themeComponents}>
      <CssBaseline enableColorScheme />
      <NotificationsProvider>
        <DialogsProvider>
          {props.children}
        </DialogsProvider>
      </NotificationsProvider>
    </AppTheme>
  );
}
