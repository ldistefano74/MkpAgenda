/* eslint-disable import/prefer-default-export */
export const autocompleteCustomizations = {
    MuiIconButton: {
        styleOverrides: {
            root: ({ theme }) => ({
                // Excepción para IconButtons dentro de Autocomplete
                // Esto elimina el borde y fondo que hace que el botón se vea como un cuadrado
                '.MuiAutocomplete-root &': {
                    border: 'none',
                    backgroundColor: 'transparent',
                    width: 'auto',
                    height: 'auto',
                    '&:hover': {
                        backgroundColor: 'transparent',
                    },
                    '&:active': {
                        backgroundColor: 'transparent',
                    },
                },
                // Excepción para modo oscuro también
                ...theme.applyStyles('dark', {
                    '.MuiAutocomplete-root &': {
                        border: 'none',
                        backgroundColor: 'transparent',
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                        '&:active': {
                            backgroundColor: 'transparent',
                        },
                    },
                }),
            }),
        },
    },
};
