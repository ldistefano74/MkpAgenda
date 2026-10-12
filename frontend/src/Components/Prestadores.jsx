import { GenerateCRUDList } from "../lib/CRUDUtils";

// Lista de prestadores generada automáticamente
export const PrestadoresList = GenerateCRUDList("prestador", "prestadores", {
    include: ["nombre", "alias", "telefono", "fecha_nacimiento", "activo"]
});

// Formulario específico de prestadores usando BaseCrudPageContainer
export { default as PrestadoresEdit } from './PrestadorForm';
