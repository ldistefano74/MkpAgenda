import { createContext, useContext } from 'react';

/**
 * Contexto interno del framework de reportes.
 *
 * Lo provee `ReportPageContainer` y lo consumen los wrappers `ReportField.*`
 * (a través del hook interno `useReportFilter`) para auto-registrar sus
 * filtros y reportar sus valores, sin que la página tenga que cablear estado.
 *
 * No es API pública: los reportes no deberían usar este contexto directamente.
 */
export const ReportContext = createContext(null);

export function useReportContext() {
    const ctx = useContext(ReportContext);
    if (!ctx) {
        throw new Error(
            'Los componentes ReportField.* deben usarse dentro de <ReportPageContainer>',
        );
    }
    return ctx;
}
