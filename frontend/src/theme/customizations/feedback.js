import { alpha } from '@mui/material/styles';
import { brand, gray, green, orange, red } from '../../shared-theme/themePrimitives';

/* eslint-disable import/prefer-default-export */
export const feedbackCustomizations = {
    MuiAlert: {
        styleOverrides: {
            root: ({ ownerState, theme }) => {
                const severityMap = {
                    success: green,
                    warning: orange,
                    error: red,
                    info: brand,
                };
                const color = severityMap[ownerState.severity] || orange;

                return {
                    borderRadius: 10,
                    backgroundColor: color[100],
                    color: (theme.vars || theme).palette.text.primary,
                    border: `1px solid ${alpha(color[300], 0.5)}`,
                    '& .MuiAlert-icon': {
                        color: color[500],
                    },
                    ...theme.applyStyles('dark', {
                        backgroundColor: `${alpha(color[900], 0.5)}`,
                        border: `1px solid ${alpha(color[800], 0.5)}`,
                    }),
                };
            },
        },
    },
};
